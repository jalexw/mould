import type {
  IExportTemplateOptions,
  IExportTemplateResult,
} from "./IExportTemplateOptions";
import type { ITemplateConfig } from "./ITemplateConfig";

export interface ITemplate {
  export: (opts: IExportTemplateOptions) => Promise<IExportTemplateResult>;
  loadConfig: () => Promise<ITemplateConfig>;
  hasConfig: boolean;
  name: string;
  path: string;
}
