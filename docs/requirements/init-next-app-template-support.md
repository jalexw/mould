# Requirements: supporting `@schemavaults/init-next-app` as a mould template

Status: implemented in `@jalexw/mould` 0.7.0 (MUST and SHOULD items); COULD items remain open.

## 1. Motivation

[`@schemavaults/init-next-app`](https://github.com/schemavaults/init-next-app) scaffolds a
Next.js application. Until now it did so from ~40 TypeScript "builder" files, each returning a
template-literal string that was written to disk by a hand-maintained orchestrator. Editing the
generated app meant editing `.tsx`, `.yml` and `.json` inside TypeScript strings: no syntax
highlighting, no type checking, no eslint, and hand-escaped `\${{ secrets.X }}`.

The rewrite turns the generated app into a **real directory of files** — a mould template that is
itself an installable, type-checkable Next.js project — and renders it with mould. That use case
puts three demands on mould that its 0.6.0 feature set (copy a directory, regex-substitute file
contents, skip `ignorePatterns`) could not meet:

1. The template is **driven programmatically** by another CLI, which collects and validates its
   own inputs and runs its own post-generation steps (`bun install`, codegen).
2. The template is **shipped inside another package's npm tarball**. npm renames a packed
   `.gitignore` to `.npmignore` and applies nested `.gitignore` rules while packing, so the
   `.gitignore` meant for the *generated* app cannot be stored under that name.
3. Part of the output is **conditional on an input** (`--deployment vercel|none` decides whether
   `vercel.json` exists and whether a Vercel job / `VERCEL_*` variables appear in two files),
   and one file must be **executable**.

## 2. The template shape that must be expressible

```
templates/schemavaults-next-app/
  .mouldconfig.json
  _gitignore                          → written as .gitignore            (rename on copy)
  package.json                        "name": "xxx_project_name_xxx"      (literal placeholder)
  docker-compose.yml                  image: cypress/included:xxx_cypress_version_xxx
  .env.local                          SCHEMAVAULTS_CLIENT_APP_ID="xxx_client_app_id_xxx"
  .env.example                        # mould:if deployment == vercel … # mould:endif
  .github/workflows/ci.yml            # mould:if deployment == vercel … # mould:endif
  vercel.json                         only when deployment == vercel     (conditional path)
  .claude/hooks/install-deps.sh       mode 0755 must survive              (file mode)
  public/.gitkeep                     ignored, but public/ still created
  src/app/**/*.tsx, src/db/*.ts …     real, type-checked source files
```

Properties the template relies on:

- Placeholders are lowercase identifier-safe tokens (`xxx_<id>_xxx`) so the template is *valid*
  where they sit: an npm package name, a dotenv value, a Postgres database name, a JSX text node.
  The template directory therefore installs and type-checks unmodified.
- Conditional markers live inside comments of the host language (`# …` in YAML/dotenv/sh,
  `// …` in TS, `{/* … */}` in TSX, `<!-- … -->` in Markdown) so IDE tooling never sees them
  as errors.
- One value (the auth server URL) is substituted from its **real default**
  (`https://auth.schemavaults.com`) rather than a token, so the template runs against the default
  server in development. This needs a *literal* (non-regex) find string, or the `.` would need
  escaping.

## 3. Requirements

Each requirement lists the problem, the proposal, and acceptance criteria.

### R1 — Programmatic API (MUST)

**Problem.** The package only exports `run(argv)` and the commander class. Library code calls
`process.exit(1)` on every error path, which kills the host process.

**Proposal.** Export from the package root:

```ts
applyTemplate({ templatePath, outputPath, inputs?, onWarning? })
  → Promise<{ templatePath, outputPath, inputs, writtenFiles, skippedFiles }>
loadTemplateConfig(templatePath) → Promise<ITemplateConfig>
resolveInputs(definitions, provided, prompt?) → Promise<Record<string, string>>
```

plus the error classes (`MouldError` and subclasses: `TemplateNotFoundError`,
`TemplateConfigError`, `OutputPathExistsError`, `OutputParentMissingError`,
`MissingRequiredInputError`, `InvalidInputValueError`, `ConditionSyntaxError`,
`RenameConflictError`). The template is addressed by **directory path**; no
`template-sources.json` is involved. The API must not read mould's own `package.json` or depend on
`import.meta.url`, so it keeps working when bundled into another CLI.

**Acceptance.** `applyTemplate` on a fixture returns the written file list; a second call on the
same output path rejects with `OutputPathExistsError`; a missing required input rejects with
`MissingRequiredInputError` whose `inputIds` names it; nothing in `src/lib/**` calls `process.exit`.

### R2 — Rename on copy (MUST)

**Problem.** A `.gitignore` for the generated app cannot be stored as `.gitignore` in a template
that is published to npm. More generally, some files can only exist in the template under a
different name than in the output.

**Proposal.** `.mouldconfig.json` gains `"renames": { "<template path>": "<output path>" }`, both
POSIX, relative, without `..`. A key may name a file or a directory (a directory key rewrites its
subtree). Two sources mapping to one target, or a target colliding with a copied file, fail with
`RenameConflictError`; a key that matches nothing is a warning (the file may have been dropped by a
conditional). The documented idiom is `"_gitignore": ".gitignore"`.

**Acceptance.** A fixture with `_gitignore` and `config/_npmrc` exports exactly `.gitignore`,
`config/.npmrc` (contents intact) and no `_`-prefixed names.

### R3 — Input types, defaults, validation (MUST)

**Problem.** `type` is `"text"` only; there are no defaults and no validation, so an enum-like
choice (`vercel|none`) or a yes/no cannot be declared, and a value with a sensible default must
still be supplied.

**Proposal.** Discriminated union on `type`:

| type | extra fields | CLI value |
| --- | --- | --- |
| `text` | `default?: string`, `pattern?: string` (regex source, author-anchored) | any string |
| `select` | `options: string[]` (non-empty), `default?: string` (∈ options) | one of the options |
| `boolean` | `default?: boolean` | `true/false/yes/no/y/n/1/0`, case-insensitive |

Booleans are normalised to the strings `"true"`/`"false"` before substitution. Invalid values fail
with `InvalidInputValueError` (interactive mode re-prompts instead).

**Acceptance.** `mould inputs` shows `options` and `default`; `--input deployment=azure` on a
`select` fails; `--input with_docs=yes` renders as `true`; a `text` value violating `pattern` fails.

### R4 — Conditional paths (MUST)

**Problem.** `vercel.json` must exist only for one deployment strategy. `ignorePatterns` is static.

**Proposal.** `"conditionalPaths": [{ "when": "<expr>", "paths": ["/vercel.json", "docs/"] }]`.
`paths` use the `ignorePatterns` glob grammar (same compiler); when `when` is false the matches are
pruned (directories whole) and reported in `skippedFiles`.

**Acceptance.** Rendering the same fixture with `deployment=vercel` and `deployment=none` produces
and omits `vercel.json` respectively; a pruned directory's children are neither copied nor read.

### R5 — Conditional line blocks (MUST)

**Problem.** Two files need a *section* included or removed, and must stay valid YAML / dotenv in
the IDE — so no `{{#if}}` templating language.

**Proposal.** Marker **lines**: an optional comment leader, then `mould:if <expr>`, `mould:else`,
or `mould:endif`, then an optional comment trailer:

```yaml
  # mould:if deployment == vercel
  publish-to-vercel:
    needs: build
  # mould:endif
```
```tsx
{/* mould:if with_analytics */}
<Analytics />
{/* mould:else */}
{/* mould:endif */}
```

Marker lines are always removed; lines in an inactive branch are removed; everything else is
untouched (line endings preserved). Nesting, `else`/`endif` without `if`, and end-of-file inside a
block are `ConditionSyntaxError`s naming the file and line. Files without the substring `mould:`
skip the pass. JSON cannot host markers (no comments) — use R4 or variant files there.

**Acceptance.** No line matching `mould:(if|else|endif)` survives in any rendered file; the active
branch's lines are present and the inactive branch's absent; the malformed fixtures reject.

### R6 — Condition expression grammar (MUST)

Shared by R4 and R5, deliberately tiny:

```
expr  := ident | ident "==" value | ident "!=" value
ident := [A-Za-z_][A-Za-z0-9_]*
value := [A-Za-z0-9_.:/@+-]+ | '"' [^"]* '"' | "'" [^']* "'"
```

A bare `ident` is true when its value is neither `""` nor `"false"`. Every `ident` must be a
declared input; a `select` literal must be one of its options; a `boolean` compares only to
`true`/`false`. Violations are `ConditionSyntaxError`s raised when the config is loaded, before
anything is written. No `&&`, `||`, parentheses or nesting.

### R7 — Preserve file mode (MUST)

**Problem.** Output files are written with the default mode, so an executable hook script arrives
non-executable.

**Proposal.** Record `lstat().mode & 0o777` for every template file and pass it as `mode` when
writing. (No-op on Windows; symlinks stay out of scope.)

**Acceptance.** A fixture script committed `100755` is executable in the output.

### R8 — `--input` parsing and required-only enforcement (MUST)

**Problem.** `--input k=v` splits on every `=`, so a URL with a query string or a description
containing `=` throws; an empty value throws; and non-interactive mode demands *every* declared
input, optional ones included.

**Proposal.** Split at the first `=` only; allow `k=` (empty). Non-interactively, only `required`
inputs without a value fail; optional inputs fall back to `default`, then `""`.

**Acceptance.** `--input favorite_color=a=b` yields `a=b`; omitting an optional input succeeds.

### R9 — Literal substitutions (MUST)

**Problem.** Tuple substitutions are regexes, so `.` and `$` in a find string need escaping, and
the replacement value goes through `String.replace`, so `$&` in a user's description expands.
An explicitly supplied empty string is treated as "missing" and leaves the placeholder.

**Proposal.** Object form `{ "find": "…", "input": "<id>", "regex": false }` — literal by default,
`regex: true` for the old behaviour. The legacy tuple form stays regex. In **both** forms the
value is inserted literally, and `""` substitutes when the id was supplied.

**Acceptance.** `xxx.name.xxx` as a literal find leaves the decoy `xxxYnameYxxx` alone; a value of
`a$&b` is inserted verbatim.

### R10 — Binary-safe copy (SHOULD)

Files are read/written as UTF-8, corrupting images and fonts. A file with a NUL byte in its first
8000 bytes (git's heuristic) is copied byte-for-byte with no transforms. Acceptance: a committed
PNG round-trips byte-identical.

### R11 — `mould use <path>` (SHOULD)

If the first argument to `use` contains a path separator or starts with `.` and is a directory,
use it directly instead of resolving a name through `template-sources.json`.

### R12 — Substitutions applied to `renames` targets (COULD)

Would allow `"src/__name__.ts": "src/xxx_component_xxx.ts"` — cheap path templating.

### R13 — `mould check <template>` (COULD)

Validate a template without rendering: dangling substitution ids, inputs never referenced,
invalid expressions, rename collisions, placeholders that appear in no file.

### R14 — Per-substitution escaping (COULD)

`"escape": "json" | "jsx"` so a description containing `"` cannot break a generated
`package.json` or a JSX string. init-next-app currently rejects such characters at input time.

### R15 — Sources-file-relative paths (COULD, not needed by init-next-app)

Relative entries in `template-sources.json` resolve against the process working directory. Resolving
against the file would be less surprising but changes behaviour for existing users.

## 4. Compatibility

- Every 0.6.0 `.mouldconfig.json` still parses: new keys are optional, `type: "text"` is
  unchanged, tuple substitutions remain regexes.
- Two deliberate behaviour changes in 0.7.0: replacement values no longer `$`-expand, and an
  explicitly supplied empty value now substitutes (an *absent* value still leaves the placeholder).
- The published JSON Schema (`https://jalexw.github.io/mould/openapi/mouldconfig.json`) is
  regenerated from the zod schema, so editors pick up the new fields automatically.

## 5. Out of scope

Loops, template inheritance/partials, remote template sources, and pre/post-generation hooks.
init-next-app keeps `bun install`, auth codegen and skill installation in its own CLI, where the
inputs' domain validation (`@schemavaults/app-definitions`) also lives.
