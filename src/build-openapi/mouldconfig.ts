import templateConfigSchema from "@/schemas/templateConfigSchema"
import { existsSync, mkdirSync, rmSync, writeFileSync } from "fs";
import { join, normalize } from "path";
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

const mouldconfigOutputJsonFile = join(openapiOutputDir, "mouldconfig.json")

if (existsSync(mouldconfigOutputJsonFile)) {
  rmSync(mouldconfigOutputJsonFile)
}

writeFileSync(
  mouldconfigOutputJsonFile,
  JSON.stringify(templateConfigSchema.toJSONSchema()),
  { "encoding": "utf-8" }
)
