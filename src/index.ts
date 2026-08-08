// mould - index.ts
// Runs the cli (./cli.ts) if called directly, or exports types

import MouldCommandLineInterface from "./cli";
import { join, normalize } from "path";

export { MouldCommandLineInterface } from "./cli";
export type { IMouldCommandLineInterface } from "@/types/IMouldCommandLineInterface";

// Script to run when index.ts is executed directly
async function run(argv: readonly string[]): Promise<void> {
  const mouldAppDir: string = normalize(join(__dirname, ".."));
  const mould = new MouldCommandLineInterface({
    mouldAppDir,
  });

  await mould.run(argv);
  return;
}

export default run;

// Run if imported directly
if (require.main === module) {
  await run(process.argv);
}

// Types
export type { MouldInputItemDefinition } from "@/types/MouldInputItemDefinition";
export type { TemplateSubstitutionList } from "@/types/TemplateSubstitutionList";
