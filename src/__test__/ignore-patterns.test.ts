// @ts-ignore
import { describe, expect, test } from "bun:test";

import {
  compileIgnorePattern,
  compileIgnorePatterns,
  type IgnorePatternMatcher,
} from "@/lib/IgnorePatterns";

function file(path: string) {
  return { relativePath: path.split("/"), isDirectory: false };
}

function dir(path: string) {
  return { relativePath: path.split("/"), isDirectory: true };
}

describe("ignorePatterns", () => {
  test("no patterns ignores nothing", () => {
    const ignore: IgnorePatternMatcher = compileIgnorePatterns(undefined);
    expect(ignore(file("dist/index.js"))).toBeFalse();
    expect(ignore(dir("node_modules"))).toBeFalse();
    expect(compileIgnorePatterns([])(dir("dist"))).toBeFalse();
  });

  test("blank patterns are dropped", () => {
    expect(compileIgnorePattern("")).toBeNull();
    expect(compileIgnorePattern("   ")).toBeNull();
    expect(compileIgnorePattern("/")).toBeNull();
    expect(compileIgnorePatterns(["", "  "])(dir("dist"))).toBeFalse();
  });

  test("a trailing slash matches directories only, at any depth", () => {
    const ignore = compileIgnorePatterns(["dist/"]);
    expect(ignore(dir("dist"))).toBeTrue();
    expect(ignore(dir("packages/app/dist"))).toBeTrue();
    expect(ignore(file("dist"))).toBeFalse();
    expect(ignore(file("dist.txt"))).toBeFalse();
    expect(ignore(dir("distribution"))).toBeFalse();
  });

  test("a bare name matches files and directories, at any depth", () => {
    const ignore = compileIgnorePatterns(["node_modules"]);
    expect(ignore(dir("node_modules"))).toBeTrue();
    expect(ignore(file("node_modules"))).toBeTrue();
    expect(ignore(dir("packages/app/node_modules"))).toBeTrue();
    expect(ignore(file("src/node_modules.ts"))).toBeFalse();
  });

  test("wildcards match within a single path segment", () => {
    const ignore = compileIgnorePatterns(["*.log", "?.tmp"]);
    expect(ignore(file("debug.log"))).toBeTrue();
    expect(ignore(file("logs/2024-01-01.log"))).toBeTrue();
    expect(ignore(file("a.tmp"))).toBeTrue();
    expect(ignore(file("ab.tmp"))).toBeFalse();
    expect(ignore(file("debug.log.bak"))).toBeFalse();
    // a directory happening to end in '.log' is matched too (no trailing slash)
    expect(ignore(dir("archive.log"))).toBeTrue();
  });

  test("a leading slash anchors the pattern to the template root", () => {
    const ignore = compileIgnorePatterns(["/coverage"]);
    expect(ignore(dir("coverage"))).toBeTrue();
    expect(ignore(file("coverage"))).toBeTrue();
    expect(ignore(dir("packages/app/coverage"))).toBeFalse();
  });

  test("a pattern containing a slash is relative to the template root", () => {
    const ignore = compileIgnorePatterns(["src/generated/", "docs/*.md"]);
    expect(ignore(dir("src/generated"))).toBeTrue();
    expect(ignore(dir("packages/app/src/generated"))).toBeFalse();
    expect(ignore(file("docs/README.md"))).toBeTrue();
    expect(ignore(file("docs/nested/README.md"))).toBeFalse();
    expect(ignore(file("README.md"))).toBeFalse();
  });

  test("double star matches any number of directories", () => {
    const ignore = compileIgnorePatterns([
      "**/fixtures/",
      "src/**/*.snap",
      "docs/**",
    ]);
    expect(ignore(dir("fixtures"))).toBeTrue();
    expect(ignore(dir("a/b/c/fixtures"))).toBeTrue();
    expect(ignore(file("src/a.snap"))).toBeTrue();
    expect(ignore(file("src/deep/er/a.snap"))).toBeTrue();
    expect(ignore(file("lib/a.snap"))).toBeFalse();
    expect(ignore(dir("docs"))).toBeTrue();
    expect(ignore(file("docs/guide/intro.md"))).toBeTrue();
    expect(ignore(file("documentation/intro.md"))).toBeFalse();
  });

  test("character classes and escapes", () => {
    const ignore = compileIgnorePatterns(["[ab].txt", "\\*.raw"]);
    expect(ignore(file("a.txt"))).toBeTrue();
    expect(ignore(file("b.txt"))).toBeTrue();
    expect(ignore(file("c.txt"))).toBeFalse();
    expect(ignore(file("*.raw"))).toBeTrue();
    expect(ignore(file("x.raw"))).toBeFalse();
  });

  test("regex metacharacters in patterns are literal", () => {
    const ignore = compileIgnorePatterns(["a.b", "(x)", "a+b"]);
    expect(ignore(file("a.b"))).toBeTrue();
    expect(ignore(file("axb"))).toBeFalse();
    expect(ignore(file("(x)"))).toBeTrue();
    expect(ignore(file("x"))).toBeFalse();
    expect(ignore(file("a+b"))).toBeTrue();
    expect(ignore(file("aab"))).toBeFalse();
  });

  test("the template root itself is never ignored", () => {
    const ignore = compileIgnorePatterns(["*", "**"]);
    expect(ignore({ relativePath: [], isDirectory: true })).toBeFalse();
  });
});
