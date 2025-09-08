import type { ITemplateConfig } from "@/types/ITemplateConfig";

export class TemplateConfig implements ITemplateConfig {
  public static get default(): TemplateConfig {
    return new TemplateConfig();
  }
}

export default TemplateConfig;
