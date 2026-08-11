const DEBUG = false as const satisfies boolean;

// @ts-ignore
import { describe, expect, test } from "bun:test";

// mould CLI to invoke within same process on mock inputs
import mould from "$/mould";

// OS Utils
import { join, normalize } from "path";
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync
} from "fs";

const projectRootDir: string = normalize(join(__dirname, "..", ".."));
const testRunId: string = crypto.randomUUID();

if (!existsSync(join(projectRootDir, "package.json"))) {
  console.error("Failed to resolve project root directory!");
  process.exit(1);
}

const mockTestMouldsPath: string = join(
  projectRootDir,
  "test-fixtures",
  "test-moulds",
);
if (!existsSync(mockTestMouldsPath)) {
  throw new Error("Failed to load path to test moulds!");
}

const tmpPath: string = join(projectRootDir, "tmp");

if (!existsSync(tmpPath)) {
  mkdirSync(tmpPath);
}

const thisRunTmpPath = join(tmpPath, `test-run-${testRunId}`);
if (!existsSync(thisRunTmpPath)) {
  mkdirSync(thisRunTmpPath);
}

/**
 * Templates are reached through the global `--sources-files` flag, which takes
 * 'template-sources.json' files rather than template directories. The committed
 * './test-fixtures/test-template-sources.json' says the same thing with a
 * relative path; this copy uses absolute paths so the suite does not depend on
 * the working directory it is run from.
 */
const testSourcesFilePath: string = join(
  thisRunTmpPath,
  "test-template-sources.json",
);
writeFileSync(
  testSourcesFilePath,
  JSON.stringify(
    {
      $schema: "https://jalexw.github.io/mould/openapi/template-sources.json",
      templates: [],
      templatesDirectories: [mockTestMouldsPath],
    },
    null,
    2,
  ),
);

function listTestMoulds(): readonly string[] {
  return readdirSync(mockTestMouldsPath);
}

export async function runMouldCommand(
  argv: readonly string[],
  debug: boolean = false,
): Promise<void> {
  expect(
    Array.isArray(argv) && argv.every((a) => typeof a === "string"),
  ).toBeTrue();
  try {
    const runtime = process.argv[0];
    if (!runtime || typeof runtime !== "string") {
      throw new TypeError(
        "Failed to resolve current runtime name to include in test mock call args",
      );
    }
    const thisProgram = process.argv[1];
    if (!thisProgram || typeof thisProgram !== "string") {
      throw new TypeError(
        "Failed to resolve current program name to include in test mock call args",
      );
    }
    const argsToMouldCliArgParser = [...argv];
    const args = [runtime, thisProgram, ...argsToMouldCliArgParser];
    if (debug) {
      console.log("Running 'mould' command: ", [
        "mould",
        ...argsToMouldCliArgParser,
      ]);
    }
    return await mould(args);
  } catch (e: unknown) {
    console.error(e);
    throw new Error("Error running 'mould' command within tests!");
  }
}

const mouldConfigFileName = ".mouldconfig.json" as const satisfies string;

/**
 * Every path (relative to `dir`) contained in `dir`, at any depth.
 */
function listExportedPathsRecursively(
  dir: string,
  relativeTo: readonly string[] = [],
): readonly string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir)) {
    const relativePath: readonly string[] = [...relativeTo, entry];
    found.push(relativePath.join("/"));
    if (lstatSync(join(dir, entry)).isDirectory()) {
      found.push(
        ...listExportedPathsRecursively(join(dir, entry), relativePath),
      );
    }
  }
  return found;
}

// A map of sample inputs for the given mould
const sampleInputs: Record<string, Record<string, string>> = {
  "example-typescript-project": {
    project_name: "example-typescript-project",
    org_scope: "jalexw",
  },
  "interactive-test-mould": {
    user_name: "TestUser",
    favorite_color: "blue",
  },
};

async function checkDidExampleTypeScriptProjectVariableSubstituteSuccess(
  output_path: string,
): Promise<boolean> {
  try {
    const data: string = readFileSync(join(output_path, "package.json"), {
      encoding: "utf-8",
    });
    const parsed: unknown = JSON.parse(data);
    if (
      typeof parsed === "object" &&
      !!parsed &&
      "name" in parsed &&
      parsed["name"] === "@jalexw/example-typescript-project"
    ) {
      return true;
    } else {
      console.error(
        "Expected package.json name to be @jalexw/example-typescript-project",
      );
    }
  } catch (e: unknown) {}

  return false;
}

