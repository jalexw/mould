import { z } from "zod";

const mouldInputTypes = ["text"] as const satisfies readonly string[];

type MouldInputType = (typeof mouldInputTypes)[number];

export const mouldInputItemDefinition = z
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
  typeof mouldInputItemDefinition
>
