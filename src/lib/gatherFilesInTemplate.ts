import type { ITemplate } from "@/types/ITemplate";
import type { ITemplateDirectory, ITemplateFile } from "@/types/ITemplateFile";
import { existsSync, fstatSync, readFileSync } from "fs";
import { readdir, lstat } from "fs/promises";
import { join } from "path";

type ShouldIgnorePathFn = (pathSegment: string) => boolean;

async function isDirectory(filepath: string): Promise<boolean> {
  const fileStats = await lstat(filepath);
  return fileStats.isDirectory();
}

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
    if (ignore(filename)) {
      continue;
    }

    const absolutePathToChild: string = join(currentPath, filename);
    const isChildADirectory: boolean = await isDirectory(absolutePathToChild);
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
      readUtf8: (): string => {
        return readFileSync(absolutePathToChild, { encoding: "utf8" });
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
