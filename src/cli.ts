import { Command } from "commander";
import type { IMouldCommandLineInterface } from "@/types/IMouldCommandLineInterface";
import version from "@/lib/version";
import TemplateSourceDirectory from "@/lib/TemplateSourceDirectory";
import { join } from "path";
import type { ITemplate } from "@/types/ITemplate";
import { searchForTemplate, gatherAvailableTemplates } from "@/lib/Template";
import type { ITemplateSourceDirectory } from "@/types/ITemplateSourceDirectory";
import { existsSync, lstatSync, readFileSync, writeFileSync } from "fs";
import type {
  ITemplateConfig,
} from "@/types/ITemplateConfig";
import { createInterface } from "readline";
import type { MouldInputItemDefinition } from "@/types/MouldInputItemDefinition";
import { version as getPackageVersion } from "@/lib/version";
import Template from "@/lib/Template";
import MouldCliConfig from "@/lib/MouldCliConfig";
import { homedir } from "os";
import type { MouldTemplateSourcesConfigFile } from "@/types/MouldTemplateSourcesConfigFile";

export interface IMouldCommandLineInterfaceConstructorOpts {
  mouldAppDir: string;
}

export class MouldCommandLineInterface implements IMouldCommandLineInterface {
  private program: Command;
  private readonly mouldAppDir: string;

  /**
   * @param searchDir
   * @returns `${searchDir}/template-sources.json`
   */
  private static templateSourcesFilePath(searchDir: string): string {
    return join(searchDir, "template-sources.json");
  }

  private static get homeDirectory(): string {
    return homedir();
  }

  private static get userMouldAppDataDirectory(): string {
    return join(
      MouldCommandLineInterface.homeDirectory,
      "mould"
    )
  }

  private defaultMouldSourcesConfigSearchDirectories(
    appDir: string = this.mouldAppDir,
    homeDataDir: string = MouldCommandLineInterface.userMouldAppDataDirectory
  ): readonly string[] {
    const defaultSourcesDefinitionFiles: string[] = [];

    // Search app directory (package root - 1 above src or dist)
    try {
      if (existsSync(MouldCommandLineInterface.templateSourcesFilePath(appDir))) {
        defaultSourcesDefinitionFiles.push(
          appDir.trim()
        );
      }
    } catch {}


    // Search ~/mould directory
    try {
      if (existsSync(MouldCommandLineInterface.templateSourcesFilePath(homeDataDir))) {
        defaultSourcesDefinitionFiles.push(
          MouldCommandLineInterface.userMouldAppDataDirectory.trim()
        );
      }
    } catch {}

    return defaultSourcesDefinitionFiles
  }

  /**
   *
   * @description Parse sources files (set manually by --sources-files <path1,path2,etc.>)
   * @param options Commander.js options object to parse flag from
   * @returns `readonly string[]` An array of the paths to template sources files
   */
  private parseSourcesFilesOption(options: unknown): readonly string[] {
    function parseCommaSeparatedListString(): string | null {
      if (typeof options !== 'object' || options === null) {
        throw new TypeError("Expected 'options' to be a truthy object!", {
          cause: `Received type ${typeof options}`
        });
      }
      if ("sourcesFiles" in options && typeof options['sourcesFiles'] === 'string') {
        return options['sourcesFiles'];
      } else if ("sources-files" in options && typeof options['sources-files'] === 'string') {
        return options['sources-files'];
      } else {
        if (process.env.NODE_ENV === 'development') {
          console.warn("[parseCommaSeparatedListString] Failed to resolve a sources files string option from command options! Returning null...");
        }
        return null;
      }
    }

    const commaSeparatedPathList: string | null = parseCommaSeparatedListString();
    if (typeof commaSeparatedPathList !== 'string') {
      const defaultConfigSearchDirectories = this.defaultMouldSourcesConfigSearchDirectories();
      const defaultSourcesFilesPaths = defaultConfigSearchDirectories.map(
        MouldCommandLineInterface.templateSourcesFilePath
      )
      if (process.env.NODE_ENV === 'development') {
        console.log("[parseSourcesFilesOption] Falling back to defaults: ", defaultSourcesFilesPaths)
      }
      return defaultSourcesFilesPaths
    }
    if (commaSeparatedPathList.includes(",")) {
      return commaSeparatedPathList.split(",")
    } else {
      return [commaSeparatedPathList]
    }
  }

