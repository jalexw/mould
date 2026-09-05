import { basename, resolve } from "path";
import { lstat } from "fs/promises";
import { Template } from "./Template";
import { TemplateNotFoundError } from "@/lib/errors";
import { resolveInputs, type ProvidedInputValues } from "@/lib/Inputs";
import type { ITemplateConfig } from "@/types/ITemplateConfig";

export interface IApplyTemplateOptions {
  /** Directory containing the template (and optionally its `.mouldconfig.json`) */
  templatePath: string;
  /** Directory to create; must not exist, and its parent must */
  outputPath: string;
  /** Input values; booleans are accepted for `boolean` inputs */
  inputs?: ProvidedInputValues;
  /** Receives non-fatal notices (defaults to discarding them) */
  onWarning?: (message: string) => void;
}

export interface IApplyTemplateResult {
  templateName: string;
  templatePath: string;
  outputPath: string;
  /** Inputs after defaults and normalisation — what was actually substituted */
  inputs: Readonly<Record<string, string>>;
  /** Output-relative, `/`-separated paths of every file written */
  writtenFiles: readonly string[];
  /** Template-relative paths pruned by `conditionalPaths` */
  skippedFiles: readonly string[];
}

async function templateAtPath(templatePath: string): Promise<Template> {
  const absolute: string = resolve(templatePath);
  let isDirectory: boolean;
  try {
    isDirectory = (await lstat(absolute)).isDirectory();
  } catch (e: unknown) {
    throw new TemplateNotFoundError(absolute);
  }
  if (!isDirectory) {
    throw new TemplateNotFoundError(
      absolute,
      `'${absolute}' exists but is not a directory, so it cannot be a mould template`,
    );
  }
  return new Template(basename(absolute), absolute);
}

/**
 * Read a template directory's `.mouldconfig.json` (validated), or the empty
 * default config when the template has none.
 */
export async function loadTemplateConfig(
  templatePath: string,
): Promise<ITemplateConfig> {
  const template: Template = await templateAtPath(templatePath);
  return await template.loadConfigOrDefault();
}

/**
 * Generate `outputPath` from the template directory at `templatePath`.
 *
 * This is the programmatic counterpart of `mould use`: it never reads
 * `template-sources.json`, never prompts, and never calls `process.exit` —
 * failures reject with a `MouldError` subclass.
 */
export async function applyTemplate(
  options: IApplyTemplateOptions,
): Promise<IApplyTemplateResult> {
  const template: Template = await templateAtPath(options.templatePath);
  const config: ITemplateConfig = await template.loadConfigOrDefault();
  const inputs: Record<string, string> = await resolveInputs(
    config.inputs,
    options.inputs ?? {},
  );
  const outputPath: string = resolve(options.outputPath);

  const { writtenFiles, skippedFiles } = await template.export({
    output_path: outputPath,
    input_values: inputs,
    onWarning: options.onWarning,
  });

  return {
    templateName: template.name,
    templatePath: template.path,
    outputPath,
    inputs,
    writtenFiles,
    skippedFiles,
  };
}

export default applyTemplate;
