import { Command } from "commander";
import type { IMouldCommandLineInterface } from "@/types/IMouldCommandLineInterface";
import version from "@/lib/version";
import TemplateSourceDirectory from "@/lib/TemplateSourceDirectory";
import { join } from "path";
import loadTemplateSourceDirectoriesListedInConfig from "@/lib/loadTemplateSourceDirectoriesListedInConfig";
import gatherAvailableTemplates from "@/lib/gatherAvailableTemplates";
import type { ITemplate } from "@/types/ITemplate";
import searchForTemplate from "@/lib/searchForTemplate";
import { ITemplateSourceDirectory } from "@/types/ITemplateSourceDirectory";
import { existsSync, lstatSync } from "fs";
import {
  ITemplateConfig,
  MouldInputItemDefinition,
  TemplateSubstitutionsList,
} from "@/types/ITemplateConfig";

export interface IMouldCommandLineInterfaceConstructorOpts {
  mouldAppDir: string;
}

export class MouldCommandLineInterface implements IMouldCommandLineInterface {
  private program: Command;
  private readonly mouldAppDir: string;

  private static loadTemplateSourceDirectories(
    mouldAppDir: string,
  ): readonly TemplateSourceDirectory[] {
    const sources: TemplateSourceDirectory[] = [];
    const templateSourcesFilePath = join(mouldAppDir, "template-sources.json");
    try {
      const sourcesSpecifiedInConfig: readonly TemplateSourceDirectory[] =
        loadTemplateSourceDirectoriesListedInConfig(templateSourcesFilePath);
      sources.push(...sourcesSpecifiedInConfig);
    } catch (e: unknown) {
      console.warn(
        "⚠️ Failed to load directories to search for templates in from 'template-sources.json' file!",
      );
    }
    return sources;
  }

  private readonly templateSrcs: readonly TemplateSourceDirectory[];

  private addSetupMouldCliCommand(): void {
    this.program
      .command("setup")
      .description("⚙️▶️ Run initial configuration steps for @jalexw/mould")
      .action(() => {
        console.error("Unimplemented");
        process.exit(1);
      });
  }

  private addUseTemplateCommand(): void {
    const useCommand = this.program
      .command("use")
      .description(
        "🏭 Load, apply substitutions, & output a configured template",
      )
      .argument("<template_name>", "Template name to use")
      .argument("<output_path>", "Output location")
      .option(
        "--ts, --template-sources <SOURCES>",
        "comma-separated list of paths to folders to search for templates. overrides ~/mould/template-sources.json config.",
      )
      .option(
        "-i, --input <KEYVALUEPAIRS...>",
        "space-separated value pairs input for mould (e.g. -i input_name_a=a input_name_b=foo)",
      );

    useCommand.action(
      async (
        template_name: string,
        output_path: string,
        opts: unknown,
      ): Promise<void> => {
        if (
          typeof template_name !== "string" ||
          typeof output_path !== "string"
        ) {
          return useCommand.help();
        }

        const defaultTemplateSources: readonly ITemplateSourceDirectory[] =
          this.templateSrcs;

        let templateSources: readonly ITemplateSourceDirectory[] =
          defaultTemplateSources;

        if (
          typeof opts === "object" &&
          !!opts &&
          "templateSources" in opts &&
          typeof opts.templateSources === "string"
        ) {
          const customTemplateSources: string = opts.templateSources;
          const sourcePaths: readonly string[] =
            customTemplateSources.split(",");
          if (
            !sourcePaths.every((templateSourcePath: string): boolean => {
              return (
                existsSync(templateSourcePath) &&
                lstatSync(templateSourcePath).isDirectory()
              );
            })
          ) {
            throw new Error(
              "Received --template-sources flag with unresolvable template source directories!",
            );
          }
          templateSources = sourcePaths.map(
            (p) => new TemplateSourceDirectory(p),
          );
        }

        let template: ITemplate;
        try {
          template = await searchForTemplate({
            templateSources,
            searchCriteria: { name: template_name },
          });
        } catch (e: unknown) {
          console.error("Failed to load template to copy from: ", e);
          process.exit(1);
        }

        let config: ITemplateConfig | undefined = undefined;
        if (template.hasConfig) {
          config = await template.loadConfig();
        }

        // Parsed input options from console arg
        const input_values: Record<string, string> = {};

        if (
          typeof opts === "object" &&
          !!opts &&
          "input" in opts &&
          Array.isArray(opts.input) &&
          opts.input.every((i): i is string => typeof i === "string" && !!i)
        ) {
          opts.input.forEach((i: string) => {
            const splitByEquals: string[] = i.split("=");
            if (
              splitByEquals.length !== 2 ||
              !splitByEquals[0] ||
              !splitByEquals[1]
            ) {
              throw new TypeError(
                "Failed to split argument to --input option into two parts by '=' symbol!",
              );
            }
            const key: string = splitByEquals[0];
            const value: string = splitByEquals[1];
            input_values[key] = value;
          });
        }

        if (config && config.inputs) {
          const inputs: readonly MouldInputItemDefinition[] = [
            ...config.inputs,
          ];

          let exitFromInvalidInputs: boolean = false;
          inputs.forEach((input) => {
            if (!(input.id in input_values)) {
              console.error(`Missing input '${input.id}' for mould template!`);
              exitFromInvalidInputs = true;
            }
          });
          if (exitFromInvalidInputs) {
            console.error(
              "Invalid inputs based on .mouldconfig.json for template!",
            );
            process.exit(1);
          }
        }

        await template.export({ output_path, input_values });
      },
    );
  }

  private addListSourcesCommand(): void {
    this.program
      .command("sources")
      .description("⚙️📁 List directories to be searched for templates")
      .action((): void => {
        console.log(this.templateSrcs.map((dir) => dir.path));
      });
  }

  private addListTemplatesCommand(): void {
    this.program
      .command("list")
      .description("🧩🧩🧩 List configured templates available for use")
      .action(async (): Promise<void> => {
        const templates: readonly ITemplate[] = await gatherAvailableTemplates(
          this.templateSrcs,
        );
        const formattedTemplatesData = templates.map((template) => ({
          name: template.name,
          path: template.path,
        }));
        console.table(formattedTemplatesData);
      });
  }

  private setupCommands(): void {
    this.addSetupMouldCliCommand();
    this.addUseTemplateCommand();
    this.addListTemplatesCommand();
    this.addListSourcesCommand();
  }

  public constructor(opts: IMouldCommandLineInterfaceConstructorOpts) {
    const mouldAppDir: string = opts.mouldAppDir;
    this.mouldAppDir = mouldAppDir;
    this.program = new Command();
    this.program.name("mould");
    this.program.description(
      "🧩🪄 Generate sample projects and insert code snippets from your configurable templates collection",
    );
    this.program.version(version(this.mouldAppDir));

    this.templateSrcs =
      MouldCommandLineInterface.loadTemplateSourceDirectories(mouldAppDir);

    this.setupCommands();
  }

  public async run(argv: readonly string[]): Promise<void> {
    const mould: Command = await this.program.parseAsync(argv);
    if (mould.args.length === 0) {
      return mould.help();
    }
  }
}

export default MouldCommandLineInterface;
