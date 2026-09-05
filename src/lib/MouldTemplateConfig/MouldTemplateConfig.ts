import {
  type ITemplateConfig,
} from "@/types/ITemplateConfig";
import type { MouldInputItemDefinition } from "@/types/MouldInputItemDefinition";
import type { TemplateSubstitutionList } from "@/types/TemplateSubstitutionList";
import templateConfigSchema from "@/schemas/templateConfigSchema";

interface ITemplateConfigConstructorOpts {
  data: ITemplateConfig;
}

/**
 * @name MouldTemplateConfig
 * @description Configuration for a single `mould` template
 * @file Usually parsed from a `.mouldconfig.json`
 */
export class MouldTemplateConfig implements ITemplateConfig {
  private static readonly schema = templateConfigSchema;
  private _inputs: readonly MouldInputItemDefinition[] | undefined;
  private _substitutions: TemplateSubstitutionList | undefined;
  private _ignorePatterns: readonly string[] | undefined;
  private _renames: ITemplateConfig["renames"];
  private _conditionalPaths: ITemplateConfig["conditionalPaths"];

  private constructor(opts: ITemplateConfigConstructorOpts) {
    const parsed = MouldTemplateConfig.safeParse(opts.data)
    if (!parsed.success) {
      throw new TypeError("Failed to initialize from the 'data' field supplied in TemplateConfig constructor!", {
        cause: parsed.error
      });
    }
    const { inputs, substitutions, ignorePatterns, renames, conditionalPaths } = parsed.data;
    this._inputs = inputs;
    this._substitutions = substitutions;
    this._ignorePatterns = ignorePatterns;
    this._renames = renames;
    this._conditionalPaths = conditionalPaths;
  }

  public static get default(): MouldTemplateConfig {
    return new MouldTemplateConfig({
      data: {}
    });
  }

  public get inputs(): readonly MouldInputItemDefinition[] | undefined {
    return this._inputs;
  }

  public get substitutions(): TemplateSubstitutionList | undefined {
    return this._substitutions;
  }

  public get ignorePatterns(): readonly string[] | undefined {
    return this._ignorePatterns;
  }

  public get renames(): ITemplateConfig["renames"] {
    return this._renames;
  }

  public get conditionalPaths(): ITemplateConfig["conditionalPaths"] {
    return this._conditionalPaths;
  }

  private static safeParse(maybeConfig: unknown) {
    return MouldTemplateConfig.schema.safeParse(maybeConfig);
  }

  public static isValidConfig(
    maybeConfig: unknown,
  ): maybeConfig is ITemplateConfig {
    if (MouldTemplateConfig.safeParse(maybeConfig).success) {
      return true;
    }
    return false;
  }
}

export default MouldTemplateConfig;
