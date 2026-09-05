---
name: mould-templates
description: How `mould` templates work end to end — how `template-sources.json` resolves template directories, what `.mouldconfig.json` declares (inputs with types and defaults, substitutions, ignorePatterns, renames, conditionalPaths), how `mould:if` marker blocks work, which files get copied or skipped, and how substitutions are applied. Use to understand or debug mould's model before authoring or running a template, or when a template resolves to the wrong thing, a placeholder is left unreplaced, or a file unexpectedly appears/disappears in the output.
---

# How `mould` templates work

`mould` copies a template directory to a new output directory, rewriting file
*contents* on the way, leaving out anything matched by the template's
`ignorePatterns` or by a `conditionalPaths` entry whose condition is false,
dropping `mould:if` blocks whose condition is false, and renaming entries listed
under `renames`. There is no scripting, no loops, and no post-generation hooks.

```
template-sources.json  ──▶  source directories  ──▶  a template directory
        (or a directory path passed straight to `mould use`)   │
                                        read .mouldconfig.json (root only)
                                                            │
                                  resolve inputs (defaults, validation)
                                                            │
   walk files ──▶ prune ignorePatterns + inactive conditionalPaths
             ──▶ strip mould:if blocks ──▶ apply substitutions
             ──▶ write output dir (renames applied, file modes kept)
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
  "substitutions": [{ "find": "xxx_project_name_xxx", "input": "project_name" }],
  "ignorePatterns": ["dist/", "*.log"],
  "renames": { "_gitignore": ".gitignore" },
  "conditionalPaths": [{ "when": "deployment == vercel", "paths": ["/vercel.json"] }]
}
```

A template with no `.mouldconfig.json` is valid — it is copied verbatim.

### `inputs`

Each entry declares a value to collect at generation time:

| Field | Required | Notes |
| ----- | -------- | ----- |
| `id` | yes | The key used on the command line (`--input <id>=<value>`) and referenced by substitutions and conditions; letters, digits, `_`, not starting with a digit |
| `label` | yes | Shown as the interactive prompt |
| `required` | yes | A required input with no value (and no `default`) fails the run |
| `type` | yes | `"text"`, `"select"` or `"boolean"` |
| `description` | no | Shown in parentheses after the label when prompting |
| `default` | no | Used when the input is not supplied (`string` for text/select, `boolean` for boolean) |
| `pattern` | no | `text` only — a regular expression the value must match (anchor it yourself) |
| `options` | select | Non-empty list of allowed values; `default` must be one of them |

Boolean values are accepted as `true/false`, `yes/no`, `y/n`, `1/0` and are
substituted as the strings `true` / `false`. Optional inputs no longer need to
be passed non-interactively: they take their `default`, else `""`.

The config schema is `.strict()`: any other field, or a missing required one,
fails the run.

### `substitutions`

A non-empty list (omit the key rather than passing `[]`) whose entries are either:

- `{ "find": "<text>", "input": "<input_id>", "regex": false }` — `find` is
  matched **literally** (recommended); set `"regex": true` to compile it as a
  regular expression instead.
- `["<regex>", "<input_id>"]` — the legacy tuple form; the first element is
  always a regular expression.

For each entry, mould replaces every occurrence in every copied text file with
the value supplied for `input_id`, inserted verbatim (`$&` and friends are never
expanded). Entries are applied in order, so a later substitution can rewrite
text a previous one inserted. An input that was supplied as an empty string does
substitute; an input with no value at all leaves the text untouched.

### `renames`

`{ "<template path>": "<output path>" }`, both `/`-separated and relative to the
template root. A key naming a directory renames its whole subtree. Use it for
files that cannot be stored under their final name — the idiom is
`"_gitignore": ".gitignore"`, because npm renames a packed `.gitignore` to
`.npmignore` and applies nested `.gitignore` rules when packing. Two entries
resolving to one output path fail the run; a key that matches nothing is only a
warning (the file may have been pruned by `conditionalPaths`).

### `conditionalPaths`

`[{ "when": "<condition>", "paths": ["…"] }]`. `paths` use the `ignorePatterns`
grammar below; when `when` is false those entries are not copied (directories
are pruned whole). Conditions are validated when the config is loaded.

### Conditions (`when` and `mould:if`)

Exactly three shapes, no `&&`/`||`/parentheses:

| Condition | True when |
| --- | --- |
| `flag` | the input's value is neither `""` nor `false` |
| `deployment == vercel` | the value equals `vercel` (quote values with spaces: `name == "hello world"`) |
| `deployment != none` | the value differs from `none` |

