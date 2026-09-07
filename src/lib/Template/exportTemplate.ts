import type { ITemplateConfig } from "@/types/ITemplateConfig";
import type { ITemplateFile } from "@/types/ITemplateFile";
import type { ITemplateDirectory } from "@/types/ITemplateDirectory";
import type { IExportTemplateResult } from "@/types/IExportTemplateOptions";

import { dirname, join } from "path";
import { mkdir, writeFile } from "fs/promises";
import { existsSync } from "fs";
import {
  normalizeSubstitution,
  type NormalizedTemplateSubstitution,
} from "@/schemas/templateSubstitutionList";
import { applyConditionalBlocks } from "@/lib/Conditions";
import {
  OutputParentMissingError,
  OutputPathExistsError,
  RenameConflictError,
} from "@/lib/errors";

export interface IExportTemplate {
  config: ITemplateConfig;
  files: readonly (ITemplateFile | ITemplateDirectory)[];
  output_path: string;
  input_values: Record<string, string>;
  /** Template-relative paths that were pruned by `conditionalPaths` (reported back) */
  skipped_files?: readonly string[];
  onWarning?: (message: string) => void;
  debug?: boolean;
}

type StringTransform = (input: string) => string;

/**
 * Replace every occurrence of `find` with the input's value. The value is
 * always inserted literally — `$&`, `$1` and friends in a value are never
 * expanded — and an explicitly supplied empty string does substitute; only an
 * *absent* input leaves the text untouched.
 */
export function substituteTransform(
  input: string,
  substitution: NormalizedTemplateSubstitution,
  input_values: Readonly<Record<string, string>>,
): string {
  const { find, input: inputId, regex } = substitution;

  if (!(inputId in input_values)) {
    return input;
  }
  const replaceValue: string = input_values[inputId]!;

  if (regex) {
    return input.replace(new RegExp(find, "g"), (): string => replaceValue);
  }
  return input.split(find).join(replaceValue);
}

/** git's heuristic: a NUL byte in the first 8000 bytes means "binary" */
const BINARY_SNIFF_LENGTH = 8000 as const;

export function isProbablyBinary(buffer: Buffer): boolean {
  const sniff: Buffer = buffer.subarray(0, BINARY_SNIFF_LENGTH);
  return sniff.includes(0);
}

/**
 * Build the output path (as segments) for a template entry, honouring
 * `renames`. A directory key rewrites everything beneath it.
 */
export function applyRenames(
  relativePath: readonly string[],
  renames: Readonly<Record<string, string>> | undefined,
): readonly string[] {
  if (!renames) {
    return relativePath;
  }
  const posix: string = relativePath.join("/");
  if (posix in renames) {
    return renames[posix]!.split("/");
  }
  // Longest matching directory prefix wins
  let bestKey: string | null = null;
  for (const key of Object.keys(renames)) {
    if (posix.startsWith(`${key}/`) && (bestKey === null || key.length > bestKey.length)) {
      bestKey = key;
    }
  }
  if (bestKey === null) {
    return relativePath;
  }
  const rest: string = posix.slice(bestKey.length + 1);
  return `${renames[bestKey]!}/${rest}`.split("/");
}

export async function exportTemplate({
  config,
  files,
  output_path,
  ...opts
}: IExportTemplate): Promise<IExportTemplateResult> {
  const debug: boolean = opts.debug ?? false;
  const warn = opts.onWarning ?? ((): void => {});

  if (existsSync(output_path)) {
    throw new OutputPathExistsError(output_path);
  }

  try {
    await mkdir(output_path);
  } catch (e: unknown) {
    if (typeof e === "object" && e !== null && "code" in e && e.code === "ENOENT") {
      throw new OutputParentMissingError(output_path, e);
    }
    throw e;
  }

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
    config.substitutions.forEach((sub) => {
      const normalized: NormalizedTemplateSubstitution = normalizeSubstitution(sub);
      transforms.push((val: string): string =>
        substituteTransform(val, normalized, opts.input_values),
      );
    });
  }

  // Warn about rename keys that match nothing (the file may have been pruned)
  if (config.renames) {
    const present: ReadonlySet<string> = new Set(
      files.map((f: ITemplateFile | ITemplateDirectory): string => f.relativePath.join("/")),
    );
    for (const key of Object.keys(config.renames)) {
      if (!present.has(key)) {
        warn(`'renames' entry '${key}' did not match any file or directory in the template`);
      }
    }
  }

  const writtenFiles: string[] = [];
  const claimedOutputs = new Map<string, string>();

  function claim(outputPosix: string, sourcePosix: string): void {
    const previous: string | undefined = claimedOutputs.get(outputPosix);
    if (previous !== undefined && previous !== sourcePosix) {
      throw new RenameConflictError(outputPosix, [previous, sourcePosix]);
    }
    claimedOutputs.set(outputPosix, sourcePosix);
  }

  for (const file of files) {
    const sourcePosix: string = file.relativePath.join("/");
    const outputSegments: readonly string[] = applyRenames(
      file.relativePath,
      config.renames,
    );
    const outputPosix: string = outputSegments.join("/");
    const newAbsolutePath = join(output_path, ...outputSegments);

    if (file.type === "directory") {
      // Directories may legitimately be claimed by several entries (a rename
      // target's parent may already exist), so only files are exclusive.
      await mkdir(newAbsolutePath, { recursive: true });
      continue;
    }

    claim(outputPosix, sourcePosix);
    await mkdir(dirname(newAbsolutePath), { recursive: true });

    const buffer: Buffer = file.readBuffer();
    if (isProbablyBinary(buffer)) {
      await writeFile(newAbsolutePath, buffer, { mode: file.mode });
    } else {
      let contents: string = buffer.toString("utf-8");
      contents = applyConditionalBlocks(contents, opts.input_values, sourcePosix);
      contents = applyTransforms(contents);
      await writeFile(newAbsolutePath, contents, {
        encoding: "utf-8",
        mode: file.mode,
      });
    }
    writtenFiles.push(outputPosix);
  }

  return {
    writtenFiles,
    skippedFiles: opts.skipped_files ?? [],
  };
}

export default exportTemplate;
