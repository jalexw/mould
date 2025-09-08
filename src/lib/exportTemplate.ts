import type { ITemplateConfig } from "@/types/ITemplateConfig";
import type { ITemplateDirectory, ITemplateFile } from "@/types/ITemplateFile";
import { join } from "path";
import { mkdir, writeFile } from "fs/promises";
import { existsSync } from "fs";

export interface IExportTemplate {
  config: ITemplateConfig;
  files: readonly (ITemplateFile | ITemplateDirectory)[];
  output_path: string;
}

export async function exportTemplate({
  config,
  files,
  output_path,
}: IExportTemplate): Promise<void> {
  const outputPathAlreadyExists: boolean = existsSync(output_path);
  if (outputPathAlreadyExists) {
    console.error(`Output path '${output_path}' already exists!`);
    process.exit(1);
  }

  await mkdir(output_path);

  for (const file of files) {
    const newAbsolutePath = join(output_path, ...file.relativePath);
    if (file.type === "directory") {
      await mkdir(newAbsolutePath);
    } else {
      const contents: string = file.readUtf8();
      await writeFile(newAbsolutePath, contents, { encoding: "utf-8" });
    }
  }
}

export default exportTemplate;
