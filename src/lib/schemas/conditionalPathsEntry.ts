import { z, string, object } from "zod";

/**
 * One entry of a template's `conditionalPaths`: files and directories that
 * are only copied when a condition on the inputs holds.
 */
export const conditionalPathsEntry = object({
  when: string()
    .min(1)
    .describe(
      "Condition deciding whether `paths` are copied: `<input_id>`, `<input_id> == <value>` or `<input_id> != <value>`",
    ),
  paths: string()
    .array()
    .nonempty()
    .readonly()
    .describe("Gitignore-style patterns (same grammar as `ignorePatterns`) naming the files/directories that are only copied when `when` holds"),
}).strict();

export type ConditionalPathsEntry = z.infer<typeof conditionalPathsEntry>;

export default conditionalPathsEntry;
