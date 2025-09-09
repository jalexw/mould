import type {
  ITemplateConfig,
  TemplateSubstitutionsList,
} from "@/types/ITemplateConfig";
import type { ITemplateDirectory, ITemplateFile } from "@/types/ITemplateFile";
import { join } from "path";
import { mkdir, writeFile } from "fs/promises";
import { existsSync } from "fs";

export interface IExportTemplate {
  config: ITemplateConfig;
  files: readonly (ITemplateFile | ITemplateDirectory)[];
  output_path: string;
  input_values: Record<string, string>;
  debug?: boolean;
}

type StringTransform = (input: string) => string;

function substituteTransform(
  input: string,
  substitution: [replace: string, replace_with: string],
  input_values: Record<string, string>,
): string {
  const [replace, replace_with] = substitution;

  if (replace_with in input_values && input_values[replace_with]) {
    const replaceValue: string = input_values[replace_with];
    return input.replace(new RegExp(replace, "g"), replaceValue);
  } else {
    return input;
  }
}

export async function exportTemplate({
  config,
  files,
  output_path,
  ...opts
}: IExportTemplate): Promise<void> {
  const debug: boolean = opts.debug ?? false;

  const outputPathAlreadyExists: boolean = existsSync(output_path);
  if (outputPathAlreadyExists) {
    console.error(`Output path '${output_path}' already exists!`);
    process.exit(1);
  }

  await mkdir(output_path);

  const transforms: StringTransform[] = [];

  function applyTransforms(utf8: string): string {
    let contents = utf8;
    for (
      let transform_i: number = 0;
      transform_i < transforms.length;
      transform_i++
    ) {
      if (typeof transforms[transform_i] !== "function") {
        throw new TypeError("Received non-function string transformer!");
      }
      const transform: StringTransform = transforms[transform_i]!;
      if (debug) {
        console.log(
          `[exportTemplate] Applying string transform [${transform_i + 1}/${transforms.length}]...`,
        );
      }
      contents = transform(contents);
    }
    return contents;
  }

  // Apply substitution transforms
  if (config.substitutions && config.substitutions.length > 0) {
    config.substitutions.forEach((sub: [string, string]) => {
      transforms.push((val: string): string =>
        substituteTransform(val, sub, opts.input_values),
      );
    });
  }

  for (const file of files) {
    const newAbsolutePath = join(output_path, ...file.relativePath);
    if (file.type === "directory") {
      await mkdir(newAbsolutePath);
    } else {
      let contents: string = file.readUtf8();
      contents = applyTransforms(contents);
      await writeFile(newAbsolutePath, contents, { encoding: "utf-8" });
    }
  }
}

export default exportTemplate;
