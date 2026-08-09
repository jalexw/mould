import type { MouldTemplateSourcesConfigFile } from "@/types/MouldTemplateSourcesConfigFile";
import jsonSchemaUrl from "./templateSourcesJsonSchemaUrl";

const minimalTemplateSourcesFile: MouldTemplateSourcesConfigFile = {
  "$schema": jsonSchemaUrl,
  templates: [],
  templatesDirectories: []
}

export default minimalTemplateSourcesFile;
