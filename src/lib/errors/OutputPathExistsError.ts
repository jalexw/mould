import { MouldError } from "./MouldError";

/** Something already exists at the requested output path. */
export class OutputPathExistsError extends MouldError {
  public readonly outputPath: string;

  public constructor(outputPath: string) {
    super(`Output path '${outputPath}' already exists!`);
    this.outputPath = outputPath;
  }
}
