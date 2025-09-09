import type { ITemplate } from "@/types/ITemplate";
import {
  type ITemplateConfig,
  templateConfigSchema,
} from "@/types/ITemplateConfig";
import type { ITemplateDirectory, ITemplateFile } from "@/types/ITemplateFile";
import { readFile } from "fs/promises";
import { join } from "path";
import gatherFilesInTemplate from "./gatherFilesInTemplate";
import exportTemplate from "./exportTemplate";
import { existsSync } from "fs";
import TemplateConfig from "./TemplateConfig";
import type { IExportTemplateOptions } from "@/types/IExportTemplateOptions";

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
    const config: unknown = JSON.parse(configFileData);
    const parsed = await templateConfigSchema.safeParseAsync(config);
    if (parsed.success) {
      if (this.debug) {
        console.log(`Template<"${this.name}"> config: `, parsed.data);
      }
      return parsed.data;
    } else {
      throw parsed.error;
    }
  }

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

  protected async listTemplateFiles(): Promise<
    readonly (ITemplateFile | ITemplateDirectory)[]
  > {
    const template: ITemplate = this;
    const ignore: (pathSegment: string) => boolean = (
      pathSegment: string,
    ): boolean => {
      return this.shouldHideInputTemplateFile(pathSegment);
    };
    return await gatherFilesInTemplate(template, ignore);
  }

  protected static get defaultTemplateConfig(): ITemplateConfig {
    return TemplateConfig.default;
  }

  public async export({
    output_path,
    input_values,
  }: IExportTemplateOptions): Promise<void> {
    if (this.debug) {
      console.log(
        `Template<"${this.name}"> exporting to '${output_path}' with values: `,
        input_values,
      );
    }

    let config: ITemplateConfig;
    if (this.hasConfig) {
      config = await this.loadConfig();
    } else {
      config = Template.defaultTemplateConfig;
    }

    if (this.debug) {
      console.log(`Template<"${this.name}"> configuration: `, config);
    }

    const files: readonly (ITemplateFile | ITemplateDirectory)[] =
      await this.listTemplateFiles();

    if (this.debug) {
      console.log(
        `Template<"${this.name}"> exported successfully to '${output_path}'...`,
      );
    }

    await exportTemplate({ config, files, output_path, input_values });

    if (this.debug) {
      console.log(
        `Template<"${this.name}"> exported successfully to '${output_path}'...`,
      );
    }
  }
}
