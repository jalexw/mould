const DEBUG: boolean = true;

// @ts-ignore
import { describe, expect, test } from "bun:test";

// mould CLI to invoke within same process on mock inputs
import mould from "$/mould";

// OS Utils
import { existsSync, mkdirSync, readdirSync, readFileSync } from "fs";
import { join, normalize } from "path";

const projectRootDir: string = normalize(join(__dirname, ".."));
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

// A map of sample inputs for the given mould
const sampleInputs: Record<string, Record<string, string>> = {
  "example-typescript-project": {
    project_name: "example-typescript-project",
    org_scope: "jalexw",
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

// Checks for a given mould
const checks: Record<
  string,
  | ((output_path: string) => boolean)
  | ((output_path: string) => Promise<boolean>)
> = {
  "example-typescript-project":
    checkDidExampleTypeScriptProjectVariableSubstituteSuccess,
  "hello-world-mould": helloWorldMouldValidator,
};

describe("Test Moulds", () => {
  const testMoulds = listTestMoulds();

  testMoulds.forEach((testMould: string): void => {
    const testTemplateName: string = testMould;
    test(`can use template '${testTemplateName}'`, async () => {
      const output_path: string = join(thisRunTmpPath, testMould);
      expect(existsSync(output_path)).toBeFalsy();

      const commandArgs: string[] = [
        "use",
        testTemplateName,
        output_path,
        "--template-sources",
        mockTestMouldsPath,
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
