import type { MouldTemplateSourcesConfigFile } from "@/types/MouldTemplateSourcesConfigFile";
import mouldTemplateSourcesJsonFileSchema from "@/schemas/mouldTemplateSourcesJsonFileSchema";
import type { ITemplateSourceDirectory } from "@/types/ITemplateSourceDirectory";
import { loadTemplateSourceDirectories } from "./load-template-source-directories";
import mergeSourcesConfigs from "./merge-sources-configs";
import { writeFileSync } from "fs";
import minimalTemplateSourcesFile from "./minimal-template-sources-file";

export interface IMouldCliConfigConstructorOpts {
  sourcesConfig: MouldTemplateSourcesConfigFile
}

export class MouldCliConfig {
  private static readonly schema = mouldTemplateSourcesJsonFileSchema;
  private readonly sourcesConfig: MouldTemplateSourcesConfigFile;

  public static merge(...configs: readonly MouldTemplateSourcesConfigFile[]): MouldTemplateSourcesConfigFile {
    return mergeSourcesConfigs(...configs);
  }

  public merge(...restConfig: readonly MouldTemplateSourcesConfigFile[]): MouldTemplateSourcesConfigFile {
    return MouldCliConfig.merge(this.sourcesConfig, ...restConfig);
  }

  public serialize(): MouldTemplateSourcesConfigFile {
    return this.sourcesConfig;
  }

  public constructor(
    opts: IMouldCliConfigConstructorOpts
  ) {
    const parsed = MouldCliConfig.safeParse(opts.sourcesConfig);
    if (!parsed.success) {
      throw new TypeError(
        "Bad config for mould CLI",
        { cause: parsed.error }
      )
    }
    this.sourcesConfig = parsed.data;
  }

  public static safeParse(maybeValidConfig: unknown) {
    return MouldCliConfig.schema.safeParse(maybeValidConfig);
  }

  public get templateDirectories(): readonly string[] {
    return this.sourcesConfig.templatesDirectories;
  }

  public get templates(): readonly string[] {
    return this.sourcesConfig.templates
  }

  public loadTemplateSourceDirectories(): readonly ITemplateSourceDirectory[] {
    return loadTemplateSourceDirectories(this.sourcesConfig);
  }

  public static createMinimalTemplateSourcesFile(filepath: string): void {
    writeFileSync(filepath, JSON.stringify(minimalTemplateSourcesFile, null, 2));
    return;
  }
}

export default MouldCliConfig;
