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

`mould list` prints each template's directory `path`; read the config there:

```bash
cat <path-from-mould-list>/.mouldconfig.json
```

Each entry in `inputs` has an `id` — that is the key you pass on the command
line. A template with no `.mouldconfig.json`, or with `"inputs": []`, needs no
values.

### 3. Generate

```bash
mould use example-typescript-project ./output \
  --input org_scope=jalexw project_name=my_new_project_name
```

- `--input` (`-i`) takes **space-separated** `key=value` pairs — one flag,
  many pairs.
- Aliases for `use`: `apply`, `use-template`, `apply-template`.
- Order is `mould [--sources-files …] use <template_name> <output_path> [--input …]`.

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
grep -rn 'XxX_\|YyY_\|{{' ./output || echo "no placeholders left"
```

An unreplaced placeholder means the substitution's input had no value, or the
`.mouldconfig.json` pattern does not match the text in the file.

## Passing inputs — the rules

- **Every declared input must be supplied** in non-interactive mode, including
  ones marked `"required": false`. The missing-input check does not consult
  `required`; that field only affects `--interactive`, where a blank answer to a
  required input aborts the run. Omitting an optional input non-interactively
  exits with `Missing input '<id>' for mould template!`.
- **Values cannot be empty.** `-i favorite_color=` throws — each pair must split
  into exactly two non-empty halves around `=`.
- **Values cannot contain `=`.** `-i url=a=b` throws for the same reason. There
  is no escaping; templates needing such values have to be edited after
  generation.
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
  copied. Everything else is, including dotfiles.
- Only file **contents** are rewritten — filenames and directory names are
  copied literally, so rename generated files yourself if needed.

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
| `Missing input '<id>' for mould template!` | Supply it with `-i <id>=<value>` — optional inputs are required too — or use `--interactive`. |
| `Failed to split argument to --input option into two parts by '='` | An empty value, a missing `=`, or a value containing `=`. |
| `Output path '…' already exists!` | Remove the directory or pick a new one. |
| `ENOENT` on `mkdir` | The output path's parent does not exist; `mkdir -p` it. |
| Placeholders still in the output | The input had no value, or the substitution pattern in `.mouldconfig.json` doesn't match the file text. Note patterns are regexes. |
| The wrong template was generated | Two sources define the same name; the first match wins (`templates` entries before `templatesDirectories`). Narrow with `--sources-files`. |
| `--interactive` appears to hang | It expects a real terminal — pass `--input` instead when stdin is piped. |
