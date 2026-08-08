import { z } from "zod";

export const templateSubstitutionsList = z
  .tuple([
    z.string().describe("The pattern to replace"),
    z.string().describe("The value to insert where replaced values are"
  )])
  .array()
  .nonempty()
  .readonly()
  .describe(
    "Provide a list of substitutions, where each substitution is: [pattern_to_replace, id_of_input_to_replace_with]",
  );

export type TemplateSubstitutionList = z.infer<typeof templateSubstitutionsList>;