Every id must be a declared input; a `select` literal must be one of its
`options`; a `boolean` may only be compared to `true`/`false`.

### Conditional blocks inside files

A marker **line** is a comment leader, the directive, and an optional trailer:
`# mould:if deployment == vercel`, `// mould:else`, `{/* mould:endif */}`,
`<!-- mould:if with_docs -->`. Recognised leaders: `#`, `//`, `/*`, `{/*`,
`<!--`, `--`, `;`, `*`. Marker lines are always removed; the lines of an
inactive branch are removed; nothing else changes (line endings are kept).
Blocks cannot nest; `else`/`endif` without an `if`, a second `else`, or an
unclosed block fails the run before anything is written. JSON has no comments,
so use `conditionalPaths` or variant files there. Prose that merely mentions
`mould:if` mid-line is left alone — only whole marker lines count.

### `ignorePatterns`

A list of `.gitignore`-style patterns naming files and directories in the
template that must **not** be copied to the output. Typical use: a template that
is itself a working app, whose `dist/`, `node_modules/` or log files would
otherwise ship.

| Pattern | Matches |
| ------- | ------- |
| `dist/` | A **directory** named `dist`, at any depth (trailing `/` = directories only) |
| `dist` | A file *or* directory named `dist`, at any depth |
| `*.log` | Any entry whose **name** matches, at any depth — `*` and `?` never cross a `/` |
| `/coverage` | Anchored to the template root (a leading `/`) |
| `src/generated/` | Any pattern containing a `/` is relative to the template root |
| `**/fixtures/`, `src/**/*.snap`, `docs/**` | `**` matches any number of directories |

An ignored directory is pruned whole — nothing beneath it is visited. Negation
(`!pattern`) is not supported, and there is no way to re-include something a
pattern excluded. The list may be empty or omitted.

## 3. What actually gets copied

The whole tree is walked recursively; directories are recreated, files are read
as UTF-8, transformed, and written out.

Skipped at **every** depth, by exact filename, whatever the config says:

- `.mouldconfig.json`
- `node_modules`
- `.DS_Store`

…plus anything matched by the root config's `ignorePatterns` (see above).
Everything else ships, including dotfiles. Note that only the template **root**
`.mouldconfig.json` is read as config — a `.mouldconfig.json` deeper in the tree
is neither read nor copied, so it cannot be used to configure a subdirectory.

## 4. How substitutions are applied — the sharp edges

- **Tuple patterns are regular expressions; object `find`s are literal** unless
  `"regex": true`. Prefer the object form — no escaping of `.` or `$`.
- **Only file contents are rewritten — never file or directory names.** Use
  `renames` for the (few) names that must differ between template and output.
- **A missing input leaves the placeholder in the output**; an input supplied
  as `""` (or an optional input that defaulted to `""`) substitutes an empty
  string.
- **Values are inserted verbatim.** `$&`, `$1` etc. in a value are not expanded.
- **Binary files are copied byte-for-byte** (detected by a NUL byte in the first
  8000 bytes) and never substituted. Text files are read and written as UTF-8.
- **File permission bits are preserved**, so executable scripts stay executable.
  Commit such fixtures with `git update-index --chmod=+x`.
- **Nothing scopes a substitution to a file.** A pattern applies to every copied
  text file, so avoid patterns that could appear incidentally in prose or code.

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
| `mould use <name-or-path> <output>` (aliases `apply`, `use-template`, `apply-template`) | Generate a directory from a template, by configured name or by directory path |
| `mould template-sources` | Print the sources files that will be read |
| `mould setup` (alias `init`) | Write a minimal `template-sources.json` to `~/mould` and the package dir |
| `mould create-minimal-template <path>` | Scaffold a template directory containing only `.mouldconfig.json` |
| `mould create-template-sources-file <path>` | Write a minimal `template-sources.json` anywhere |
| `mould version` / `mould --version` | Print the build version |

## Programmatic use

`import { applyTemplate } from "@jalexw/mould"` renders a template by directory
path without prompting or `template-sources.json`, and rejects with a
`MouldError` subclass (`OutputPathExistsError`, `MissingRequiredInputError`,
`InvalidInputValueError`, `ConditionSyntaxError`, `RenameConflictError`, …)
instead of exiting. See the README section "Use `mould` from JavaScript".

Related skills: `install-mould` to get the CLI, `create-mould-template` to
author one, `use-mould-template` to run one.
