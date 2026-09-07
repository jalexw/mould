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
import { spawnSync } from "child_process";

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
  "ignore-patterns-mould": {
    app_name: "ignore-patterns-app",
  },
  "conditional-mould": {
    deployment: "vercel",
    with_docs: "yes",
    slug: "my-slug",
  },
  "executable-mould": {
    name: "exec-test",
  },
  "literal-substitutions-mould": {
    name: "a$&b",
    version: "v2.5",
  },
  "binary-mould": {
    caption: "a pixel",
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

/**
 * Run a command inside a fixture directory, failing loudly (with its output)
 * if it does not exit cleanly.
 */
function runInFixture(fixturePath: string, command: string, args: readonly string[]): void {
  const result = spawnSync(command, [...args], {
    cwd: fixturePath,
    encoding: "utf-8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(
      `'${[command, ...args].join(" ")}' failed in '${fixturePath}' with exit code ${result.status}\n${result.stdout}\n${result.stderr}`,
    );
  }
}

/**
 * Every byte value 0..255, repeated, so the copy is exercised against a NUL byte
 * (mould's binary heuristic) and against every byte a UTF-8 round-trip could
 * mangle. Written into the 'binary-mould' fixture by `prepareBinaryMould`
 * rather than committed, so no binary blob lives in the repository.
 */
const BINARY_FIXTURE_BYTES: Buffer = Buffer.from(
  Array.from({ length: 256 * 4 }, (_: unknown, i: number): number => i % 256),
);

function prepareBinaryMould(fixturePath: string): void {
  const blobPath: string = join(fixturePath, "blob.bin");
  writeFileSync(blobPath, BINARY_FIXTURE_BYTES);
  expect(existsSync(blobPath)).toBeTrue();
}

/**
 * The 'ignore-patterns-mould' fixture is a real (tiny) TypeScript app. 'dist/'
 * and 'node_modules/' stay gitignored, so they are produced here — by actually
 * installing and building the app — before the template is used. Their
 * existence is asserted so the later "not exported" check cannot pass vacuously.
 */
function prepareIgnorePatternsMould(fixturePath: string): void {
  runInFixture(fixturePath, "bun", ["install", "--no-save"]);
  runInFixture(fixturePath, "bun", ["run", "build"]);

  for (const generated of ["node_modules", "dist", join("dist", "index.js")]) {
    expect(existsSync(join(fixturePath, generated))).toBeTrue();
  }
}

function ignorePatternsMouldValidator(output_path: string): boolean {
  // After install + build the fixture holds build output ('dist/'), installed
  // dependencies ('node_modules/') and a stray log file, all of which its
  // '.mouldconfig.json' lists under 'ignorePatterns'. None of them may reach
  // the scaffolded app — while the app's real sources must.
  const exported: readonly string[] = [
    ...listExportedPathsRecursively(output_path),
  ].sort();

  const expected: readonly string[] = [
    "README.md",
    "package.json",
    "src",
    "src/index.ts",
    "tsconfig.json",
  ];

  const unexpected: readonly string[] = exported.filter(
    (exportedPath: string): boolean => !expected.includes(exportedPath),
  );
  const missing: readonly string[] = expected.filter(
    (expectedPath: string): boolean => !exported.includes(expectedPath),
  );

  if (unexpected.length > 0) {
    console.warn("Paths that should have been ignored were exported: ", unexpected);
    return false;
  }
  if (missing.length > 0) {
    console.warn("Paths that should have been exported are missing: ", missing);
    return false;
  }

  for (const ignoredPath of ["dist", "node_modules", "debug.log"]) {
    if (existsSync(join(output_path, ignoredPath))) {
      console.warn(`'${ignoredPath}' should not exist in the scaffolded app`);
      return false;
    }
  }

  // Substitutions still apply to the files that do get copied
  const packageJson: unknown = JSON.parse(
    readFileSync(join(output_path, "package.json"), { encoding: "utf-8" }),
  );
  if (
    typeof packageJson !== "object" ||
    !packageJson ||
    !("name" in packageJson) ||
    packageJson["name"] !== "ignore-patterns-app"
  ) {
    console.warn("Expected package.json name to be 'ignore-patterns-app'");
    return false;
  }

  return true;
}

function readOutput(output_path: string, ...segments: string[]): string {
  return readFileSync(join(output_path, ...segments), { encoding: "utf-8" });
}

function conditionalMouldValidator(output_path: string): boolean {
  // Rendered with deployment=vercel and with_docs=yes: the conditional path
  // and directory are present, the active branches kept, and no marker line
  // survives anywhere.
  const exported: readonly string[] = [
    ...listExportedPathsRecursively(output_path),
  ].sort();
  const expected: readonly string[] = [
    "ci.yml",
    "docs",
    "docs/README.md",
    "index.ts",
    "notes.txt",
    "vercel.json",
  ];
  if (JSON.stringify(exported) !== JSON.stringify(expected)) {
    console.warn("Unexpected export for conditional-mould: ", exported);
    return false;
  }

  const ci: string = readOutput(output_path, "ci.yml");
  const notes: string = readOutput(output_path, "notes.txt");
  const index: string = readOutput(output_path, "index.ts");
  const docs: string = readOutput(output_path, "docs", "README.md");

  const checks: readonly [string, boolean][] = [
    ["ci.yml keeps the vercel job", ci.includes("publish-to-vercel:")],
    ["notes.txt keeps the if-branch", notes.includes("Docs are included.")],
    ["notes.txt drops the else-branch", !notes.includes("Docs are not included.")],
    ["notes.txt keeps prose mentioning mould:if", notes.includes("mentions mould:if in prose")],
    ["notes.txt substitutes the slug", notes.includes("Project: my-slug")],
    ["index.ts keeps the != none branch", index.includes("xxx_deployment_placeholder")],
    ["index.ts keeps the TSX-style block", index.includes("export const docs = true;")],
    ["index.ts drops the TSX-style markers", !index.includes("{/*")],
    ["docs/README.md substitutes the slug", docs.includes("# Docs for my-slug")],
  ];
  for (const [label, ok] of checks) {
    if (!ok) {
      console.warn(`conditional-mould: ${label} — failed`);
      return false;
    }
  }

  for (const file of ["ci.yml", "notes.txt", "index.ts"]) {
    if (/mould:(if|else|endif)\b/.test(readOutput(output_path, file).replace("mentions mould:if in prose", ""))) {
      console.warn(`conditional-mould: a marker line survived in ${file}`);
      return false;
    }
  }
  return true;
}

function renamesMouldValidator(output_path: string): boolean {
  const exported: readonly string[] = [
    ...listExportedPathsRecursively(output_path),
  ].sort();
  const expected: readonly string[] = [".gitignore", "config", "config/.npmrc", "keep.txt"];
  if (JSON.stringify(exported) !== JSON.stringify(expected)) {
    console.warn("Unexpected export for renames-mould: ", exported);
    return false;
  }
  return (
    readOutput(output_path, ".gitignore") === "node_modules/\n" &&
    readOutput(output_path, "config", ".npmrc").startsWith("registry=")
  );
}

function executableMouldValidator(output_path: string): boolean {
  const script: string = join(output_path, "run.sh");
  if (!readFileSync(script, { encoding: "utf-8" }).includes("hello from exec-test")) {
    console.warn("executable-mould: substitution did not apply to run.sh");
    return false;
  }
  if (process.platform === "win32") {
    return true;
  }
  const scriptMode: number = lstatSync(script).mode & 0o111;
  const plainMode: number = lstatSync(join(output_path, "plain.txt")).mode & 0o111;
  if (scriptMode === 0) {
    console.warn("executable-mould: run.sh lost its executable bit");
    return false;
  }
  if (plainMode !== 0) {
    console.warn("executable-mould: plain.txt unexpectedly became executable");
    return false;
  }
  return true;
}

function literalSubstitutionsMouldValidator(output_path: string): boolean {
  const values: string = readOutput(output_path, "values.txt");
  const expected: string = "literal: a$&b\ndecoy: xxxYnameYxxx\nregex: v2.5\n";
  if (values !== expected) {
    console.warn("literal-substitutions-mould: unexpected values.txt: ", JSON.stringify(values));
    return false;
  }
  return true;
}

function binaryMouldValidator(output_path: string): boolean {
  // Compared against the constant, not the fixture file, so a broken prepare
  // step cannot make this pass vacuously.
  const copied: Buffer = readFileSync(join(output_path, "blob.bin"));
  if (!copied.equals(BINARY_FIXTURE_BYTES)) {
    console.warn("binary-mould: blob.bin was altered by the copy");
    return false;
  }
  return readOutput(output_path, "text.txt").includes("Alongside the blob: a pixel");
}

function defaultsMouldValidator(output_path: string): boolean {
  // Rendered with no --input at all: both optional inputs fall back to their
  // defaults, the boolean one as the string "true".
  const settings: string = readOutput(output_path, "settings.ini");
  if (settings !== "greeting=hello\nverbose=true\n") {
    console.warn("defaults-mould: unexpected settings.ini: ", JSON.stringify(settings));
    return false;
  }
  return true;
}

// Steps to run against a fixture directory *before* it is used, e.g. to
// generate files that are deliberately not committed
const prepares: Record<string, (fixturePath: string) => void> = {
  "ignore-patterns-mould": prepareIgnorePatternsMould,
  "binary-mould": prepareBinaryMould,
};

// Checks for a given mould
const checks: Record<
  string,
  | ((output_path: string) => boolean)
  | ((output_path: string) => Promise<boolean>)
> = {
  "example-typescript-project":
    checkDidExampleTypeScriptProjectVariableSubstituteSuccess,
  "hello-world-mould": helloWorldMouldValidator,
  "ignore-patterns-mould": ignorePatternsMouldValidator,
  "interactive-test-mould": interactiveTestMouldValidator,
  "minimal-mould": minimalMouldValidator,
  "nested-config-mould": nestedConfigMouldValidator,
  "conditional-mould": conditionalMouldValidator,
  "renames-mould": renamesMouldValidator,
  "executable-mould": executableMouldValidator,
  "literal-substitutions-mould": literalSubstitutionsMouldValidator,
  "binary-mould": binaryMouldValidator,
  "defaults-mould": defaultsMouldValidator,
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
          options: "",
          default: "",
        },
        {
          id: "favorite_color",
          label: "Favorite Color",
          description: "Your favorite color",
          required: false,
          type: "text",
          options: "",
          default: "",
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

describe("use", () => {
  test("accepts a template directory path instead of a name", async () => {
    // No --sources-files at all: the path is used directly
    const output_path: string = join(thisRunTmpPath, "use-by-path");
    await runMouldCommand(
      ["use", join(mockTestMouldsPath, "hello-world-mould"), output_path],
      DEBUG,
    );
    expect(helloWorldMouldValidator(output_path)).toBeTrue();
  });

  test("splits --input pairs at the first '=' only", async () => {
    const output_path: string = join(thisRunTmpPath, "input-with-equals");
    await runMouldCommand(
      [
        "--sources-files",
        testSourcesFilePath,
        "use",
        "interactive-test-mould",
        output_path,
        "--input",
        "user_name=TestUser",
        "favorite_color=a=b",
      ],
      DEBUG,
    );
    const greeting: string = readFileSync(join(output_path, "greeting.txt"), {
      encoding: "utf-8",
    });
    expect(greeting).toContain("favorite color is a=b");
  });

  test("only requires the inputs marked required", async () => {
    // 'favorite_color' is optional and omitted: the run succeeds and the
    // placeholder is replaced with an empty string
    const output_path: string = join(thisRunTmpPath, "optional-omitted");
    await runMouldCommand(
      [
        "--sources-files",
        testSourcesFilePath,
        "use",
        "interactive-test-mould",
        output_path,
        "--input",
        "user_name=TestUser",
      ],
      DEBUG,
    );
    const greeting: string = readFileSync(join(output_path, "greeting.txt"), {
      encoding: "utf-8",
    });
    expect(greeting).toContain("Hello TestUser!");
    expect(greeting).toContain("favorite color is .");
    expect(greeting).not.toContain("{{");
  });
});

describe("Test Moulds", () => {
  const testMoulds = listTestMoulds();

  testMoulds.forEach((testMould: string): void => {
    const testTemplateName: string = testMould;
    // Installing and building a fixture takes longer than the default timeout
    const timeoutMs: number = prepares[testTemplateName] ? 120_000 : 5_000;
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

      if (prepares[testTemplateName]) {
        prepares[testTemplateName](join(mockTestMouldsPath, testTemplateName));
      }

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

      // Build output and installed dependencies never belong in a scaffolded
      // app: 'node_modules' is always skipped, and the fixtures that carry a
      // 'dist/' list it under 'ignorePatterns'.
      const leakedArtifacts: readonly string[] = exportedPaths.filter(
        (exportedPath: string): boolean => {
          const segments: readonly string[] = exportedPath.split("/");
          return (
            segments.includes("dist") || segments.includes("node_modules")
          );
        },
      );
      expect(leakedArtifacts).toEqual([]);

      if (checks[testTemplateName]) {
        const checkFn:
          | ((output_path: string) => Promise<boolean>)
          | ((output_path: string) => boolean) = checks[testTemplateName];
        const isValid: boolean = await checkFn(output_path);
        expect(isValid).toBeTrue();
      }
    }, timeoutMs);
  });
});
