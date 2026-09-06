import { MouldError } from "./MouldError";

/** A `when` expression or `mould:if` block is malformed. */
export class ConditionSyntaxError extends MouldError {
  public readonly expression: string;
  public readonly file: string | undefined;
  public readonly line: number | undefined;

  public constructor(
    reason: string,
    expression: string,
    location?: { file?: string; line?: number },
  ) {
    const where: string =
      location?.file !== undefined
        ? ` (${location.file}${location.line !== undefined ? `:${location.line}` : ""})`
        : "";
    super(`${reason}${where}: ${JSON.stringify(expression)}`);
    this.expression = expression;
    this.file = location?.file;
    this.line = location?.line;
  }
}
