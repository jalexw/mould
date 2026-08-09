import { z }  from "zod";

export const mouldTemplateSourcesJsonFileSchema = z.object({
  $schema: z.string().optional(),
  templatesDirectories: z.string()
    .describe(
      "The path to a directory where each subdirectory is presumed to be a template"
  )
    .array()
    .describe("A list of paths to directories where each directory's subdirectories are presumed to be a template"),
  templates: z.string()
    .describe(
      "The absolute path to a template"
  )
    .array()
    .describe("A list of absolute paths to templates")
})
  .required({
    templatesDirectories: true,
    templates: true
  })
  .strict();

export default mouldTemplateSourcesJsonFileSchema;

export type MouldTemplateSourcesConfigFile = z.infer<typeof mouldTemplateSourcesJsonFileSchema>;
