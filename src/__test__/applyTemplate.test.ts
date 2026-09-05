// @ts-ignore
import { describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, readFileSync } from "fs";
import { join, normalize } from "path";
import {
  applyTemplate,
  loadTemplateConfig,
  ConditionSyntaxError,
  InvalidInputValueError,
  MissingRequiredInputError,
  OutputParentMissingError,
  OutputPathExistsError,
  RenameConflictError,
  TemplateNotFoundError,
  TemplateConfigError,
} from "$/mould";

const projectRootDir: string = normalize(join(__dirname, "..", ".."));
const testMoulds: string = join(projectRootDir, "test-fixtures", "test-moulds");
const invalidMoulds: string = join(projectRootDir, "test-fixtures", "invalid-moulds");

const tmp: string = join(projectRootDir, "tmp", `api-test-run-${crypto.randomUUID()}`);
mkdirSync(tmp, { recursive: true });

describe("applyTemplate", () => {
  test("renders a template addressed by path and reports the written files", async () => {
    const outputPath: string = join(tmp, "hello");
    const result = await applyTemplate({
      templatePath: join(testMoulds, "hello-world-mould"),
      outputPath,
    });
    expect(result.templateName).toBe("hello-world-mould");
    expect(result.outputPath).toBe(outputPath);
    expect(result.writtenFiles).toEqual(["index.js"]);
    expect(result.skippedFiles).toEqual([]);
    expect(readFileSync(join(outputPath, "index.js"), "utf-8")).toContain("Hello world!");
  });

  test("applies substitutions and echoes the resolved inputs", async () => {
    const outputPath: string = join(tmp, "ts-project");
    const result = await applyTemplate({
      templatePath: join(testMoulds, "example-typescript-project"),
      outputPath,
      inputs: { project_name: "demo", org_scope: "acme" },
    });
    expect(result.inputs).toEqual({ project_name: "demo", org_scope: "acme" });
    const pkg = JSON.parse(readFileSync(join(outputPath, "package.json"), "utf-8"));
    expect(pkg.name).toBe("@acme/demo");
  });

  test("rejects when the output path already exists", async () => {
    const outputPath: string = join(tmp, "exists");
    mkdirSync(outputPath);
    await expect(
      applyTemplate({ templatePath: join(testMoulds, "hello-world-mould"), outputPath }),
    ).rejects.toBeInstanceOf(OutputPathExistsError);
  });

  test("rejects when the output path's parent is missing", async () => {
    await expect(
      applyTemplate({
        templatePath: join(testMoulds, "hello-world-mould"),
        outputPath: join(tmp, "missing-parent", "child"),
      }),
    ).rejects.toBeInstanceOf(OutputParentMissingError);
  });

  test("rejects a template path that is not a directory", async () => {
    await expect(
      applyTemplate({ templatePath: join(tmp, "nope"), outputPath: join(tmp, "x1") }),
    ).rejects.toBeInstanceOf(TemplateNotFoundError);
    await expect(
      applyTemplate({
        templatePath: join(testMoulds, "hello-world-mould", "index.js"),
        outputPath: join(tmp, "x2"),
      }),
    ).rejects.toBeInstanceOf(TemplateNotFoundError);
    expect(existsSync(join(tmp, "x1"))).toBeFalse();
  });

  test("lists every missing required input", async () => {
    const promise = applyTemplate({
      templatePath: join(testMoulds, "example-typescript-project"),
      outputPath: join(tmp, "missing-inputs"),
      inputs: {},
    });
    await expect(promise).rejects.toBeInstanceOf(MissingRequiredInputError);
    await promise.catch((e: MissingRequiredInputError) => {
      expect([...e.inputIds].sort()).toEqual(["org_scope", "project_name"]);
    });
    expect(existsSync(join(tmp, "missing-inputs"))).toBeFalse();
  });

  test("validates select, boolean and pattern inputs", async () => {
    const templatePath: string = join(testMoulds, "conditional-mould");
    await expect(
      applyTemplate({ templatePath, outputPath: join(tmp, "v1"), inputs: { slug: "ok", deployment: "azure" } }),
    ).rejects.toBeInstanceOf(InvalidInputValueError);
    await expect(
      applyTemplate({ templatePath, outputPath: join(tmp, "v2"), inputs: { slug: "Not A Slug" } }),
    ).rejects.toBeInstanceOf(InvalidInputValueError);
    await expect(
      applyTemplate({ templatePath, outputPath: join(tmp, "v3"), inputs: { slug: "ok", with_docs: "maybe" } }),
    ).rejects.toBeInstanceOf(InvalidInputValueError);

    // A real boolean is accepted for a boolean input
    const result = await applyTemplate({
      templatePath,
      outputPath: join(tmp, "v4"),
      inputs: { slug: "ok", with_docs: true },
    });
    expect(result.inputs.with_docs).toBe("true");
    expect(existsSync(join(tmp, "v4", "docs", "README.md"))).toBeTrue();
  });

  test("applies defaults and prunes conditional paths when conditions are false", async () => {
    const outputPath: string = join(tmp, "defaults-only");
    const result = await applyTemplate({
      templatePath: join(testMoulds, "conditional-mould"),
      outputPath,
      inputs: { slug: "ok" },
    });
    expect(result.inputs).toEqual({ slug: "ok", deployment: "none", with_docs: "false" });
    expect([...result.skippedFiles].sort()).toEqual(["docs", "vercel.json"]);
    expect(existsSync(join(outputPath, "vercel.json"))).toBeFalse();
    expect(existsSync(join(outputPath, "docs"))).toBeFalse();

    const ci: string = readFileSync(join(outputPath, "ci.yml"), "utf-8");
    expect(ci).not.toContain("publish-to-vercel");
    expect(ci).not.toContain("mould:");
    const notes: string = readFileSync(join(outputPath, "notes.txt"), "utf-8");
    expect(notes).toContain("Docs are not included.");
    expect(notes).not.toContain("Docs are included.");
    const index: string = readFileSync(join(outputPath, "index.ts"), "utf-8");
    expect(index).not.toContain("xxx_deployment_placeholder");
    expect(index).not.toContain("export const docs");
  });

  test("rejects malformed conditionals before writing anything", async () => {
    for (const fixture of ["unterminated-block", "nested-block", "undeclared-input-condition", "bad-select-literal"]) {
      const outputPath: string = join(tmp, `invalid-${fixture}`);
      await expect(
        applyTemplate({ templatePath: join(invalidMoulds, fixture), outputPath }),
      ).rejects.toBeInstanceOf(ConditionSyntaxError);
      expect(existsSync(outputPath)).toBeFalse();
    }
  });

  test("rejects rename collisions", async () => {
    await expect(
      applyTemplate({
        templatePath: join(invalidMoulds, "rename-conflict"),
        outputPath: join(tmp, "rename-conflict"),
      }),
    ).rejects.toBeInstanceOf(RenameConflictError);
  });

  test("warns about rename keys that match nothing", async () => {
    const warnings: string[] = [];
    // renames-mould renames '_gitignore'; point a second, ad-hoc config at it via loadTemplateConfig
    const config = await loadTemplateConfig(join(testMoulds, "renames-mould"));
    expect(config.renames).toEqual({ _gitignore: ".gitignore", "config/_npmrc": "config/.npmrc" });

    await applyTemplate({
      templatePath: join(testMoulds, "renames-mould"),
      outputPath: join(tmp, "renames"),
      onWarning: (m: string): void => {
        warnings.push(m);
      },
    });
    expect(warnings).toEqual([]);
  });

  test("loadTemplateConfig returns the default config for a config-less template", async () => {
    const config = await loadTemplateConfig(join(testMoulds, "hello-world-mould"));
    expect(config.inputs).toBeUndefined();
    expect(config.substitutions).toBeUndefined();
  });

  test("loadTemplateConfig rejects an invalid config", async () => {
    const templatePath: string = join(tmp, "bad-config-template");
    mkdirSync(templatePath);
    await Bun.write(join(templatePath, ".mouldconfig.json"), '{ "inputs": [ { "id": "x" } ] }');
    await expect(loadTemplateConfig(templatePath)).rejects.toBeInstanceOf(TemplateConfigError);
  });
});
