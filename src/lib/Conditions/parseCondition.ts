import { ConditionSyntaxError } from "@/lib/errors";
import type { MouldInputItemDefinition } from "@/types/MouldInputItemDefinition";

/**
 * A parsed `when` / `mould:if` expression.
 *
 * Grammar (deliberately tiny — no `&&`, `||`, parentheses or nesting):
 *
 *   expr  := ident | ident "==" value | ident "!=" value
 *   ident := [A-Za-z_][A-Za-z0-9_]*
 *   value := [A-Za-z0-9_.:/@+-]+ | '"' [^"]* '"' | "'" [^']* "'"
 */
export type Condition =
  | { readonly kind: "truthy"; readonly id: string }
  | { readonly kind: "equals"; readonly id: string; readonly value: string; readonly negated: boolean };

const CONDITION_RE =
  /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*(?:(==|!=)\s*(?:"([^"]*)"|'([^']*)'|([A-Za-z0-9_.:/@+-]+)))?\s*$/;

const cache = new Map<string, Condition>();

export function parseCondition(
  expression: string,
  location?: { file?: string; line?: number },
): Condition {
  const cached: Condition | undefined = cache.get(expression);
  if (cached) {
    return cached;
  }

  const match: RegExpMatchArray | null = expression.match(CONDITION_RE);
  if (!match) {
    throw new ConditionSyntaxError(
      "Expected `<input_id>`, `<input_id> == <value>` or `<input_id> != <value>`",
      expression,
      location,
    );
  }

  const id: string = match[1]!;
  const operator: string | undefined = match[2];

  let condition: Condition;
  if (operator === undefined) {
    condition = { kind: "truthy", id };
  } else {
    const value: string = match[3] ?? match[4] ?? match[5] ?? "";
    condition = { kind: "equals", id, value, negated: operator === "!=" };
  }

  cache.set(expression, condition);
  return condition;
}

/**
 * Check an expression against the template's declared inputs, so mistakes
 * surface when the config is loaded rather than as a silently-false condition.
 */
export function validateCondition(
  expression: string,
  inputs: readonly MouldInputItemDefinition[],
  location?: { file?: string; line?: number },
): Condition {
  const condition: Condition = parseCondition(expression, location);
  const input: MouldInputItemDefinition | undefined = inputs.find(
    (def: MouldInputItemDefinition): boolean => def.id === condition.id,
  );

  if (!input) {
    throw new ConditionSyntaxError(
      `Condition references undeclared input '${condition.id}'`,
      expression,
      location,
    );
  }

  if (condition.kind === "equals") {
    if (input.type === "select" && !input.options.includes(condition.value)) {
      throw new ConditionSyntaxError(
        `'${condition.value}' is not one of the options of select input '${input.id}' (${input.options.join(", ")})`,
        expression,
        location,
      );
    }
    if (input.type === "boolean" && condition.value !== "true" && condition.value !== "false") {
      throw new ConditionSyntaxError(
        `Boolean input '${input.id}' can only be compared to 'true' or 'false'`,
        expression,
        location,
      );
    }
  }

  return condition;
}

/**
 * Evaluate a condition over resolved input values (booleans are already the
 * strings "true"/"false"). A bare identifier is true when its value is neither
 * empty nor "false"; an unknown identifier is false.
 */
export function evaluateCondition(
  condition: Condition,
  values: Readonly<Record<string, string>>,
): boolean {
  const value: string = values[condition.id] ?? "";
  if (condition.kind === "truthy") {
    return value !== "" && value !== "false";
  }
  const equal: boolean = value === condition.value;
  return condition.negated ? !equal : equal;
}

export function evaluateConditionExpression(
  expression: string,
  values: Readonly<Record<string, string>>,
): boolean {
  return evaluateCondition(parseCondition(expression), values);
}
