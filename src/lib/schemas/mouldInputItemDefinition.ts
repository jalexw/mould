import { z } from "zod";

/** The characters an input `id` may use, so it can appear in `when` expressions. */
export const mouldInputIdPattern = /^[A-Za-z_][A-Za-z0-9_]*$/;

const inputIdSchema = z
  .string()
  .regex(
    mouldInputIdPattern,
    "Input ids must start with a letter or underscore and contain only letters, digits and underscores",
  )
  .describe("The key used on the command line (`--input <id>=<value>`) and referenced by substitutions and conditions");

const baseFields = {
  id: inputIdSchema,
  label: z.string().describe("Shown as the interactive prompt"),
  description: z.string().optional().describe("Shown alongside the label when prompting"),
  required: z
    .boolean()
    .describe("Whether generation fails when no value (and no default) is available"),
} as const;

function compilesAsRegExp(source: string): boolean {
  try {
    new RegExp(source);
    return true;
  } catch {
    return false;
  }
}

export const mouldTextInputDefinition = z
  .object({
    ...baseFields,
    type: z.literal("text"),
    default: z.string().optional().describe("Value used when the input is not supplied"),
    pattern: z
      .string()
      .refine(compilesAsRegExp, "`pattern` must be a valid regular expression")
      .optional()
      .describe("Regular expression (anchor it yourself) a supplied value must match"),
  })
  .strict();

export const mouldSelectInputDefinition = z
  .object({
    ...baseFields,
    type: z.literal("select"),
    options: z
      .string()
      .array()
      .nonempty()
      .readonly()
      .describe("The values a caller may choose from"),
    default: z.string().optional().describe("Value used when the input is not supplied; must be one of `options`"),
  })
  .strict()
  .refine(
    (def) => def.default === undefined || def.options.includes(def.default),
    { message: "A select input's `default` must be one of its `options`", path: ["default"] },
  );

export const mouldBooleanInputDefinition = z
  .object({
    ...baseFields,
    type: z.literal("boolean"),
    default: z.boolean().optional().describe("Value used when the input is not supplied"),
  })
  .strict();

export const mouldInputTypes = ["text", "select", "boolean"] as const satisfies readonly string[];

export type MouldInputType = (typeof mouldInputTypes)[number];

export const mouldInputItemDefinition = z
  .discriminatedUnion("type", [
    mouldTextInputDefinition,
    mouldSelectInputDefinition,
    mouldBooleanInputDefinition,
  ])
  .describe("An input collected when generating from the template");

export type MouldInputItemDefinition = z.infer<typeof mouldInputItemDefinition>;
export type MouldTextInputDefinition = z.infer<typeof mouldTextInputDefinition>;
export type MouldSelectInputDefinition = z.infer<typeof mouldSelectInputDefinition>;
export type MouldBooleanInputDefinition = z.infer<typeof mouldBooleanInputDefinition>;
