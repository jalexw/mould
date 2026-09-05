---
name: use-mould-template
description: Generate a directory from an existing `mould` template — list what's available, discover a template's required inputs, and run `mould use` with `--input` (or `--interactive`), including pointing mould at a specific `template-sources.json`. Use when asked to scaffold/generate a project or snippet from a mould template, or when `mould use` fails with missing inputs, an unresolved template, or an existing output path.
---

# Using a `mould` template

`mould use` copies a template directory to a new output directory, substituting
declared inputs into file contents. See `mould-templates` for the underlying
model.

## Procedure

### 1. Find the template

```bash
mould list        # alias: mould templates
```

Prints a table of every available template `name` and `path`. If the one you
want is missing, the sources config is the problem, not the template:

```bash
mould template-sources    # which template-sources.json files are being read
```

To use templates from a sources file that is not one of the defaults, pass the
**program-level** `--sources-files` flag *before* the subcommand:

```bash
mould --sources-files ./test-fixtures/test-template-sources.json list
```

…or set it for the whole shell / CI job (both are searched when both are set):

```bash
export MOULD_TEMPLATE_SOURCES=./test-fixtures/test-template-sources.json
mould list
```

Either one replaces the default search locations entirely. Relative paths inside
a sources file resolve against the **current working directory**, so run from
the directory those paths assume.

### 2. Discover the template's inputs

`mould inputs <template_name>` prints the inputs declared in that template's
`.mouldconfig.json`, without having to find the file first:

```bash
mould inputs example-typescript-project          # table of id/label/description/required/type/options/default
mould inputs example-typescript-project --json   # the raw input definitions
```

Each entry has an `id` — that is the key you pass on the command line. A
template with no `.mouldconfig.json`, or with `"inputs": []`, needs no values:
`mould inputs` says the template takes none, and `--json` prints `[]`.

The command is also aliased `template-inputs` and `describe`. To read the config
directly instead, `mould list` prints each template's directory `path`:

```bash
cat <path-from-mould-list>/.mouldconfig.json
```

### 3. Generate

```bash
mould use example-typescript-project ./output \
  --input org_scope=jalexw project_name=my_new_project_name
```

- `--input` (`-i`) takes **space-separated** `key=value` pairs — one flag,
  many pairs. The split is at the **first** `=`, so values may contain `=`.
- `boolean` inputs accept `true/false`, `yes/no`, `y/n`, `1/0`; `select` inputs
  accept one of their `options` (see `mould inputs`).
- Aliases for `use`: `apply`, `use-template`, `apply-template`.
- Order is `mould [--sources-files …] use <template_name> <output_path> [--input …]`.
- A template **directory path** works in place of the name, with no sources
  file at all: `mould use ./path/to/template ./output`.

For a human at a terminal, `--interactive` prompts for anything not passed:

```bash
mould use example-typescript-project ./output --interactive
```

Use `--input` in scripts, CI, and agent runs: the interactive prompts expect a
real terminal and will hang when stdin is piped.

### 4. Check the result

Confirm no placeholders survived and the tree looks right:

```bash
find ./output -type f | head
grep -rn 'xxx_\|XxX_\|{{\|mould:' ./output || echo "no placeholders or marker lines left"
```

An unreplaced placeholder means the substitution's input had no value, or the
`.mouldconfig.json` pattern does not match the text in the file.

## Passing inputs — the rules

- **Only `required` inputs must be supplied** non-interactively. An optional
  input that is omitted takes its `default` (if declared) and otherwise `""`.
  Omitting a required input exits with
  `Missing required input for mould template: '<id>'`.
- **Values may be empty**: `-i favorite_color=` supplies `""`.
- **Values may contain `=`**: `-i url=https://x?a=b` keeps `https://x?a=b`.
- **Values are validated** against the input's type: a `select` value must be
  one of its options, a `boolean` one of `true/false/yes/no/y/n/1/0`, and a
  `text` value must match its `pattern` when one is declared. Interactive mode
  re-prompts on an invalid answer; non-interactive mode exits.
- Inputs the template never declared are accepted silently. They still feed any
  substitution that references that `id`, so an undeclared-but-referenced value
  can be passed on the command line.
- Quote values containing spaces or shell metacharacters:
  `-i title="My Project"`.

## Output rules

- The output path **must not already exist** — mould exits with
  `Output path '…' already exists!`. It never merges into or overwrites a
  directory, so delete it first (deliberately) or generate elsewhere.
- The parent of the output path **must** exist — the output directory is created
  non-recursively. `mould use x ./a/b/c` crashes with `ENOENT` unless `./a/b`
  exists; `mkdir -p ./a/b` first.
- `.mouldconfig.json` (at any depth), `node_modules`, and `.DS_Store` are never
  copied, nor is anything matched by `ignorePatterns` or by a `conditionalPaths`
  entry whose condition is false for your inputs. Everything else is, including
  dotfiles and binaries; executable bits are kept.
- Only file **contents** are rewritten — filenames and directory names are
  copied literally, except for entries the template lists under `renames`.
- `mould:if` / `mould:else` / `mould:endif` marker lines never reach the output.

## Without installing

Every command works through `bunx`/`npx` — see the `install-mould` skill:

```bash
bunx @jalexw/mould --sources-files ./sources.json use my-template ./output -i name=demo
```

Inside a checkout of this repo, `bun run dev -- …` runs the same CLI from
TypeScript (with the repo root as the working directory):

```bash
bun run dev -- --sources-files ./test-fixtures/test-template-sources.json \
  use hello-world-mould ./tmp/demo
```

## Troubleshooting

| Symptom | Cause / fix |
| ------- | ----------- |
| `Failed to resolve mould template using search criteria!` | Name typo, or the template's directory is not under any configured source. Check `mould list` and `mould template-sources`. |
| Template missing from `mould list` | Its parent is listed under `templates` (single template) when it should be `templatesDirectories` (whose *children* are templates), or a relative source path is wrong for the current working directory. |
| `Failed to resolve template sources configuration file at path` | `--sources-files` / `MOULD_TEMPLATE_SOURCES` points at a nonexistent file, or at a directory instead of the `template-sources.json` itself. |
| `Missing required input for mould template: '<id>'` | Supply it with `-i <id>=<value>` or use `--interactive`. Optional inputs may be omitted. |
| `Invalid value '…' for input '<id>'` | The value is not one of a `select`'s options, not a recognised boolean word, or fails the input's `pattern`. |
| `Expected --input argument '…' to look like '<input_id>=<value>'` | A pair with no `=` (or nothing before it). |
| `Condition references undeclared input` / `never closed with mould:endif` | The template's `when` expression or marker blocks are broken — fix the template, not the inputs. |
| `Output path '…' already exists!` | Remove the directory or pick a new one. |
| `ENOENT` on `mkdir` | The output path's parent does not exist; `mkdir -p` it. |
| Placeholders still in the output | The input had no value, or the substitution's `find`/pattern in `.mouldconfig.json` doesn't match the file text. Tuple patterns are regexes; object `find`s are literal. |
| The wrong template was generated | Two sources define the same name; the first match wins (`templates` entries before `templatesDirectories`). Narrow with `--sources-files`. |
| `--interactive` appears to hang | It expects a real terminal — pass `--input` instead when stdin is piped. |
