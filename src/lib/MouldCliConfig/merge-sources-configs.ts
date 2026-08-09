import { MouldTemplateSourcesConfigFile } from "@/types/MouldTemplateSourcesConfigFile"
import jsonSchemaUrl from "./templateSourcesJsonSchemaUrl"
import minimalTemplateSourcesFile from "./minimal-template-sources-file";

export default function mergeSourcesConfigs(...configs: readonly MouldTemplateSourcesConfigFile[]): MouldTemplateSourcesConfigFile {
  if (configs.length === 0) {
    return minimalTemplateSourcesFile;
  } else if (configs.length === 1 && configs[0]) {
    return {
      "$schema": jsonSchemaUrl,
      templatesDirectories: configs[0].templatesDirectories,
      templates: configs[0].templates
    }
  } else {
    const templates = new Set<string>();
    const templatesDirectories = new Set<string>();

    for (const config of configs) {
      for (const templatePath of config.templates) {
        templates.add(templatePath);
      }
      for (const templatesDirectoryPath of config.templatesDirectories) {
        templatesDirectories.add(templatesDirectoryPath)
      }
    }

    return {
      ["$schema"]: jsonSchemaUrl,
      templates: [...templates.values()],
      templatesDirectories: [...templatesDirectories.values()]
    }
  }
}
