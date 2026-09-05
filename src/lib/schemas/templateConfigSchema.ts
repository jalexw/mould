import { string, object }  from "zod";
import { templateSubstitutionsList } from "@/schemas/templateSubstitutionList";
import { mouldInputItemDefinition } from "@/schemas/mouldInputItemDefinition";


export const templateConfigSchema = object({
    $schema: string().optional(),
    inputs: mouldInputItemDefinition
      .array()
      .readonly()
      .describe(
        "Provide a list of inputs to be collected when generating with the mould template",
      )
      .optional(),
    substitutions: templateSubstitutionsList.optional(),
    ignorePatterns: string()
      .array()
      .readonly()
      .describe(
        "Gitignore-style patterns (e.g. 'dist/', 'node_modules/', '*.log', 'src/generated/**') for files and directories in the template that should not be copied to the output. Patterns without a '/' match an entry name at any depth; a trailing '/' matches directories only; a leading '/' anchors the pattern to the template root.",
      )
      .optional(),
  })
  .strict();

export default templateConfigSchema;
