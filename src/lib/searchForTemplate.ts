import type { ITemplate } from "@/types/ITemplate";
import gatherAvailableTemplates from "./gatherAvailableTemplates";
import type { ITemplateSourceDirectory } from "@/types/ITemplateSourceDirectory";

export interface ISearchForTemplateConfig {
  templateSources: readonly ITemplateSourceDirectory[];
  searchCriteria: { name: string };
}

async function searchForTemplate({
  templateSources,
  searchCriteria,
}: ISearchForTemplateConfig): Promise<ITemplate> {
  for (const sourceDirectory of templateSources) {
    const templates: readonly ITemplate[] =
      await sourceDirectory.listTemplates();
    const template: ITemplate | undefined = templates.find((template) => {
      if ("name" in searchCriteria && typeof searchCriteria.name === "string") {
        if (searchCriteria.name === template.name) {
          return true;
        }
      }
      return false;
    });
    if (template) {
      return template;
    }
  }
  throw new Error("Failed to resolve mould template using search criteria!");
}

export default searchForTemplate;
