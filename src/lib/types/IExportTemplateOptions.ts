export interface IExportTemplateOptions {
  output_path: string;
  /** Resolved input values (see `resolveInputs`) — booleans already stringified */
  input_values: Record<string, string>;
  /** Receives non-fatal notices, e.g. a `renames` key that matched nothing */
  onWarning?: (message: string) => void;
}

export interface IExportTemplateResult {
  /** Output-relative, `/`-separated paths of every file written, in write order */
  writtenFiles: readonly string[];
  /** Template-relative, `/`-separated paths pruned by `conditionalPaths` */
  skippedFiles: readonly string[];
}
