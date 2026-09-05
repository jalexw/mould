import type { ITemplate } from "@/types/ITemplate";
import { type ITemplateConfig } from "@/types/ITemplateConfig";
import type { ITemplateFile } from "@/types/ITemplateFile";
import type { ITemplateDirectory } from "@/types/ITemplateDirectory";
import { readFile } from "fs/promises";
import { join } from "path";
import gatherFilesInTemplate, {
  type ITemplateEntryCandidate,
  type ShouldIgnorePathFn,
} from "./gatherFilesInTemplate";
import {
  compileIgnorePatterns,
  type IgnorePatternMatcher,
} from "@/lib/IgnorePatterns";
import exportTemplate from "./exportTemplate";
import { existsSync } from "fs";
import MouldTemplateConfig from "@/lib/MouldTemplateConfig";
import type {
  IExportTemplateOptions,
  IExportTemplateResult,
} from "@/types/IExportTemplateOptions";
import templateConfigSchema from "@/schemas/templateConfigSchema";
import type { ICreateMinimalTemplateOptions } from "./createMinimalTemplate";
import { TemplateConfigError } from "@/lib/errors";
import {
  evaluateConditionExpression,
  validateCondition,
  validateConditionalBlocks,
} from "@/lib/Conditions";

export class Template implements ITemplate {
  public readonly name: string;
  public readonly path: string;
  private readonly debug: boolean = process.env.NODE_ENV === "development";

  public constructor(name: string, path: string) {
    this.name = name;
    this.path = path;
  }

  protected get configPath(): string {
    return join(this.path, ".mouldconfig.json");
  }

  public get hasConfig(): boolean {
    const doesConfigFileExist: boolean = existsSync(this.configPath);
    return doesConfigFileExist;
  }

  public async loadConfig(): Promise<ITemplateConfig> {
    if (!(this.hasConfig satisfies boolean)) {
      throw new Error(
        `Configuration does not appear to exist for template: '${this.name}' from '${this.path}'`,
      );
    }
    const configPath: string = this.configPath;
    const configFileData = await readFile(configPath, { encoding: "utf-8" });
    let config: unknown;
    try {
      config = JSON.parse(configFileData);
    } catch (e: unknown) {
      throw new TemplateConfigError(configPath, e);
    }
    const parsed = await templateConfigSchema.safeParseAsync(config);
    if (!parsed.success) {
      throw new TemplateConfigError(configPath, parsed.error);
    }
    if (this.debug) {
      console.log(`Template<"${this.name}"> config: `, parsed.data);
    }
    // Surface a mistyped `when` before anything is written
    for (const entry of parsed.data.conditionalPaths ?? []) {
      validateCondition(entry.when, parsed.data.inputs ?? [], {
        file: configPath,
      });
    }
    return parsed.data;
  }

  /** The config to export with: the parsed file, or the empty default */
  public async loadConfigOrDefault(): Promise<ITemplateConfig> {
    if (this.hasConfig) {
      return await this.loadConfig();
    }
    return Template.defaultTemplateConfig;
  }

  /**
   * Entries that are never copied, whatever the template's config says:
   * mould's own metadata file, OS clutter, and installed dependencies.
   */
  protected shouldHideInputTemplateFile(filename: string): boolean {
    if (filename === ".DS_Store") {
      return true;
    } else if (filename === ".mouldconfig.json") {
      return true;
    } else if (filename === "node_modules") {
      return true;
    }
    return false;
  }

  protected async listTemplateFiles(
    config: ITemplateConfig,
    input_values: Readonly<Record<string, string>>,
  ): Promise<{
    files: readonly (ITemplateFile | ITemplateDirectory)[];
    skipped: readonly string[];
  }> {
    const template: ITemplate = this;
    const matchesIgnorePattern: IgnorePatternMatcher = compileIgnorePatterns(
      config.ignorePatterns,
    );

    // Every `conditionalPaths` entry whose condition is false becomes an
    // additional ignore matcher; the entries it prunes are reported back.
    const inactiveMatchers: readonly IgnorePatternMatcher[] = (
      config.conditionalPaths ?? []
    )
      .filter((entry) => !evaluateConditionExpression(entry.when, input_values))
      .map((entry) => compileIgnorePatterns(entry.paths));
    const skipped: string[] = [];

    const ignore: ShouldIgnorePathFn = (
      candidate: ITemplateEntryCandidate,
    ): boolean => {
      if (this.shouldHideInputTemplateFile(candidate.name)) {
        return true;
      }
      const ignored: boolean = matchesIgnorePattern(candidate);
      if (ignored) {
        if (this.debug) {
          console.log(
            `Template<"${this.name}"> ignoring '${candidate.relativePath.join("/")}' (matched an 'ignorePatterns' entry)`,
          );
        }
        return true;
      }
      for (const matcher of inactiveMatchers) {
        if (matcher(candidate)) {
          skipped.push(candidate.relativePath.join("/"));
          if (this.debug) {
            console.log(
              `Template<"${this.name}"> skipping '${candidate.relativePath.join("/")}' (its 'conditionalPaths' condition is false)`,
            );
          }
          return true;
        }
      }
      return false;
    };
    const files = await gatherFilesInTemplate(template, ignore);
    return { files, skipped };
  }

  protected static get defaultTemplateConfig(): ITemplateConfig {
    return MouldTemplateConfig.default;
  }

  public async export({
    output_path,
    input_values,
    onWarning,
  }: IExportTemplateOptions): Promise<IExportTemplateResult> {
    if (this.debug) {
      console.log(
        `Template<"${this.name}"> exporting to '${output_path}' with values: `,
        input_values,
      );
    }

    const config: ITemplateConfig = await this.loadConfigOrDefault();

    if (this.debug) {
      console.log(`Template<"${this.name}"> configuration: `, config);
    }

    const { files, skipped } = await this.listTemplateFiles(config, input_values);

    // Validate every conditional block before writing anything, so a malformed
    // marker cannot leave a half-written output directory behind.
    for (const file of files) {
      if (file.type !== "file") continue;
      const buffer: Buffer = file.readBuffer();
      if (buffer.subarray(0, 8000).includes(0)) continue;
      validateConditionalBlocks(
        buffer.toString("utf-8"),
        config.inputs ?? [],
        file.relativePath.join("/"),
      );
    }

    const result: IExportTemplateResult = await exportTemplate({
      config,
      files,
      output_path,
      input_values,
      skipped_files: skipped,
      onWarning,
    });

    if (this.debug) {
      console.log(
        `Template<"${this.name}"> exported successfully to '${output_path}'...`,
      );
    }

    return result;
  }

  public static async createMinimalTemplate(opts: ICreateMinimalTemplateOptions): Promise<string> {
    const createMinimalTemplateFn = await import('./createMinimalTemplate').then(mod => mod.default);
    return await createMinimalTemplateFn(opts)
  }
}
