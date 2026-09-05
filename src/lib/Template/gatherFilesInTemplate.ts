import type { ITemplate } from "@/types/ITemplate";
import type { ITemplateFile } from "@/types/ITemplateFile";
import type { ITemplateDirectory } from "@/types/ITemplateDirectory";

import { existsSync, readFileSync } from "fs";
import { readdir, lstat } from "fs/promises";
import { join } from "path";

export interface ITemplateEntryCandidate {
  /** Basename of the entry */
  name: string;
  /** Path segments relative to the template root, ending in `name` */
  relativePath: readonly string[];
  isDirectory: boolean;
}

export type ShouldIgnorePathFn = (candidate: ITemplateEntryCandidate) => boolean;

async function isDirectory(filepath: string): Promise<boolean> {
  const fileStats = await lstat(filepath);
  return fileStats.isDirectory();
}

/** Permission bits only — the type bits are irrelevant for the copy */
const PERMISSION_BITS = 0o777 as const;

async function gatherFilesRelativeToPath(
  templateBaseDirPath: string,
  relativePath: readonly string[],
  ignore: ShouldIgnorePathFn,
): Promise<readonly (ITemplateFile | ITemplateDirectory)[]> {
  if (
    !existsSync(templateBaseDirPath) &&
    !(await isDirectory(templateBaseDirPath))
  ) {
    throw new Error(
      `Failed to find template directory at path: '${templateBaseDirPath}'`,
    );
  }

  const currentPath =
    relativePath.length === 0
      ? templateBaseDirPath
      : join(templateBaseDirPath, ...relativePath);
  const children: string[] = await readdir(currentPath);

  const output: (ITemplateFile | ITemplateDirectory)[] = [];

  for (const child of children) {
    const filename: string = child;
    const absolutePathToChild: string = join(currentPath, filename);
    const childStats = await lstat(absolutePathToChild);
    const isChildADirectory: boolean = childStats.isDirectory();

    if (
      ignore({
        name: filename,
        relativePath: [...relativePath, child],
        isDirectory: isChildADirectory,
      })
    ) {
      // An ignored directory is pruned whole: nothing beneath it is visited
      continue;
    }

    if (isChildADirectory) {
      output.push({
        type: "directory",
        name: filename,
        absolutePath: absolutePathToChild,
        relativePath: [...relativePath, child],
      });

      const recursive_children: readonly (
        | ITemplateFile
        | ITemplateDirectory
      )[] = await gatherFilesRelativeToPath(
        templateBaseDirPath,
        [...relativePath, child],
        ignore,
      );
      output.push(...recursive_children);
      continue;
    }

    const fileReference: ITemplateFile = {
      type: "file",
      name: child,
      absolutePath: absolutePathToChild,
      relativePath: [...relativePath, child],
      mode: childStats.mode & PERMISSION_BITS,
      readUtf8: (): string => {
        return readFileSync(absolutePathToChild, { encoding: "utf8" });
      },
      readBuffer: (): Buffer => {
        return readFileSync(absolutePathToChild);
      },
    };

    output.push(fileReference);
    continue;
  }

  return [...output];
}

export async function gatherFilesInTemplate(
  template: ITemplate,
  ignore: ShouldIgnorePathFn,
): Promise<readonly (ITemplateFile | ITemplateDirectory)[]> {
  if (typeof ignore !== "function") {
    throw new TypeError("Expected 'ignore' to be a function!");
  }

  const files: readonly (ITemplateFile | ITemplateDirectory)[] =
    await gatherFilesRelativeToPath(template.path, [], ignore);
  return files;
}

export default gatherFilesInTemplate;
