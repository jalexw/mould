import type { IExportTemplateOptions } from "./IExportTemplateOptions";
import type { ITemplateConfig } from "./ITemplateConfig";

export interface ITemplate {
  export: (opts: Pick<IExportTemplateOptions, "output_path">) => Promise<void>;
  loadConfig: () => Promise<ITemplateConfig>;
  name: string;
  path: string;
}
