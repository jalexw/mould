import { lstatSync, readdirSync } from "fs";
import { join } from "path";

function isDirectory(path: string): boolean {
  return lstatSync(path).isDirectory();
}

export function collectAllSubdirectories(path: string): readonly string[] {
  if (!isDirectory(path)) {
    throw new Error(`Path '${path}' is not a directory; cannot collect subdirectories!`)
  }
  const accumulator: string[] = []
  const children = readdirSync(path);
  for (const child of children) {
    if (child === '.DS_Store') {
      continue;
    }
    const childPath: string = join(path, child);
    if (isDirectory(childPath)) {
       accumulator.push(childPath);
    } else {
      continue;
    }
  }
  return accumulator;
}

export default collectAllSubdirectories;
