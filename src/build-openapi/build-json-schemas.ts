import templateConfigSchema from "@/schemas/templateConfigSchema"
import mouldTemplateSourcesJsonFileSchema from "@/lib/schemas/mouldTemplateSourcesJsonFileSchema";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "fs";
import { join, normalize } from "path";
import { ZodObject } from "zod";
const projectRootDir: string = normalize(join(__dirname, "..", ".."));

if (!existsSync(join(projectRootDir, "package.json"))) {
  console.error("Failed to resolve project root directory!");
  process.exit(1);
}

const distDir = join(projectRootDir, "dist");
if (!existsSync(distDir)) {
  mkdirSync(distDir);
}

const openapiOutputDir = join(distDir, "openapi");
if (!existsSync(openapiOutputDir)) {
  mkdirSync(openapiOutputDir);
}

const JSON_SCHEMAS = [
  "mouldconfig.json",
  "template-sources.json"
] as const;

type JsonSchemaFileName = (typeof JSON_SCHEMAS)[number];

const JSON_SCHEMA_OUTPUT_FILEPATHS_MAP = new Map<JsonSchemaFileName, string>(
  JSON_SCHEMAS.map((filename: JsonSchemaFileName): [filename: JsonSchemaFileName, filepath: string] => {
    return [filename, join(openapiOutputDir, filename)]
  })
)

function clearExistingJsonSchemaOutputFiles(): void {
  function deleteFileIfExists(pathToClear: string): void {
    if (existsSync(pathToClear)) {
      rmSync(pathToClear)
    }
  }

  for (const EXISTING_JSON_SCHEMA_OUTPUT_FILE of JSON_SCHEMA_OUTPUT_FILEPATHS_MAP.values()) {
    deleteFileIfExists(EXISTING_JSON_SCHEMA_OUTPUT_FILE);
  }
}

clearExistingJsonSchemaOutputFiles();

const JSON_SCHEMA_BUILDERS_MAP = new Map<JsonSchemaFileName, () => string>()

function writeZodSchemaToJsonSchemaFile<F extends JsonSchemaFileName, S extends ZodObject>(filename: F, schema: S): string {
  const filepath: string | undefined = JSON_SCHEMA_OUTPUT_FILEPATHS_MAP.get(filename);
  if (!filepath) {
    throw new TypeError(`Failed to load output filepath for file '${filename}'`)
  }
  const jsonSchemaUtf8: string = JSON.stringify(schema.toJSONSchema())
  writeFileSync(
    filepath,
    jsonSchemaUtf8,
    { "encoding": "utf-8" }
  )
  return filepath;
}

JSON_SCHEMA_BUILDERS_MAP.set(
  'mouldconfig.json',
  () => writeZodSchemaToJsonSchemaFile('mouldconfig.json', templateConfigSchema)
);

JSON_SCHEMA_BUILDERS_MAP.set(
  'template-sources.json',
  () => writeZodSchemaToJsonSchemaFile('template-sources.json', mouldTemplateSourcesJsonFileSchema)
);

for (const [filename, builder] of JSON_SCHEMA_BUILDERS_MAP.entries()) {
  try {
    void builder()
  } catch {

  }

  console.log(`- Built '${filename}'`)
}
