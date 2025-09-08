import { z } from "zod";

export const templateConfigSchema = z.object({}).required().strict();

export type ITemplateConfig = z.infer<typeof templateConfigSchema>;
