import TemplateSourceDirectory from "./TemplateSourceDirectory";
import { readFileSync, existsSync } from "fs";

function loadTemplateSourceDirectoriesListedInConfig(
  sourcesFilePath: string,
): readonly TemplateSourceDirectory[] {
  if (!existsSync(sourcesFilePath)) {
    throw new Error("Failed to find template-sources.json file!");
  }

  let sourcePaths: readonly string[];
  try {
    const sourcesFile: string = readFileSync(sourcesFilePath, {
      encoding: "utf8",
    });
    const sourceJson: unknown = JSON.parse(sourcesFile);
    if (
      !Array.isArray(sourceJson) ||
      !sourceJson.every((s) => typeof s === "string")
    ) {
      throw new TypeError(
        "Expected template-sources.json to be a list of strings!",
      );
    }
    sourcePaths = sourceJson;
  } catch (e: unknown) {
    console.error(
      "Failed to parse template sources from template-sources.json file: ",
      e,
    );
    throw new TypeError(
      "Failed to parse template sources from template-sources.json file!",
    );
  }

  return sourcePaths.map((p: string) => new TemplateSourceDirectory(p));
}

export default loadTemplateSourceDirectoriesListedInConfig;
