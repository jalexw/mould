import { MouldError } from "./MouldError";

/** Two template entries would be written to the same output path. */
export class RenameConflictError extends MouldError {
  public readonly outputPath: string;

  public constructor(outputPath: string, sources: readonly string[]) {
    super(
      `Rename conflict: '${outputPath}' would be written from more than one template entry (${sources
        .map((s: string): string => `'${s}'`)
        .join(", ")})`,
    );
    this.outputPath = outputPath;
  }
}
