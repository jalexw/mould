import { ConditionSyntaxError } from "@/lib/errors";
import {
  evaluateCondition,
  parseCondition,
  type Condition,
} from "./parseCondition";
import type { MouldInputItemDefinition } from "@/types/MouldInputItemDefinition";
import { validateCondition } from "./parseCondition";

/**
 * A marker is a whole line: optional comment leader, the directive, optional
 * comment trailer. Matching the leader/trailer explicitly (rather than
 * "anywhere on the line") keeps prose that merely mentions `mould:if` intact.
 *
 *   # mould:if deployment == vercel        (YAML, dotenv, sh)
 *   // mould:else                          (TS/JS)
 *   {/* mould:endif *\/}                    (TSX)
 *   <!-- mould:if with_docs -->            (Markdown/HTML)
 */
const MARKER_RE =
  /^\s*(?:\{?\/\*|<!--|#|\/\/|--|;|\*)?\s*mould:(if|else|endif)\b\s*(.*?)\s*(?:\*\/\}?|-->)?\s*$/;

/** Cheap pre-check so files without markers skip the line-by-line pass. */
export const MARKER_SUBSTRING = "mould:" as const;

export interface IConditionalBlockMarker {
  directive: "if" | "else" | "endif";
  expression: string;
  line: number;
}

/** Every marker in `text`, in order — used both for validation and stripping. */
export function findConditionalMarkers(text: string): readonly IConditionalBlockMarker[] {
  if (!text.includes(MARKER_SUBSTRING)) {
    return [];
  }
  const markers: IConditionalBlockMarker[] = [];
  const lines: readonly string[] = text.split("\n");
  lines.forEach((rawLine: string, index: number): void => {
    const line: string = rawLine.endsWith("\r") ? rawLine.slice(0, -1) : rawLine;
    if (!line.includes(MARKER_SUBSTRING)) {
      return;
    }
    const match: RegExpMatchArray | null = line.match(MARKER_RE);
    if (!match) {
      return;
    }
    markers.push({
      directive: match[1] as "if" | "else" | "endif",
      expression: match[2] ?? "",
      line: index + 1,
    });
  });
  return markers;
}

/**
 * Validate the block structure of a file and every `mould:if` expression in it
 * against the declared inputs. Throws `ConditionSyntaxError`; returns nothing.
 */
export function validateConditionalBlocks(
  text: string,
  inputs: readonly MouldInputItemDefinition[],
  file: string,
): void {
  let open: IConditionalBlockMarker | null = null;
  let seenElse: boolean = false;
  for (const marker of findConditionalMarkers(text)) {
    const location = { file, line: marker.line };
    if (marker.directive === "if") {
      if (open) {
        throw new ConditionSyntaxError(
          "Nested `mould:if` blocks are not supported",
          marker.expression,
          location,
        );
      }
      if (!marker.expression) {
        throw new ConditionSyntaxError("`mould:if` needs an expression", "", location);
      }
      validateCondition(marker.expression, inputs, location);
      open = marker;
      seenElse = false;
    } else if (marker.directive === "else") {
      if (!open) {
        throw new ConditionSyntaxError("`mould:else` without a preceding `mould:if`", marker.expression, location);
      }
      if (seenElse) {
        throw new ConditionSyntaxError("A `mould:if` block may only have one `mould:else`", marker.expression, location);
      }
      if (marker.expression) {
        throw new ConditionSyntaxError("`mould:else` does not take an expression", marker.expression, location);
      }
      seenElse = true;
    } else {
      if (!open) {
        throw new ConditionSyntaxError("`mould:endif` without a preceding `mould:if`", marker.expression, location);
      }
      if (marker.expression) {
        throw new ConditionSyntaxError("`mould:endif` does not take an expression", marker.expression, location);
      }
      open = null;
      seenElse = false;
    }
  }
  if (open) {
    throw new ConditionSyntaxError(
      "`mould:if` block is never closed with `mould:endif`",
      open.expression,
      { file, line: open.line },
    );
  }
}

/**
 * Remove marker lines and the lines of inactive branches. Assumes the file
 * was validated with `validateConditionalBlocks` (malformed input still throws,
 * with less precise messages). Line endings are preserved.
 */
export function applyConditionalBlocks(
  text: string,
  values: Readonly<Record<string, string>>,
  file?: string,
): string {
  if (!text.includes(MARKER_SUBSTRING)) {
    return text;
  }

  const lines: readonly string[] = text.split("\n");
  const output: string[] = [];

  let condition: Condition | null = null;
  let keeping: boolean = true;

  lines.forEach((rawLine: string, index: number): void => {
    const line: string = rawLine.endsWith("\r") ? rawLine.slice(0, -1) : rawLine;
    const match: RegExpMatchArray | null = line.includes(MARKER_SUBSTRING)
      ? line.match(MARKER_RE)
      : null;

    if (!match) {
      if (keeping) {
        output.push(rawLine);
      }
      return;
    }

    const directive: string = match[1]!;
    const expression: string = match[2] ?? "";
    const location = { file, line: index + 1 };

    if (directive === "if") {
      if (condition) {
        throw new ConditionSyntaxError("Nested `mould:if` blocks are not supported", expression, location);
      }
      condition = parseCondition(expression, location);
      keeping = evaluateCondition(condition, values);
    } else if (directive === "else") {
      if (!condition) {
        throw new ConditionSyntaxError("`mould:else` without a preceding `mould:if`", expression, location);
      }
      keeping = !evaluateCondition(condition, values);
    } else {
      if (!condition) {
        throw new ConditionSyntaxError("`mould:endif` without a preceding `mould:if`", expression, location);
      }
      condition = null;
      keeping = true;
    }
  });

  if (condition) {
    throw new ConditionSyntaxError(
      "`mould:if` block is never closed with `mould:endif`",
      (condition as Condition).id,
      { file },
    );
  }

  return output.join("\n");
}