function helloWorldMouldValidator(output_path: string): boolean {
  const fileTxt = join(output_path, "index.js");
  if (existsSync(fileTxt)) {
    const file: string = readFileSync(fileTxt, { encoding: "utf-8" });
    if (file.includes("Hello world!")) {
      return true;
    }
  } else {
    console.warn("No file found at ", fileTxt);
  }

  return false;
}

function interactiveTestMouldValidator(output_path: string): boolean {
  const greetingFile = join(output_path, "greeting.txt");
  if (existsSync(greetingFile)) {
    const file: string = readFileSync(greetingFile, { encoding: "utf-8" });
    // Check if substitutions were applied correctly
    if (
      file.includes("Hello TestUser!") &&
      file.includes("favorite color is blue")
    ) {
      return true;
    }
  } else {
    console.warn("No file found at ", greetingFile);
  }

  return false;
}

function minimalMouldValidator(output_path: string): boolean {
  // A minimal mould holds nothing but its '.mouldconfig.json', which is never
  // copied through to the output, so the exported directory should be empty.
  const exported: readonly string[] = readdirSync(output_path);
  if (exported.length === 1 && typeof exported[0] === 'string' && exported[0] === '.DS_Store') {
    return true;
  }
  if (exported.length !== 0) {
    console.warn("Expected an empty export, but found: ", exported);
    return false;
  }

  return true;
}

function nestedConfigMouldValidator(output_path: string): boolean {
  // The nested '.mouldconfig.json' is dropped, but its sibling still exports —
  // otherwise the "no leaked configs" assertion would pass vacuously.
  const nestedFile = join(output_path, "src", "index.js");
  if (!existsSync(nestedFile)) {
    console.warn("No file found at ", nestedFile);
    return false;
  }

  return readFileSync(nestedFile, { encoding: "utf-8" }).includes(
    "Nested config mould!",
  );
}

// Checks for a given mould
const checks: Record<
  string,
  | ((output_path: string) => boolean)
  | ((output_path: string) => Promise<boolean>)
> = {
  "example-typescript-project":
    checkDidExampleTypeScriptProjectVariableSubstituteSuccess,
  "hello-world-mould": helloWorldMouldValidator,
  "interactive-test-mould": interactiveTestMouldValidator,
  "minimal-mould": minimalMouldValidator,
  "nested-config-mould": nestedConfigMouldValidator,
};

