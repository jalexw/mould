import type { ITemplate } from "@/types/ITemplate";
import type { ITemplateSourceDirectory } from "@/types/ITemplateSourceDirectory";
import Template from "@/lib/Template";
import { basename } from "path";

/**
 * A source that resolves to exactly one template — the directory it points at.
 *
 * `templates` entries in a 'template-sources.json' file name a template
 * directly, unlike `templatesDirectories` entries, whose *children* are the
 * templates.
 */
export class ExplicitTemplateSourceDirectory implements ITemplateSourceDirectory {
  public readonly path: string;

  public constructor(path: string) {
    this.path = path;
  }

  public async listTemplates(): Promise<readonly ITemplate[]> {
    return [new Template(basename(this.path), this.path)];
  }
}

export default ExplicitTemplateSourceDirectory;
