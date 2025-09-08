import type { ITemplate } from "@/types/ITemplate";
import type { ITemplateSourceDirectory } from "@/types/ITemplateSourceDirectory";
import { readdir } from "fs/promises";
import { existsSync } from "fs";
import { Template } from "./Template";
import { join } from "path";

export class TemplateSourceDirectory implements ITemplateSourceDirectory {
  public readonly path: string;

  public constructor(path: string) {
    this.path = path;
  }

  public async listTemplates(): Promise<readonly ITemplate[]> {
    const childrenFiles: readonly string[] = await readdir(this.path);
    const childPath: ITemplate[] = childrenFiles.map(
      (templateName: string): ITemplate => {
        return new Template(templateName, join(this.path, templateName));
      },
    );
    return childPath;
  }
}

export default TemplateSourceDirectory;
