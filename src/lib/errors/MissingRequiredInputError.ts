import { MouldError } from "./MouldError";

/** One or more required inputs were not supplied. */
export class MissingRequiredInputError extends MouldError {
  public readonly inputIds: readonly string[];

  public constructor(inputIds: readonly string[]) {
    super(
      `Missing required input${inputIds.length === 1 ? "" : "s"} for mould template: ${inputIds
        .map((id: string): string => `'${id}'`)
        .join(", ")}`,
    );
    this.inputIds = inputIds;
  }
}
