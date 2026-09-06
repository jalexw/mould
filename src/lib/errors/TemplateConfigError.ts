import { MouldError } from "./MouldError";

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
