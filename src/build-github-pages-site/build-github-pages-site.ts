import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from "fs";
import { join, normalize } from "path";
const projectRootDir: string = normalize(join(__dirname, "..", ".."));

if (!existsSync(join(projectRootDir, "package.json"))) {
  console.error("Failed to resolve project root directory!");
  process.exit(1);
}

const githubPagesStaticDir = join(projectRootDir, "github-pages-static");
if (!existsSync(githubPagesStaticDir)) {
  console.error("Expected github-pages-static/ directory to exist at: ", githubPagesStaticDir);
  process.exit(1);
}

const distDir = join(projectRootDir, "dist");
if (!existsSync(distDir)) {
  console.error("Expected dist/ directory to exist at: ", distDir);
  process.exit(1);
}

const openapiOutputDir = join(distDir, "openapi");
if (!existsSync(openapiOutputDir)) {
  console.error("Expected openapi/ directory to exist at: ", openapiOutputDir);
  process.exit(1);
}

const githubPagesOutputDir = join(distDir, "github-pages");
if (!existsSync(githubPagesOutputDir)) {
  mkdirSync(githubPagesOutputDir);
}
console.log("Preparing GitHub Pages site at output directory: ", githubPagesOutputDir);

const githubPagesOpenapiOutputDir = join(githubPagesOutputDir, "openapi")
if (!existsSync(githubPagesOpenapiOutputDir)) {
  mkdirSync(githubPagesOpenapiOutputDir);
}

// Copy openapi files into dist/github-pages/
const openapiFiles: string[] = readdirSync(openapiOutputDir)
for (const openapiOutputFilename of openapiFiles) {
  if (openapiOutputFilename === ".DS_Store" || openapiOutputFilename === '.' || openapiOutputFilename === '..') {
    continue;
  }
  const fullOpenapiFilePath: string = join(openapiOutputDir, openapiOutputFilename);
  const targetOpenapiFilePath = join(githubPagesOpenapiOutputDir, openapiOutputFilename);
  copyFileSync(fullOpenapiFilePath, targetOpenapiFilePath);
  console.log(` - Copied openapi file from "${fullOpenapiFilePath}" to "${targetOpenapiFilePath}"`)
}

// Copy index.html into dist/github-pages/
const fullIndexHtmlFilePath = join(githubPagesStaticDir, "index.html");
const targetIndexHtmlFilePath = join(githubPagesOutputDir, "index.html")
if (!existsSync(fullIndexHtmlFilePath)) {
  console.error("Expected index.html to exist at: ", fullIndexHtmlFilePath);
  process.exit(1);
}
copyFileSync(
  fullIndexHtmlFilePath,
  targetIndexHtmlFilePath
)
console.log(` - Copied index.html file from "${fullIndexHtmlFilePath}" to "${targetIndexHtmlFilePath}"`)

console.log("✅ Finished GitHub Pages site build")