describe("MOULD_TEMPLATE_SOURCES", () => {
  const environmentVariable = "MOULD_TEMPLATE_SOURCES" as const;

  /**
   * A sources file listing a single template by path, so that a template is
   * only reachable through the sources file that names it.
   */
  function writeSingleTemplateSourcesFile(
    fileName: string,
    templateName: string,
  ): string {
    const path: string = join(thisRunTmpPath, fileName);
    writeFileSync(
      path,
      JSON.stringify(
        {
          $schema:
            "https://jalexw.github.io/mould/openapi/template-sources.json",
          templates: [join(mockTestMouldsPath, templateName)],
          templatesDirectories: [],
        },
        null,
        2,
      ),
    );
    return path;
  }

  async function withEnvironmentVariable<T>(
    value: string,
    run: () => Promise<T>,
  ): Promise<T> {
    const previous: string | undefined = process.env[environmentVariable];
    process.env[environmentVariable] = value;
    try {
      return await run();
    } finally {
      if (typeof previous === "string") {
        process.env[environmentVariable] = previous;
      } else {
        delete process.env[environmentVariable];
      }
    }
  }

  test("templates are reachable through the environment variable alone", async () => {
    const output_path: string = join(thisRunTmpPath, "env-var-only");
    expect(existsSync(output_path)).toBeFalsy();

    await withEnvironmentVariable(testSourcesFilePath, () =>
      runMouldCommand(["use", "hello-world-mould", output_path], DEBUG),
    );

    expect(existsSync(output_path)).toBeTruthy();
    expect(helloWorldMouldValidator(output_path)).toBeTrue();
  });

  test("both the environment variable and --sources-files are searched", async () => {
    // Each sources file names exactly one template, so a template can only be
    // found if the sources file naming it was searched.
    const flagSourcesFile: string = writeSingleTemplateSourcesFile(
      "flag-template-sources.json",
      "hello-world-mould",
    );
    const envSourcesFile: string = writeSingleTemplateSourcesFile(
      "env-template-sources.json",
      "minimal-mould",
    );

    const fromFlagOutputPath: string = join(thisRunTmpPath, "from-flag");
    const fromEnvOutputPath: string = join(thisRunTmpPath, "from-env");

    await withEnvironmentVariable(envSourcesFile, async () => {
      await runMouldCommand(
        [
          "--sources-files",
          flagSourcesFile,
          "use",
          "hello-world-mould",
          fromFlagOutputPath,
        ],
        DEBUG,
      );
      await runMouldCommand(
        [
          "--sources-files",
          flagSourcesFile,
          "use",
          "minimal-mould",
          fromEnvOutputPath,
        ],
        DEBUG,
      );
    });

    expect(helloWorldMouldValidator(fromFlagOutputPath)).toBeTrue();
    expect(minimalMouldValidator(fromEnvOutputPath)).toBeTrue();
  });

  test("the environment variable replaces the default search locations", async () => {
    const logged: string[] = [];
    const originalLog = console.log;
    console.log = (...args: unknown[]): void => {
      logged.push(args.map((arg) => String(arg)).join(" "));
    };
    try {
      await withEnvironmentVariable(testSourcesFilePath, () =>
        runMouldCommand(["template-sources"], DEBUG),
      );
    } finally {
      console.log = originalLog;
    }

    expect(logged).toEqual([` - ${testSourcesFilePath}`]);
  });

  test("a path listed in both places is only searched once", async () => {
    const logged: string[] = [];
    const originalLog = console.log;
    console.log = (...args: unknown[]): void => {
      logged.push(args.map((arg) => String(arg)).join(" "));
    };
    try {
      await withEnvironmentVariable(testSourcesFilePath, () =>
        runMouldCommand(
          ["--sources-files", testSourcesFilePath, "template-sources"],
          DEBUG,
        ),
      );
    } finally {
      console.log = originalLog;
    }

    expect(logged).toEqual([` - ${testSourcesFilePath}`]);
  });
});

describe("inputs", () => {
  /**
   * The command reports through `console.log` (JSON and the 'no inputs'
   * message) and `console.table` (the human-readable listing), so both are
   * captured. The missing-template path is deliberately untested here: it ends
   * in `process.exit`, which would take the test runner down with it.
   */
  async function captureInputsCommand(
    argv: readonly string[],
  ): Promise<{ logged: readonly string[]; tabled: readonly unknown[] }> {
    const logged: string[] = [];
    const tabled: unknown[] = [];
    const originalLog = console.log;
    const originalTable = console.table;
    console.log = (...args: unknown[]): void => {
      logged.push(args.map((arg) => String(arg)).join(" "));
    };
    console.table = (data: unknown): void => {
      tabled.push(data);
    };
    try {
      await runMouldCommand(
        ["--sources-files", testSourcesFilePath, ...argv],
        DEBUG,
      );
    } finally {
      console.log = originalLog;
      console.table = originalTable;
    }
    return { logged, tabled };
  }

  test("tabulates the inputs declared by a template", async () => {
    const { tabled } = await captureInputsCommand([
      "inputs",
      "interactive-test-mould",
    ]);

    expect(tabled).toEqual([
      [
        {
          id: "user_name",
          label: "User Name",
          description: "Your name to be included in the greeting",
          required: true,
          type: "text",
        },
        {
          id: "favorite_color",
          label: "Favorite Color",
          description: "Your favorite color",
          required: false,
          type: "text",
        },
      ],
    ]);
  });

  test("prints the raw input definitions with --json", async () => {
    const { logged } = await captureInputsCommand([
      "inputs",
      "example-typescript-project",
      "--json",
    ]);

    expect(logged.length).toEqual(1);
    expect(JSON.parse(logged[0] as string)).toEqual([
      {
        id: "project_name",
        label: "Project Name",
        description: "Package name for 'name' field of new package.json file",
        required: true,
        type: "text",
      },
      {
        id: "org_scope",
        label: "Org Scope",
        description: "Scope for 'name' field of new package.json file",
        required: true,
        type: "text",
      },
    ]);
  });

  test("says so when a template declares no inputs", async () => {
    const { logged, tabled } = await captureInputsCommand([
      "inputs",
      "minimal-mould",
    ]);

    expect(logged).toEqual([
      "Template 'minimal-mould' does not take any inputs.",
    ]);
    expect(tabled).toEqual([]);
  });

  test("treats a template without a '.mouldconfig.json' as taking no inputs", async () => {
    // 'hello-world-mould' carries no config file at all
    const { logged } = await captureInputsCommand([
      "inputs",
      "hello-world-mould",
      "--json",
    ]);

    expect(logged.length).toEqual(1);
    expect(JSON.parse(logged[0] as string)).toEqual([]);
  });

  test("is reachable through its 'describe' and 'template-inputs' aliases", async () => {
    for (const alias of ["describe", "template-inputs"]) {
      const { logged } = await captureInputsCommand([
        alias,
        "minimal-mould",
      ]);
      expect(logged).toEqual([
        "Template 'minimal-mould' does not take any inputs.",
      ]);
    }
  });
});

