import {
  templateConfigSchema,
  type ITemplateConfig,
  type MouldInputItemDefinition,
  type TemplateSubstitutionsList,
} from "@/types/ITemplateConfig";

interface ITemplateConfigConstructorOpts {
  inputs?: readonly MouldInputItemDefinition[] | undefined;
  substitutions?: TemplateSubstitutionsList | undefined;
}

export class TemplateConfig implements ITemplateConfig {
  private _inputs: readonly MouldInputItemDefinition[] | undefined;
  private _substitutions: TemplateSubstitutionsList | undefined;

  private constructor({
    inputs,
    substitutions,
  }: ITemplateConfigConstructorOpts) {
    this._inputs = inputs;
    this._substitutions = substitutions;
  }

  public static get default(): TemplateConfig {
    return new TemplateConfig({});
  }

  public get inputs(): readonly MouldInputItemDefinition[] | undefined {
    return this._inputs;
  }

  public get substitutions(): TemplateSubstitutionsList | undefined {
    return this._substitutions;
  }

  public static isValidConfig(
    maybeConfig: unknown,
  ): maybeConfig is ITemplateConfig {
    if (templateConfigSchema.safeParse(maybeConfig).success) {
      return true;
    }
    return false;
  }
}

export default TemplateConfig;