  private static resolveSourcesFileConfig(sources_file_path: string): MouldCliConfig {
    if (!existsSync(sources_file_path)) {
      console.error("Failed to resolve template sources configuration file at path: ", sources_file_path);
      process.exit(1);
    } else {
      if (process.env.NODE_ENV === 'development') {
        console.log(`template-sources.json file at '${sources_file_path}' appears to exist.`)
      }
    }
    if (!lstatSync(sources_file_path).isFile()) {
      console.error(`"${sources_file_path}" exists but it is not a file!`);
      process.exit(1);
    }

    let sourcesConfigUtf8: string;
    try {
      sourcesConfigUtf8 = readFileSync(sources_file_path, { encoding: "utf-8" });
    } catch (e: unknown) {
      console.error("Failed to read template-sources.json file from: ", sources_file_path);
      console.error("Error: ", e);
      process.exit(1);
    }

    try {
      const parsed = MouldCliConfig.safeParse(JSON.parse(sourcesConfigUtf8));
      if (!parsed.success) {
        throw new Error(`Failed to parse template sources config file from: "${sources_file_path}"`, {
          cause: parsed.error
        });
      }
      return new MouldCliConfig({
        sourcesConfig: parsed.data
      });
    } catch (e: unknown) {
      console.error("Failed to parse template-sources.json file from: ", sources_file_path);
      console.error("Error: ", e);
      process.exit(1);
    }

  }

  private static parseSourcesFiles(paths: readonly string[]): readonly MouldCliConfig[] {
    for (const path of paths) {
      const stats = lstatSync(path);
      if (stats.isDirectory()) {
        console.error(`"${path}" is a directory, not a template-sources.json file!`);
        process.exit(1);
      } else if (!stats.isFile()) {
        console.error(`"${path}" is file, expected it to be a template-sources.json file!`);
        process.exit(1);
      }
    }

    return paths.map(MouldCommandLineInterface.resolveSourcesFileConfig);
  }

  private parseSourcesFilesBasedOnCliOption(options: unknown): readonly MouldCliConfig[] {
    const sourcesFilesPath: readonly string[] = this.parseSourcesFilesOption(options);
    const sourcesFiles: readonly MouldCliConfig[] = MouldCommandLineInterface.parseSourcesFiles(
      sourcesFilesPath
    )
    return sourcesFiles;
  }

  private parseAndMergeSourcesFilesBasedOnCliOption(options: unknown): MouldCliConfig {
    const sourcesFiles: readonly MouldCliConfig[] = this.parseSourcesFilesBasedOnCliOption(options);
    return new MouldCliConfig({
      sourcesConfig: MouldCliConfig.merge(...sourcesFiles.map(s => s.serialize()))
    })
  }

  private async promptForInput(
    inputDef: MouldInputItemDefinition,
  ): Promise<string> {
    const rl = createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    return new Promise((resolve) => {
      const prompt = inputDef.description
        ? `${inputDef.label} (${inputDef.description}): `
        : `${inputDef.label}: `;

      rl.question(prompt, (answer: string) => {
        rl.close();
        resolve(answer.trim());
      });
    });
  }

