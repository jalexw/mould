import { z, string, object } from "zod";
import { templateSubstitutionsList } from "@/schemas/templateSubstitutionList";
import { mouldInputItemDefinition } from "@/schemas/mouldInputItemDefinition";
import { conditionalPathsEntry } from "@/schemas/conditionalPathsEntry";

/** A `/`-separated path relative to the template root: no leading `/`, no `..`, no trailing `/`. */
const relativePosixPath = string()
  .min(1)
  .refine(
    (path: string): boolean =>
      !path.startsWith("/") &&
      !path.startsWith("./") &&
      !path.endsWith("/") &&
      !path.split("/").includes("..") &&
      !path.split("/").includes(""),
    "Expected a relative, '/'-separated path with no leading or trailing '/' and no '..' segments",
  );

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
    renames: z
      .record(relativePosixPath, relativePosixPath)
      .describe(
        "Map of template-relative paths to the output-relative paths they are written to, e.g. { \"_gitignore\": \".gitignore\" }. A directory key renames its whole subtree.",
      )
      .optional(),
    conditionalPaths: conditionalPathsEntry
      .array()
      .readonly()
      .describe(
        "Files and directories that are only copied when a condition on the inputs holds, e.g. [{ \"when\": \"deployment == vercel\", \"paths\": [\"/vercel.json\"] }]",
      )
      .optional(),
  })
  .strict();

export type { ConditionalPathsEntry } from "@/schemas/conditionalPathsEntry";

export default templateConfigSchema;
