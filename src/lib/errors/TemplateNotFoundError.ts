import { MouldError } from "./MouldError";

/** The template path is not a directory / no template with that name exists. */
export class TemplateNotFoundError extends MouldError {
  public readonly templatePath: string;

  public constructor(templatePath: string, message?: string) {
    super(message ?? `Failed to find a mould template at '${templatePath}'`);
    this.templatePath = templatePath;
  }
}
