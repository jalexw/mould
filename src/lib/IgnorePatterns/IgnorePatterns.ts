/**
 * @name IgnorePatterns
 * @description Compiles the `ignorePatterns` list from a template's
 * `.mouldconfig.json` into a matcher that decides whether a given entry in the
 * template tree should be left out of the export.
 *
 * Patterns follow a `.gitignore`-style subset:
 *  - `dist/`            a directory named `dist`, at any depth
 *  - `dist`             a file *or* directory named `dist`, at any depth
 *  - `*.log`            any file or directory whose name matches, at any depth
 *  - `/coverage`        anchored to the template root
 *  - `src/generated/`   a pattern containing a `/` is relative to the template root
 *  - `**​/fixtures/`     `**` matches any number of directories
 *  - `docs/**`          everything below `docs`
 *
 * `*` and `?` never match a `/`. Negation (`!pattern`) is not supported.
 */

export interface IIgnorePatternCandidate {
  /** Path segments relative to the template root, e.g. `["src", "index.ts"]` */
  relativePath: readonly string[];
  isDirectory: boolean;
}

export type IgnorePatternMatcher = (
  candidate: IIgnorePatternCandidate,
) => boolean;

interface ICompiledIgnorePattern {
  source: string;
  regex: RegExp;
  directoryOnly: boolean;
  /** `true` when the pattern is matched against the whole relative path rather than the entry name */
  matchesFullPath: boolean;
}

function escapeRegExp(literal: string): string {
  return literal.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");
}

/**
 * Translate a glob (already stripped of leading/trailing slashes) into a
 * regular expression source that matches a `/`-joined path.
 */
function globToRegExpSource(glob: string): string {
  let out: string = "";
  let i: number = 0;
  while (i < glob.length) {
    const char: string = glob[i]!;

    if (char === "*") {
      const isDoubleStar: boolean = glob[i + 1] === "*";
      if (isDoubleStar) {
        const followedBySlash: boolean = glob[i + 2] === "/";
        const atEnd: boolean = i + 2 >= glob.length;
        if (followedBySlash) {
          // `**/` — zero or more whole directories
          out += "(?:[^/]+/)*";
          i += 3;
          continue;
        } else if (atEnd) {
          // trailing `**` — anything, including `/`
          out += ".*";
          i += 2;
          continue;
        }
        // `**` glued to other characters behaves like `*`
        out += "[^/]*";
        i += 2;
        continue;
      }
      out += "[^/]*";
      i += 1;
      continue;
    }

    if (char === "?") {
      out += "[^/]";
      i += 1;
      continue;
    }

    if (char === "[") {
      const closing: number = glob.indexOf("]", i + 1);
      if (closing !== -1) {
        let body: string = glob.slice(i + 1, closing);
        if (body.startsWith("!")) {
          body = "^" + body.slice(1);
        }
        out += `[${body.replace(/\\/g, "\\\\")}]`;
        i = closing + 1;
        continue;
      }
    }

    if (char === "\\" && i + 1 < glob.length) {
      out += escapeRegExp(glob[i + 1]!);
      i += 2;
      continue;
    }

    out += escapeRegExp(char);
    i += 1;
  }
  return out;
}

export function compileIgnorePattern(
  pattern: string,
): ICompiledIgnorePattern | null {
  if (typeof pattern !== "string") {
    throw new TypeError("Expected ignore pattern to be a string!");
  }

  let glob: string = pattern.trim();
  if (glob.length === 0) {
    return null;
  }

  let directoryOnly: boolean = false;
  while (glob.endsWith("/")) {
    directoryOnly = true;
    glob = glob.slice(0, -1);
  }

  let anchored: boolean = false;
  while (glob.startsWith("/")) {
    anchored = true;
    glob = glob.slice(1);
  }

  if (glob.length === 0) {
    return null;
  }

  // A pattern with no `/` (other than the leading/trailing ones stripped
  // above) matches the entry *name* at any depth, unless it was anchored.
  const matchesFullPath: boolean = anchored || glob.includes("/");

  // A pattern that opens with `**/` already matches at any depth
  let source: string = globToRegExpSource(glob);
  if (glob.endsWith("/**")) {
    // `docs/**` should match `docs` itself as well as everything beneath it
    source = `${globToRegExpSource(glob.slice(0, -3))}(?:/.*)?`;
  }

  return {
    source: pattern,
    regex: new RegExp(`^${source}$`),
    directoryOnly,
    matchesFullPath,
  };
}

export function compileIgnorePatterns(
  patterns: readonly string[] | undefined,
): IgnorePatternMatcher {
  const compiled: readonly ICompiledIgnorePattern[] = (patterns ?? [])
    .map(compileIgnorePattern)
    .filter(
      (maybe: ICompiledIgnorePattern | null): maybe is ICompiledIgnorePattern =>
        maybe !== null,
    );

  if (compiled.length === 0) {
    return (): boolean => false;
  }

  return ({ relativePath, isDirectory }: IIgnorePatternCandidate): boolean => {
    if (relativePath.length === 0) {
      return false;
    }
    const name: string = relativePath[relativePath.length - 1]!;
    const fullPath: string = relativePath.join("/");

    for (const pattern of compiled) {
      if (pattern.directoryOnly && !isDirectory) {
        continue;
      }
      const subject: string = pattern.matchesFullPath ? fullPath : name;
      if (pattern.regex.test(subject)) {
        return true;
      }
    }
    return false;
  };
}

export default compileIgnorePatterns;
