import { z } from "zod";
import templateConfigSchema from "@/schemas/templateConfigSchema";


export type ITemplateConfig = z.infer<typeof templateConfigSchema>;
