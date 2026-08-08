import type { IExportTemplateOptions } from "./IExportTemplateOptions";
import type { ITemplateConfig } from "./ITemplateConfig";

export interface ITemplate {
  export: (
    opts: Pick<IExportTemplateOptions, "output_path" | "input_values">,
  ) => Promise<void>;
  loadConfig: () => Promise<ITemplateConfig>;
  hasConfig: boolean;
  name: string;
  path: string;
}
