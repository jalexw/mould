import { describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, readdirSync } from "fs";
import { join, normalize } from "path";
import mould from "$/mould";

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

async function runMouldCommand(
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

describe("Test Moulds", () => {
  const testMoulds = listTestMoulds();

  testMoulds.forEach((testMould: string): void => {
    const testTemplateName: string = testMould;
    test(`can use template '${testTemplateName}'`, async () => {
      const output_path: string = join(thisRunTmpPath, testMould);
      expect(existsSync(output_path)).toBeFalsy();

      await runMouldCommand([
        "use",
        testTemplateName,
        output_path,
        "--template-sources",
        mockTestMouldsPath,
      ]);

      expect(existsSync(output_path)).toBeTruthy();
    });
  });
});
