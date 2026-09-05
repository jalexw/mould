// @ts-ignore
import { describe, expect, test } from "bun:test";
import {
  parseCondition,
  evaluateCondition,
  applyConditionalBlocks,
  validateConditionalBlocks,
  validateCondition,
} from "@/lib/Conditions";
import { ConditionSyntaxError } from "@/lib/errors";
import type { MouldInputItemDefinition } from "@/types/MouldInputItemDefinition";

describe("parseCondition", () => {
  test("parses the three supported shapes", () => {
    expect(parseCondition("flag")).toEqual({ kind: "truthy", id: "flag" });
    expect(parseCondition(" deployment == vercel ")).toEqual({
      kind: "equals",
      id: "deployment",
      value: "vercel",
      negated: false,
    });
    expect(parseCondition("deployment!=none")).toEqual({
      kind: "equals",
      id: "deployment",
      value: "none",
      negated: true,
    });
    expect(parseCondition(`name == "hello world"`)).toEqual({
      kind: "equals",
      id: "name",
      value: "hello world",
      negated: false,
    });
    expect(parseCondition("url == https://example.com/a")).toEqual({
      kind: "equals",
      id: "url",
      value: "https://example.com/a",
      negated: false,
    });
  });

  test("rejects anything outside the grammar", () => {
    for (const bad of ["", "a && b", "a == b == c", "1abc", "a = b", "!flag", "a == (b)"]) {
      expect(() => parseCondition(bad)).toThrow(ConditionSyntaxError);
    }
  });
});

describe("evaluateCondition", () => {
  const values = { deployment: "vercel", on: "true", off: "false", empty: "", text: "x" };

  test("bare identifiers are truthy unless empty or 'false'", () => {
    expect(evaluateCondition(parseCondition("on"), values)).toBeTrue();
    expect(evaluateCondition(parseCondition("text"), values)).toBeTrue();
    expect(evaluateCondition(parseCondition("off"), values)).toBeFalse();
    expect(evaluateCondition(parseCondition("empty"), values)).toBeFalse();
    expect(evaluateCondition(parseCondition("missing"), values)).toBeFalse();
  });

  test("== and != compare exactly", () => {
    expect(evaluateCondition(parseCondition("deployment == vercel"), values)).toBeTrue();
    expect(evaluateCondition(parseCondition("deployment == Vercel"), values)).toBeFalse();
    expect(evaluateCondition(parseCondition("deployment != vercel"), values)).toBeFalse();
    expect(evaluateCondition(parseCondition("deployment != none"), values)).toBeTrue();
    expect(evaluateCondition(parseCondition("missing != none"), values)).toBeTrue();
  });
});

describe("validateCondition", () => {
  const inputs: readonly MouldInputItemDefinition[] = [
    { id: "deployment", label: "D", required: false, type: "select", options: ["vercel", "none"] },
    { id: "flag", label: "F", required: false, type: "boolean" },
    { id: "name", label: "N", required: true, type: "text" },
  ];

  test("accepts conditions over declared inputs", () => {
    validateCondition("deployment == vercel", inputs);
    validateCondition("flag", inputs);
    validateCondition("flag == false", inputs);
    validateCondition("name != bob", inputs);
  });

  test("rejects undeclared ids, unknown select options and non-boolean literals", () => {
    expect(() => validateCondition("nope", inputs)).toThrow(/undeclared input 'nope'/);
    expect(() => validateCondition("deployment == azure", inputs)).toThrow(/not one of the options/);
    expect(() => validateCondition("flag == yes", inputs)).toThrow(/'true' or 'false'/);
  });
});

describe("applyConditionalBlocks", () => {
  const values = { deployment: "vercel", flag: "false" };

  test("strips marker lines and inactive branches for every comment leader", () => {
    const cases: readonly [string, string][] = [
      [
        "a\n# mould:if deployment == vercel\nkept\n# mould:endif\nb\n",
        "a\nkept\nb\n",
      ],
      [
        "a\n// mould:if flag\ndropped\n// mould:else\nkept\n// mould:endif\nb\n",
        "a\nkept\nb\n",
      ],
      [
        "<p/>\n{/* mould:if flag */}\n<Dropped />\n{/* mould:endif */}\n<q/>\n",
        "<p/>\n<q/>\n",
      ],
      [
        "x\n<!-- mould:if deployment != none -->\nkept\n<!-- mould:else -->\ndropped\n<!-- mould:endif -->\n",
        "x\nkept\n",
      ],
      [
        "  # mould:if deployment == vercel\n  indented: kept\n  # mould:endif\n",
        "  indented: kept\n",
      ],
    ];
    for (const [input, expected] of cases) {
      expect(applyConditionalBlocks(input, values)).toEqual(expected);
    }
  });

  test("preserves CRLF line endings", () => {
    expect(
      applyConditionalBlocks("a\r\n# mould:if flag\r\nx\r\n# mould:endif\r\nb\r\n", values),
    ).toEqual("a\r\nb\r\n");
  });

  test("leaves files without markers untouched, including prose mentioning them", () => {
    const text = "Use `mould:if` markers to do things.\nplain\n";
    expect(applyConditionalBlocks(text, values)).toEqual(text);
    const noMarkers = "just\nsome\ntext";
    expect(applyConditionalBlocks(noMarkers, values)).toBe(noMarkers);
  });

  test("rejects malformed block structure", () => {
    const inputs: readonly MouldInputItemDefinition[] = [
      { id: "flag", label: "F", required: false, type: "boolean" },
    ];
    const bad: readonly [string, RegExp][] = [
      ["# mould:if flag\nx\n", /never closed/],
      ["# mould:if flag\n# mould:if flag\nx\n# mould:endif\n# mould:endif\n", /Nested/],
      ["# mould:else\n", /without a preceding/],
      ["# mould:endif\n", /without a preceding/],
      ["# mould:if flag\n# mould:else\n# mould:else\n# mould:endif\n", /only have one/],
      ["# mould:if\nx\n# mould:endif\n", /needs an expression/],
      ["# mould:if flag\nx\n# mould:endif flag\n", /does not take an expression/],
    ];
    for (const [text, message] of bad) {
      expect(() => validateConditionalBlocks(text, inputs, "file.txt")).toThrow(message);
    }
    expect(() => validateConditionalBlocks("# mould:if flag\nx\n", inputs, "f.txt")).toThrow(
      ConditionSyntaxError,
    );
  });
});
