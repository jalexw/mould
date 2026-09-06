import { MouldError } from "./MouldError";

/** The parent directory of the requested output path does not exist. */
export class OutputParentMissingError extends MouldError {
  public readonly outputPath: string;

  public constructor(outputPath: string, cause?: unknown) {
    super(
      `Cannot create output path '${outputPath}' because its parent directory does not exist!`,
      { cause },
    );
    this.outputPath = outputPath;
  }
}
