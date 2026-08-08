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
  })
  .strict();

export default templateConfigSchema;
