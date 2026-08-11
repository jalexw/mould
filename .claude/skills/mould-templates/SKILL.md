---
name: mould-templates
description: How `mould` templates work end to end — how `template-sources.json` resolves template directories, what `.mouldconfig.json` declares (inputs and substitutions), which files get copied or skipped, and how substitutions are applied. Use to understand or debug mould's model before authoring or running a template, or when a template resolves to the wrong thing, a placeholder is left unreplaced, or a file unexpectedly appears/disappears in the output.
---

# How `mould` templates work

`mould` copies a template directory to a new output directory, rewriting file
*contents* on the way. That is the entire feature set — there is no scripting,
no conditional file inclusion, and no post-generation hooks.

```
template-sources.json  ──▶  source directories  ──▶  a template directory
                                                            │
                                        read .mouldconfig.json (root only)
                                                            │
                          walk files ──▶ apply substitutions ──▶ write output dir
```

## 1. Sources: how mould finds templates

Templates are never passed by path to `mould use`; they are looked up by **name**
through one or more `template-sources.json` files.

```json
{
  "$schema": "https://jalexw.github.io/mould/openapi/template-sources.json",
  "templatesDirectories": ["/Users/you/mould/templates"],
  "templates": ["/Users/you/projects/some-single-template"]
}
```

- `templatesDirectories` — each entry is a directory whose **immediate
  subdirectories** are each a template. Loose files in it (a `README`, a
  `.DS_Store`) are ignored; only directories count.
- `templates` — each entry **is** a template directory itself. Its name is the
  directory's basename.

Both keys are required by the schema, even when empty. Unknown keys are rejected
(`.strict()`), as are non-string entries.

### Which sources files are read

In order of precedence:

1. `--sources-files <comma,separated,paths>` — a **program-level** flag, so it
   goes *before* the subcommand: `mould --sources-files ./a.json list`, never
   `mould list --sources-files ./a.json`.
2. `MOULD_TEMPLATE_SOURCES` — same comma-separated format, as an environment
   variable.
3. The defaults, used **only when neither of the above is set**: a
   `template-sources.json` in the installed package's own directory, then
   `~/mould/template-sources.json`. Each is used only if it exists.

Setting the flag *or* the env var replaces the defaults entirely — to keep
`~/mould/template-sources.json` in play, list it explicitly. When both the flag
and the env var are set, every file from both is searched (duplicates dropped):

```bash
MOULD_TEMPLATE_SOURCES=./team-sources.json mould --sources-files ./project-sources.json list
```

`mould template-sources` prints exactly which files a given combination resolves
to — the fastest way to debug "my template isn't listed".

### Lookup order and name collisions

All sources files are merged into one config: `templates` entries first (in
listed order), then `templatesDirectories` entries. `mould use` returns the
**first** template whose name matches and stops looking, so a name defined in an
earlier source shadows a later one. `mould list` shows every template, including
both sides of a collision.

### Relative paths resolve against the current working directory

Paths inside a `template-sources.json` are **not** resolved relative to that
file — they are passed to the filesystem as-is, so a relative entry like
`"./templates"` only works when `mould` is run from the right directory.
Prefer absolute paths in any sources file that is not tied to one project root.

## 2. The template directory

A template is just a directory. Its **name is its directory name** — that is
what `mould use <template_name>` matches.

Optionally, its root holds a `.mouldconfig.json`:

```json
{
  "$schema": "https://jalexw.github.io/mould/openapi/mouldconfig.json",
  "inputs": [
    {
      "id": "project_name",
      "label": "Project Name",
      "description": "Package name for the generated package.json",
      "required": true,
      "type": "text"
    }
  ],
  "substitutions": [["XxX_ProjectName_XxX", "project_name"]]
}
```

A template with no `.mouldconfig.json` is valid — it is copied verbatim.

### `inputs`

Each entry declares a value to collect at generation time:

| Field | Required | Notes |
| ----- | -------- | ----- |
| `id` | yes | The key used on the command line (`--input <id>=<value>`) and referenced by substitutions |
| `label` | yes | Shown as the interactive prompt |
| `required` | yes | Only enforced in `--interactive` mode (see the gotcha below) |
| `type` | yes | `"text"` is the only supported value today |
| `description` | no | Shown in parentheses after the label when prompting |

The config schema is `.strict()`: any other field, or a missing required one,
fails the run.

### `substitutions`

A list of `[pattern, input_id]` pairs. `substitutions` must be non-empty when
present — omit the key entirely rather than passing `[]`.

For each pair, mould replaces every occurrence of `pattern` in every copied
file's text with the value supplied for `input_id`. Pairs are applied in order,
so a later substitution can rewrite text a previous one inserted.

## 3. What actually gets copied

The whole tree is walked recursively; directories are recreated, files are read
as UTF-8, transformed, and written out.

Skipped at **every** depth, by exact filename:

- `.mouldconfig.json`
- `node_modules`
- `.DS_Store`

Everything else ships, including dotfiles. Note that only the template **root**
`.mouldconfig.json` is read as config — a `.mouldconfig.json` deeper in the tree
is neither read nor copied, so it cannot be used to configure a subdirectory.

## 4. How substitutions are applied — the sharp edges

These are the behaviours that cause almost every surprise:

- **Patterns are regular expressions, not literals.** Each pattern becomes
  `new RegExp(pattern, "g")`. A pattern of `a.c` also rewrites `abc`. Escape
  regex metacharacters (`. * + ? ( ) [ ] { } | ^ $ \ /`) or, better, choose
  placeholders made only of letters, digits, and underscores.
- **Only file contents are rewritten — never file or directory names.** A file
  named `PLACEHOLDER___NAME__.txt` keeps that literal name in the output. Rename
  generated files afterwards if you need them templated.
- **A missing or empty value silently skips that substitution**, leaving the raw
  placeholder in the output. Empty string counts as missing.
- **Files are read and written as UTF-8.** Binary content (images, archives,
  fonts) is corrupted by the round-trip — keep it out of templates.
- **Nothing scopes a substitution to a file.** A pattern applies to every copied
  file, so avoid patterns that could appear incidentally in prose or code.

## 5. Output rules

- The output path **must not already exist** — mould exits with
  `Output path '…' already exists!` rather than merging or overwriting.
- The output path's **parent must exist** — the directory is created
  non-recursively, so `mould use x ./a/b/c` crashes with `ENOENT` unless `./a/b`
  is already there. `mkdir -p` the parent first.

## Command reference

| Command | Purpose |
| ------- | ------- |
| `mould list` (alias `templates`) | Table of every available template name and path |
| `mould inputs <name>` (aliases `template-inputs`, `describe`) | Table of the inputs a template declares; `--json` for the raw definitions |
| `mould use <name> <output>` (aliases `apply`, `use-template`, `apply-template`) | Generate a directory from a template |
| `mould template-sources` | Print the sources files that will be read |
| `mould setup` (alias `init`) | Write a minimal `template-sources.json` to `~/mould` and the package dir |
| `mould create-minimal-template <path>` | Scaffold a template directory containing only `.mouldconfig.json` |
| `mould create-template-sources-file <path>` | Write a minimal `template-sources.json` anywhere |
| `mould version` / `mould --version` | Print the build version |

Related skills: `install-mould` to get the CLI, `create-mould-template` to
author one, `use-mould-template` to run one.
