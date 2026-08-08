import {
  type ITemplateConfig,
} from "@/types/ITemplateConfig";
import type { MouldInputItemDefinition } from "@/types/MouldInputItemDefinition";
import type { TemplateSubstitutionList } from "@/types/TemplateSubstitutionList";
import templateConfigSchema from "@/schemas/templateConfigSchema";

interface ITemplateConfigConstructorOpts {
  data: ITemplateConfig;
}

export class TemplateConfig implements ITemplateConfig {
  private static readonly schema = templateConfigSchema;
  private _inputs: readonly MouldInputItemDefinition[] | undefined;
  private _substitutions: TemplateSubstitutionList | undefined;

  private constructor(opts: ITemplateConfigConstructorOpts) {
    const parsed = TemplateConfig.safeParse(opts.data)
    if (!parsed.success) {
      throw new TypeError("Failed to initialize from the 'data' field supplied in TemplateConfig constructor!", {
        cause: parsed.error
      });
    }
    const { inputs, substitutions } = parsed.data;
    this._inputs = inputs;
    this._substitutions = substitutions;
  }

  public static get default(): TemplateConfig {
    return new TemplateConfig({
      data: {}
    });
  }

  public get inputs(): readonly MouldInputItemDefinition[] | undefined {
    return this._inputs;
  }

  public get substitutions(): TemplateSubstitutionList | undefined {
    return this._substitutions;
  }

  private static safeParse(maybeConfig: unknown) {
    return TemplateConfig.schema.safeParse(maybeConfig);
  }

  public static isValidConfig(
    maybeConfig: unknown,
  ): maybeConfig is ITemplateConfig {
    if (TemplateConfig.safeParse(maybeConfig).success) {
      return true;
    }
    return false;
  }
}

export default TemplateConfig;
