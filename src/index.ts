// mould - index.ts
// Exports the cli (./cli.ts), the `run` entrypoint used by ./bin/mould.ts, the
// programmatic API (`applyTemplate`), the error classes, and types

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

// Programmatic API
export {
  applyTemplate,
  loadTemplateConfig,
  Template,
} from "@/lib/Template";
export type {
  IApplyTemplateOptions,
  IApplyTemplateResult,
} from "@/lib/Template";
export { resolveInputs, normalizeInputValue } from "@/lib/Inputs";
export type {
  ProvidedInputValues,
  ResolvedInputValues,
  PromptForInput,
} from "@/lib/Inputs";
export {
  parseCondition,
  evaluateCondition,
  applyConditionalBlocks,
} from "@/lib/Conditions";
export type { Condition } from "@/lib/Conditions";
export { templateConfigSchema } from "@/schemas/templateConfigSchema";

// Errors
export {
  MouldError,
  TemplateNotFoundError,
  TemplateConfigError,
  OutputPathExistsError,
  OutputParentMissingError,
  MissingRequiredInputError,
  InvalidInputValueError,
  ConditionSyntaxError,
  RenameConflictError,
} from "@/lib/errors";

// Types
export type { ITemplateConfig } from "@/types/ITemplateConfig";
export type {
  MouldInputItemDefinition,
  MouldInputType,
} from "@/types/MouldInputItemDefinition";
export type {
  TemplateSubstitutionList,
  TemplateSubstitution,
} from "@/types/TemplateSubstitutionList";
