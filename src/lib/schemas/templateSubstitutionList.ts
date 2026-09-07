import { z } from "zod";

/**
 * Legacy tuple form: `[pattern, input_id]`. The pattern is compiled as a
 * regular expression (`new RegExp(pattern, "g")`).
 */
export const templateSubstitutionTuple = z
  .tuple([
    z.string().describe("The regular expression to replace"),
    z.string().describe("The id of the input whose value is inserted"),
  ])
  .describe("[regex_pattern_to_replace, id_of_input_to_replace_with]");

/**
 * Object form: `{ find, input, regex? }`. `find` is matched literally unless
 * `regex` is `true`.
 */
export const templateSubstitutionObject = z
  .object({
    find: z.string().min(1).describe("The text to replace (literal unless `regex` is true)"),
    input: z.string().min(1).describe("The id of the input whose value is inserted"),
    regex: z
      .boolean()
      .default(false)
      .describe("Compile `find` as a regular expression instead of matching it literally"),
  })
  .strict();

export const templateSubstitution = z.union([
  templateSubstitutionTuple,
  templateSubstitutionObject,
]);

export const templateSubstitutionsList = templateSubstitution
  .array()
  .nonempty()
  .readonly()
  .describe(
    "Provide a list of substitutions. Each is either [regex_pattern, input_id] or { find, input, regex? }; the input's value is inserted literally wherever the pattern/text occurs in a copied file",
  );

export type TemplateSubstitution = z.infer<typeof templateSubstitution>;
export type TemplateSubstitutionList = z.infer<typeof templateSubstitutionsList>;

export interface NormalizedTemplateSubstitution {
  find: string;
  input: string;
  regex: boolean;
}

/** Collapse both accepted shapes into one. */
export function normalizeSubstitution(
  substitution: TemplateSubstitution,
): NormalizedTemplateSubstitution {
  if (Array.isArray(substitution)) {
    const [find, input] = substitution;
    return { find, input, regex: true };
  }
  return {
    find: substitution.find,
    input: substitution.input,
    regex: substitution.regex ?? false,
  };
}