describe("create-minimal-template", () => {
  // The 'minimal-mould' fixture is exactly what the scaffolder should emit
  const minimalMouldFixture: string = join(mockTestMouldsPath, "minimal-mould");

  test("scaffolds a template matching the 'minimal-mould' fixture", async () => {
    const output_path: string = join(thisRunTmpPath, "scaffolded-minimal-mould");
    expect(existsSync(output_path)).toBeFalsy();

    await runMouldCommand(
      ["create-minimal-template", output_path],
      DEBUG,
    );

    expect(existsSync(output_path)).toBeTruthy();
    expect(readdirSync(output_path)).toEqual([".mouldconfig.json"]);

    const scaffolded: string = readFileSync(
      join(output_path, ".mouldconfig.json"),
      { encoding: "utf-8" },
    );
    const expected: string = readFileSync(
      join(minimalMouldFixture, ".mouldconfig.json"),
      { encoding: "utf-8" },
    );
    expect(scaffolded).toEqual(expected);
  });

  test("throws when something already exists at the supplied path", async () => {
    const output_path: string = join(thisRunTmpPath, "already-exists");
    mkdirSync(output_path);

    expect(
      runMouldCommand(["create-minimal-template", output_path], DEBUG),
    ).rejects.toThrow();
  });
});

describe("Test Moulds", () => {
  const testMoulds = listTestMoulds();

  testMoulds.forEach((testMould: string): void => {
    const testTemplateName: string = testMould;
    test(`can use template '${testTemplateName}'`, async () => {
      const output_path: string = join(thisRunTmpPath, testMould);
      expect(existsSync(output_path)).toBeFalsy();

      // '--sources-files' is a program-level flag, so it precedes the subcommand
      const commandArgs: string[] = [
        "--sources-files",
        testSourcesFilePath,
        "use",
        testTemplateName,
        output_path,
      ];

      // Pass pre-saved sample inputs if some are set
      if (!!sampleInputs[testTemplateName]) {
        commandArgs.push("--input");
        const input: Record<string, string> = sampleInputs[testTemplateName];
        for (const [key, value] of Object.entries(input)) {
          commandArgs.push(`${key}=${value}`);
        }
      }

      await runMouldCommand(commandArgs, DEBUG);

      expect(existsSync(output_path)).toBeTruthy();

      // A template's own '.mouldconfig.json' is mould's metadata, not template
      // content, so it must never be copied into the export — at any depth.
      const exportedPaths: readonly string[] =
        listExportedPathsRecursively(output_path);
      const leakedConfigs: readonly string[] = exportedPaths.filter(
        (exportedPath: string): boolean =>
          exportedPath.split("/").includes(mouldConfigFileName),
      );
      expect(leakedConfigs).toEqual([]);

      if (checks[testTemplateName]) {
        const checkFn:
          | ((output_path: string) => Promise<boolean>)
          | ((output_path: string) => boolean) = checks[testTemplateName];
        const isValid: boolean = await checkFn(output_path);
        expect(isValid).toBeTrue();
      }
    });
  });
});
