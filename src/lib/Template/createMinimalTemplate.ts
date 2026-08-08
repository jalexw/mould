import { existsSync } from "fs";
import { mkdir, writeFile } from "fs/promises";
import { join } from "path";
import type { ITemplateConfig } from "@/types/ITemplateConfig";
import templateConfigSchema from "@/schemas/templateConfigSchema";

export const mouldConfigFileName = ".mouldconfig.json" as const;

export const mouldConfigJsonSchemaUrl =
  "https://jalexw.github.io/mould/openapi/mouldconfig.json" as const;

export interface ICreateMinimalTemplateOptions {
  template_path: string;
}

/**
 * Scaffold a new, minimal mould template directory containing only a
 * '.mouldconfig.json' file pointing at the published JSON Schema.
 *
 * @returns the absolute-or-relative path of the written '.mouldconfig.json'
 */
export async function createMinimalTemplate({
  template_path,
}: ICreateMinimalTemplateOptions): Promise<string> {
  if (typeof template_path !== "string" || !template_path) {
    throw new TypeError(
      "Expected a non-empty path for the mould template to scaffold!",
    );
  }

  if (existsSync(template_path)) {
    throw new Error(
      `Can't scaffold a mould template at '${template_path}' because something already exists there!`,
    );
  }

  const config: ITemplateConfig = templateConfigSchema.parse({
    $schema: mouldConfigJsonSchemaUrl,
    inputs: [],
  } satisfies ITemplateConfig);

  await mkdir(template_path, { recursive: true });

  const configPath: string = join(template_path, mouldConfigFileName);
  await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`, {
    encoding: "utf-8",
  });

  return configPath;
}

export default createMinimalTemplate;
