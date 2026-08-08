// mould - index.ts
// Exports the cli (./cli.ts), the `run` entrypoint used by ./bin/mould.ts, and types

import MouldCommandLineInterface from "./cli";
import { dirname, join, normalize } from "path";
import { fileURLToPath } from "url";

export { MouldCommandLineInterface } from "./cli";
export type { IMouldCommandLineInterface } from "@/types/IMouldCommandLineInterface";

// `__dirname` is a CommonJS global and is undefined once the compiled output runs
// as an ES module under Node, so derive this module's directory from its own URL.
const moduleDirectory: string = dirname(fileURLToPath(import.meta.url));

// Script to run when the `mould` command is executed
async function run(argv: readonly string[]): Promise<void> {
  const mouldAppDir: string = normalize(join(moduleDirectory, ".."));
  const mould = new MouldCommandLineInterface({
    mouldAppDir,
  });

  await mould.run(argv);
  return;
}

export default run;

// Types
export type { MouldInputItemDefinition } from "@/types/MouldInputItemDefinition";
export type { TemplateSubstitutionList } from "@/types/TemplateSubstitutionList";
