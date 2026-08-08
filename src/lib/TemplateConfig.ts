import {
  type ITemplateConfig,
} from "@/types/ITemplateConfig";
import type { MouldInputItemDefinition } from "@/types/MouldInputItemDefinition";
import type { TemplateSubstitutionList } from "@/types/TemplateSubstitutionList";
import templateConfigSchema from "@/schemas/templateConfigSchema";

interface ITemplateConfigConstructorOpts {
  inputs?: readonly MouldInputItemDefinition[] | undefined;
  substitutions?: TemplateSubstitutionList | undefined;
}

export class TemplateConfig implements ITemplateConfig {
  private _inputs: readonly MouldInputItemDefinition[] | undefined;
  private _substitutions: TemplateSubstitutionList | undefined;

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

  public get substitutions(): TemplateSubstitutionList | undefined {
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
