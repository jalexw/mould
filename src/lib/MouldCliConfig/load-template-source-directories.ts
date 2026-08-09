import TemplateSourceDirectory, {
  ExplicitTemplateSourceDirectory,
} from "@/lib/TemplateSourceDirectory";
import type { ITemplateSourceDirectory } from "@/types/ITemplateSourceDirectory";
import type { MouldTemplateSourcesConfigFile } from "@/types/MouldTemplateSourcesConfigFile";

export function loadTemplateSourceDirectories(
  config: MouldTemplateSourcesConfigFile,
): readonly ITemplateSourceDirectory[] {
  const templateSourceDirectoryRefs: ITemplateSourceDirectory[] = [];

  // Each entry names a single template
  for (const templatePath of new Set(config.templates)) {
    templateSourceDirectoryRefs.push(
      new ExplicitTemplateSourceDirectory(templatePath),
    );
  }

  // Each entry names a directory whose subdirectories are the templates
  for (const templatesDirectory of new Set(config.templatesDirectories)) {
    templateSourceDirectoryRefs.push(
      new TemplateSourceDirectory(templatesDirectory),
    );
  }

  return templateSourceDirectoryRefs;
}
