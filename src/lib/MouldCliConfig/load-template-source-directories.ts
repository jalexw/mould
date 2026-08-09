import TemplateSourceDirectory from "@/lib/TemplateSourceDirectory";
import type { MouldTemplateSourcesConfigFile } from "@/types/MouldTemplateSourcesConfigFile";
import collectAllSubdirectories from "./collect-all-subdirectories";

export function loadTemplateSourceDirectories(
  config: MouldTemplateSourcesConfigFile,
): readonly TemplateSourceDirectory[] {
  const templateSourceDirectoryRefs: TemplateSourceDirectory[] = [];

  const templatePaths: Set<string> = new Set(config.templates);

  for (const templatesDirectory of config.templatesDirectories) {
    const subdirectories: readonly string[] = collectAllSubdirectories(templatesDirectory);
    for (const templateSubdirectory of subdirectories) {
      templatePaths.add(templateSubdirectory);
    }
  }

  for (const templatePath of templatePaths) {
    templateSourceDirectoryRefs.push(new TemplateSourceDirectory(templatePath))
  }

  return templateSourceDirectoryRefs;
}
