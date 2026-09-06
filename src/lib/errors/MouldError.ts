/**
 * Error types thrown by mould's library code.
 *
 * Library code never calls `process.exit`; the CLI (`src/cli.ts`) catches
 * `MouldError` and turns it into an error message plus a non-zero exit code,
 * while programmatic callers (`applyTemplate`) receive it as a rejection.
 */
export class MouldError extends Error {
  public constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = new.target.name;
  }
}
