import type { ITemplate } from "@/types/ITemplate";

export interface ITemplateSourceDirectory {
  path: string;
  listTemplates: () => Promise<readonly ITemplate[]>;
}
