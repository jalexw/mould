import type { ITemplate } from "@/types/ITemplate";
import type { ITemplateSourceDirectory } from "@/types/ITemplateSourceDirectory";
import { readdir } from "fs/promises";
import Template from "@/lib/Template";
import { join } from "path";

export class TemplateSourceDirectory implements ITemplateSourceDirectory {
  public readonly path: string;

  public constructor(path: string) {
    this.path = path;
  }

  public async listTemplates(): Promise<readonly ITemplate[]> {
    // Only subdirectories are templates; loose files in a source directory
    // (a stray '.DS_Store', a README) are not.
    const children = await readdir(this.path, { withFileTypes: true });
    return children
      .filter((child) => child.isDirectory())
      .map(
        (child): ITemplate =>
          new Template(child.name, join(this.path, child.name)),
      );
  }
}

export default TemplateSourceDirectory;
