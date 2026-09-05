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

/** The template path is not a directory / no template with that name exists. */
export class TemplateNotFoundError extends MouldError {
  public readonly templatePath: string;

  public constructor(templatePath: string, message?: string) {
    super(message ?? `Failed to find a mould template at '${templatePath}'`);
    this.templatePath = templatePath;
  }
}

/** The template's `.mouldconfig.json` failed validation (see `cause`). */
export class TemplateConfigError extends MouldError {
  public readonly configPath: string;

  public constructor(configPath: string, cause: unknown) {
    super(`Invalid mould template configuration at '${configPath}'`, {
      cause,
    });
    this.configPath = configPath;
  }
}

/** Something already exists at the requested output path. */
export class OutputPathExistsError extends MouldError {
  public readonly outputPath: string;

  public constructor(outputPath: string) {
    super(`Output path '${outputPath}' already exists!`);
    this.outputPath = outputPath;
  }
}

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