  private addSetupMouldCliCommand(): void {
    this.program
      .command("setup")
      .alias('init')
      .description("⚙️ Run initial configuration steps for @jalexw/mould")
      .action((options: unknown, command: unknown): void => {
        console.log("Welcome to the 'mould' setup wizard!");
        const appDir: string = this.mouldAppDir
        console.log("App directory: ", appDir);
        const appDirTemplateSourcesJsonFile: string = MouldCommandLineInterface.templateSourcesFilePath(
          appDir
        );
        console.log("Home data directory: ", MouldCommandLineInterface.userMouldAppDataDirectory);
        const homeDataDirTemplateSourcesJsonFile: string = MouldCommandLineInterface.templateSourcesFilePath(
          MouldCommandLineInterface.userMouldAppDataDirectory
        );
        let templateSources: readonly string[] = [];
        function createMinimalTemplateSourcesFileIfNotExists(filepath: string) {
          if (!existsSync(filepath)) {
            try {
              MouldCliConfig.createMinimalTemplateSourcesFile(filepath)
            } catch (e: unknown) {
              console.error("Failed to create a minimal template sources file at: ", filepath);
              console.error(e);
              process.exit(1);
            }
            console.log(`Wrote default template sources file to "${filepath}"`);
          } else {
            console.log(`Template sources file already exists at "${filepath}"`)
          }
        }
        createMinimalTemplateSourcesFileIfNotExists(appDirTemplateSourcesJsonFile);
        if (appDirTemplateSourcesJsonFile !== homeDataDirTemplateSourcesJsonFile) {
          createMinimalTemplateSourcesFileIfNotExists(homeDataDirTemplateSourcesJsonFile);
        }

        console.log("Finished setup for 'mould'!")
      });
  }

  private addUseTemplateCommand(): void {
    const useCommand = this.program
      .command("use")
      .alias("apply")
      .alias("use-template")
      .alias("apply-template")
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
      )
      .option(
        "--interactive",
        "interactively prompt for missing inputs instead of exiting with error",
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

        const templateSources: readonly ITemplateSourceDirectory[] =
          this.parseAndMergeSourcesFilesBasedOnCliOption(opts).loadTemplateSourceDirectories();

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

          // Check for interactive mode
          const isInteractive =
            typeof opts === "object" &&
            !!opts &&
            "interactive" in opts &&
            opts.interactive === true;

          // Find missing inputs
          const missingInputs = inputs.filter(
            (input) => !(input.id in input_values),
          );

          if (missingInputs.length > 0) {
            if (isInteractive) {
              console.log(
                `📝 Gathering ${missingInputs.length} missing input(s) for template '${template_name}'...\n`,
              );

              for (const input of missingInputs) {
                const value = await this.promptForInput(input);
                if (!value && input.required) {
                  console.error(
                    `❌ Required input '${input.id}' cannot be empty!`,
                  );
                  process.exit(1);
                }
                input_values[input.id] = value;
              }

              console.log("✅ All inputs gathered!\n");
            } else {
              let exitFromInvalidInputs: boolean = false;
              missingInputs.forEach((input) => {
                console.error(
                  `Missing input '${input.id}' for mould template!`,
                );
                exitFromInvalidInputs = true;
              });
              if (exitFromInvalidInputs) {
                console.error(
                  "Invalid inputs based on .mouldconfig.json for template! Use --interactive flag to be prompted for missing inputs.",
                );
                process.exit(1);
              }
            }
          }
        }

