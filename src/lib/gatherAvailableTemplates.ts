import type { ITemplate } from "@/types/ITemplate";
import type { ITemplateSourceDirectory } from "@/types/ITemplateSourceDirectory";

async function gatherAvailableTemplates(
  templateSourceDirectories: readonly ITemplateSourceDirectory[],
): Promise<readonly ITemplate[]> {
  const templates: readonly (readonly ITemplate[])[] = await Promise.all(
    templateSourceDirectories.map(async (dir) => await dir.listTemplates()),
  );
  return [...templates.flat()];
}

export default gatherAvailableTemplates;
