import type { MouldInputItemDefinition } from "@/types/MouldInputItemDefinition";
import {
  InvalidInputValueError,
  MissingRequiredInputError,
} from "@/lib/errors";

/** Values a caller may hand in before resolution. */
export type ProvidedInputValues = Readonly<Record<string, string | boolean>>;

/** Values after resolution: every declared input present, booleans stringified. */
export type ResolvedInputValues = Record<string, string>;

/**
 * Interactive fallback: asked for each input that has no value yet. Return the
 * raw answer; an empty string means "no answer". Called again when the answer
 * is invalid, with the validation error, so a CLI can re-prompt.
 */
export type PromptForInput = (
  input: MouldInputItemDefinition,
  previousError?: InvalidInputValueError,
) => Promise<string>;

const TRUE_WORDS: ReadonlySet<string> = new Set(["true", "yes", "y", "1"]);
const FALSE_WORDS: ReadonlySet<string> = new Set(["false", "no", "n", "0"]);

/**
 * Validate one raw value against its input definition and normalise it
 * (booleans become "true"/"false"). Throws `InvalidInputValueError`.
 */
export function normalizeInputValue(
  input: MouldInputItemDefinition,
  raw: string | boolean,
): string {
  if (input.type === "boolean") {
    if (typeof raw === "boolean") {
      return raw ? "true" : "false";
    }
    const word: string = raw.trim().toLowerCase();
    if (TRUE_WORDS.has(word)) return "true";
    if (FALSE_WORDS.has(word)) return "false";
    throw new InvalidInputValueError(
      input.id,
      raw,
      "expected one of true/false, yes/no, y/n or 1/0",
    );
  }

  const value: string = typeof raw === "boolean" ? String(raw) : raw;

  if (input.type === "select") {
    if (!input.options.includes(value)) {
      throw new InvalidInputValueError(
        input.id,
        value,
        `expected one of: ${input.options.join(", ")}`,
      );
    }
    return value;
  }

  if (input.pattern !== undefined && value !== "" && !new RegExp(input.pattern).test(value)) {
    throw new InvalidInputValueError(
      input.id,
      value,
      `does not match pattern ${input.pattern}`,
    );
  }
  return value;
}

function defaultValueOf(input: MouldInputItemDefinition): string | undefined {
  if (input.default === undefined) {
    return undefined;
  }
  return typeof input.default === "boolean"
    ? input.default
      ? "true"
      : "false"
    : input.default;
}

/**
 * Turn the values a caller supplied into the complete set of values the export
 * engine substitutes and evaluates conditions over.
 *
 * Per declared input: supplied value → `default` → `""`. A `required` input
 * that ends up empty is collected into a single `MissingRequiredInputError`
 * (after asking `prompt`, when one is given). Keys the template never declared
 * pass through untouched, so substitutions referencing an undeclared id keep
 * working.
 */
export async function resolveInputs(
  inputs: readonly MouldInputItemDefinition[] | undefined,
  provided: ProvidedInputValues = {},
  prompt?: PromptForInput,
): Promise<ResolvedInputValues> {
  const resolved: ResolvedInputValues = {};

  for (const [key, value] of Object.entries(provided)) {
    resolved[key] = typeof value === "boolean" ? (value ? "true" : "false") : value;
  }

  const missing: string[] = [];

  for (const input of inputs ?? []) {
    let value: string | undefined;

    if (input.id in provided) {
      value = normalizeInputValue(input, provided[input.id]!);
    } else if (prompt) {
      let previousError: InvalidInputValueError | undefined;
      for (;;) {
        const answer: string = (await prompt(input, previousError)).trim();
        if (answer === "") {
          value = defaultValueOf(input);
          break;
        }
        try {
          value = normalizeInputValue(input, answer);
          break;
        } catch (e: unknown) {
          if (e instanceof InvalidInputValueError) {
            previousError = e;
            continue;
          }
          throw e;
        }
      }
    } else {
      value = defaultValueOf(input);
    }

    if (value === undefined || value === "") {
      if (input.required) {
        missing.push(input.id);
      }
      value = value ?? "";
    }

    resolved[input.id] = value;
  }

  if (missing.length > 0) {
    throw new MissingRequiredInputError(missing);
  }

  return resolved;
}

export default resolveInputs;
