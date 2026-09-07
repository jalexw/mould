import { MouldError } from "./MouldError";

/** A supplied input value is not acceptable for its declared type. */
export class InvalidInputValueError extends MouldError {
  public readonly inputId: string;
  public readonly value: string;

  public constructor(inputId: string, value: string, reason: string) {
    super(`Invalid value '${value}' for input '${inputId}': ${reason}`);
    this.inputId = inputId;
    this.value = value;
  }
}
