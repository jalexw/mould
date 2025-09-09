import { z } from "zod";

const mouldInputTypes = ["text"] as const satisfies readonly string[];

type MouldInputType = (typeof mouldInputTypes)[number];

const mouldInputsItemDefinition = z
  .object({
    label: z.string(),
    id: z.string(),
    description: z.string().optional(),
    required: z.boolean(),
    type: z
      .string()
      .refine((str): str is MouldInputType =>
        (
          mouldInputTypes satisfies readonly string[] as readonly string[]
        ).includes(str),
      ),
  })
  .required({
    label: true,
    id: true,
    required: true,
    type: true,
  })
  .strict();

export type MouldInputItemDefinition = z.infer<
  typeof mouldInputsItemDefinition
>;

export const templateSubstitutionsList = z
  .tuple([z.string(), z.string()])
  .array()
  .nonempty()
  .readonly()
  .describe(
    "Provide a list of substitutions, where each substitution is: [pattern_to_replace, id_of_input_to_replace_with]",
  );

export type TemplateSubstitutionsList = z.infer<
  typeof templateSubstitutionsList
>;

export const templateConfigSchema = z
  .object({
    $schema: z.string().optional(),
    inputs: mouldInputsItemDefinition
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

export type ITemplateConfig = z.infer<typeof templateConfigSchema>;