        await template.export({ output_path, input_values });
      },
    );
  }

  private addCreateMinimalTemplateCommand(): void {
    const createCommand = this.program
      .command("create-minimal-template")
      .description(
        "🆕 Scaffold a new, minimal mould template directory with a '.mouldconfig.json' file",
      )
      .argument(
        "<template_path>",
        "Path of the new template directory to create",
      );

    createCommand.action(async (template_path: string): Promise<void> => {
      if (typeof template_path !== "string" || !template_path) {
        return createCommand.help();
      }

      const configPath: string = await Template.createMinimalTemplate({ template_path });

      console.log(`🧩 Scaffolded a minimal mould template at '${template_path}'`);
      console.log(`Wrote template configuration to '${configPath}'`);
    });
  }

  private addCreateMinimalTemplateSourcesFileCommand(): void {
    const createCommand = this.program
      .command("create-template-sources-file")
      .description(
        "🆕 Scaffold a new, minimal mould template directory with a '.mouldconfig.json' file",
      )
      .argument(
        "<sources_file_path>",
        "Path of the new template directory to create",
      );

    createCommand.action(async (template_sources_file_path: string): Promise<void> => {
      if (typeof template_sources_file_path !== "string" || !template_sources_file_path) {
        return createCommand.help();
      }

      try {
        MouldCliConfig.createMinimalTemplateSourcesFile(template_sources_file_path)
      } catch (e: unknown) {
        console.error("Failed to create a minimal template sources file at: ", template_sources_file_path);
        process.exit(1);
      }

      console.log(`🧩 Scaffolded a minimal template sources file at '${template_sources_file_path}'`);
    });
  }

  private addListTemplateSourcesConfigFilesCommand(): void {
    this.program
      .command("template-sources")
      .description("⚙️📁 List configured template source definition files.")
      .action((opts: unknown, command: unknown): void => {
        const filepaths: readonly string[] = this.parseSourcesFilesOption(opts);
        if (filepaths.length === 0) {
          console.log("No template-sources.json configurations appear to be configured.");
          console.log(`Try running the \`mould setup\` command!`)
          return;
        }
        for (const filepath of filepaths) {
          console.log(` - ${filepath}`)
        }
        return;
      });
  }

  private addListTemplatesCommand(): void {
    this.program
      .command("list")
      .alias("templates")
      .description("🧩 List configured templates available for use")
      .action(async (opts: unknown, command: unknown): Promise<void> => {
        const templateSourceDirs: readonly ITemplateSourceDirectory[] =
          this.parseAndMergeSourcesFilesBasedOnCliOption(opts).loadTemplateSourceDirectories();


        const templates: readonly ITemplate[] = await gatherAvailableTemplates(
          templateSourceDirs
        );
        const formattedTemplatesData = templates.map((template) => ({
          name: template.name,
          path: template.path,
        }));
        console.table(formattedTemplatesData);
      });
  }

  private addVersionCommand(): void {
    this.program
      .command("version")
      .action((): void => {
        const versionSemver = getPackageVersion(this.mouldAppDir);
        console.log("'mould' Build Version: ", versionSemver);
      })
  }

  private setupCommands(): void {
    this.addVersionCommand();
    this.addSetupMouldCliCommand();
    this.addUseTemplateCommand();
    this.addCreateMinimalTemplateCommand();
    this.addCreateMinimalTemplateSourcesFileCommand();
    this.addListTemplatesCommand();
    this.addListTemplateSourcesConfigFilesCommand();
  }

  public constructor(opts: IMouldCommandLineInterfaceConstructorOpts) {
    if (typeof opts.mouldAppDir !== 'string') {
      throw new TypeError("Expected 'mouldAppDir' to be a string!");
    }
    this.mouldAppDir = opts.mouldAppDir satisfies string;

    const defaultSourcesDefinitionFiles = this.defaultMouldSourcesConfigSearchDirectories(
      this.mouldAppDir
    );
    const defaultSourcesFilesOptCsv: string = defaultSourcesDefinitionFiles
      .map(
        MouldCommandLineInterface.templateSourcesFilePath
      )
      .join(",")

    if (process.env.NODE_ENV === 'development') {
      console.log(
        "[MouldCommandLineInterface] Default sources files list when --sources-files is not set: ",
        defaultSourcesFilesOptCsv
      )
    }

    this.program = new Command();
    this.program.name("mould");
    this.program.description(
      "🧩🪄 Generate sample projects and insert code snippets from your configurable templates collection",
    );
    this.program.version(version(this.mouldAppDir));
    this.program.option(
      "--sources-files <comma_separated_filepaths>",
      'A comma-separated list of paths to template-sources.json files; each of which can define paths or groups of paths to templates.',
      defaultSourcesFilesOptCsv,
    )

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
