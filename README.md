# mould

## About

🧩🪄 Generate sample projects and insert code snippets from your configurable templates collection!

After installing `mould`, you can create a `templates/` directory where every immediate subfolder represents a new template. Files are then copied from this folder (an operation configurable by a `.mouldconfig.json` file) to a destination directory after applying any transformations.

For an example of what your own `templates/` folder may look like, [follow this link to see some example template moulds we use in test cases](./test-fixtures/test-moulds).

## Run `mould` without installing (`bunx`/`npx`)

`@jalexw/mould` publishes the `mould` command as the package's `bin`, so you can run it straight from
the npm registry without cloning or installing anything:

```bash
bunx @jalexw/mould --help
```

The same works with `npx` if you'd rather not use `bun`:
```bash
npx @jalexw/mould --help
```

Every subcommand documented below works this way — swap the `mould` command for `bunx @jalexw/mould`:
```bash
# print the installed version
bunx @jalexw/mould --version

# list the templates available from your configured template sources
bunx @jalexw/mould list

# list the 'template-sources.json' files that are searched for templates
bunx @jalexw/mould template-sources

# list the inputs a template collects, as declared in its '.mouldconfig.json'
bunx @jalexw/mould inputs example-typescript-project

# run the initial configuration steps
bunx @jalexw/mould setup

# generate ./output from a template, passing inputs on the command line
bunx @jalexw/mould --sources-files ./test-fixtures/test-template-sources.json \
  use example-typescript-project ./output \
  --input org_scope=jalexw project_name=my_new_project_name
```

> Note: `bunx` caches packages between runs. Use `bunx @jalexw/mould@latest --help` to force the
> newest published version.

The published `mould` command is a plain Node.js entrypoint, so it runs anywhere Node 24+ does — no
platform-specific binary to download.

### Install `mould` globally from npm

To get a persistent `mould` command on your PATH without building from source:
```bash
# with bun
bun add --global @jalexw/mould

# or with npm
npm install --global @jalexw/mould
```

Then use the `mould` command directly:
```bash
mould --help
```

## Install and build `mould` from source

Download and build `mould` using `git` and `bun`:
```bash
# Installs @jalexw/mould to default location: `$HOME/mould`
cd ~ && git clone https://github.com/jalexw/mould.git && cd mould && bun install && bun run build
```

The build writes the `mould` entrypoint to `./dist/bin/mould.js`. Link your local checkout to put the
`mould` command on your PATH:
```bash
# from within the cloned repo
bun link

# or, if you'd rather use npm
npm link
```

The `mould` command should now be available anywhere:
```bash
mould --help
```

To run it without linking, invoke the built entrypoint directly:
```bash
node ~/mould/dist/bin/mould.js --help
```

## Usage

### Configuring your template source directories

Create a file named `template-sources.json` inside the `mould` directory (e.g. `vim ~/mould/template-sources.json`). `templatesDirectories` lists directories whose *subdirectories* are each a template, while `templates` lists paths to individual templates:
```json
{
  "$schema": "https://jalexw.github.io/mould/openapi/template-sources.json",
  "templatesDirectories": ["/Users/YourUsername/mould/templates"],
  "templates": []
}
```

`mould setup` scaffolds one of these for you, and `mould create-template-sources-file <path>` writes one anywhere you like.

Every command reads `~/mould/template-sources.json` by default. Pass the program-level `--sources-files` flag to read a different set of sources files instead — it takes a comma-separated list of paths to `template-sources.json` files, and because it belongs to `mould` itself rather than to a subcommand, it goes *before* the subcommand name:
```bash
mould --sources-files ./test-fixtures/test-template-sources.json list
```

The same comma-separated list can be set in the `MOULD_TEMPLATE_SOURCES` environment variable, which is handy for pointing a whole shell session (or a CI job) at a particular set of sources files:
```bash
export MOULD_TEMPLATE_SOURCES=./test-fixtures/test-template-sources.json
mould list
```

When both the environment variable and the flag are set, every file listed in either one is searched:
```bash
# searches both ./project-sources.json and ./team-sources.json
MOULD_TEMPLATE_SOURCES=./team-sources.json mould --sources-files ./project-sources.json list
```

Setting either one replaces the default search locations entirely — if you still want `~/mould/template-sources.json`, list it explicitly:
```bash
MOULD_TEMPLATE_SOURCES=~/mould/template-sources.json,./project-sources.json mould list
```

`mould template-sources` prints the sources files that the other commands will read, which is the quickest way to check what a given combination resolves to.

### Create a new template

Inside one of your template source directories, create a folder:
```bash
# create a 'templates' directory
# ensure that the path to this directory is listed in your 'template-sources.json' config
mkdir ~/mould/templates

## Create a template with a single simple text file
cd ~/mould/templates && mkdir my-new-template && cd my-new-template && echo "Example File Content" > file.txt
```

You should now be able to see a template named `my-new-template` listed with the following command:
```bash
mould list
```

### Use a simple template

Use the simple `my-new-template` mould template you created above to generate a directory from it:
```bash
# creates a folder named ./output with a file.txt within and "Example File Content"
mould use my-new-template ./output
```

### Find out what inputs a template takes

Before running `mould use`, `mould inputs <template_name>` prints the inputs declared in that
template's [`.mouldconfig.json`](#json-schemas) — the `id` of each one is the name you pass to
`--input`:
```bash
mould --sources-files ./test-fixtures/test-template-sources.json inputs example-typescript-project
```
```
┌───┬──────────────┬──────────────┬────────────────────────────────────────────────────────┬──────────┬──────┬─────────┬─────────┐
│   │ id           │ label        │ description                                            │ required │ type │ options │ default │
├───┼──────────────┼──────────────┼────────────────────────────────────────────────────────┼──────────┼──────┼─────────┼─────────┤
│ 0 │ project_name │ Project Name │ Package name for 'name' field of new package.json file │ true     │ text │         │         │
│ 1 │ org_scope    │ Org Scope    │ Scope for 'name' field of new package.json file        │ true     │ text │         │         │
└───┴──────────────┴──────────────┴────────────────────────────────────────────────────────┴──────────┴──────┴─────────┴─────────┘
```

Pass `--json` to get the raw input definitions instead, which is easier to feed into another tool:
```bash
mould inputs example-typescript-project --json
```

A template with no `.mouldconfig.json`, or one whose config declares no `inputs`, takes no inputs —
`mould inputs` says so, and `--json` prints an empty array.

### A more complicated template usage

The following example covers the following:
- Loading templates from a one-off sources file using the `--sources-files` flag. This overrides the default `template-sources.json` config. In this example, we're using a template named `example-typescript-project`, reached through [`./test-fixtures/test-template-sources.json`](./test-fixtures/test-template-sources.json), which points at the [`./test-fixtures/test-moulds` templates directory](./test-fixtures/test-moulds).
- Passing custom inputs `org_scope=jalexw` and `project_name=my_new_project_name` after the `--input` flag, allowing custom variable substitution as defined by the [`.mouldconfig.json`](./test-fixtures/test-moulds/example-typescript-project/.mouldconfig.json) configuration for the mould.

```bash
mould --sources-files ./test-fixtures/test-template-sources.json \
  use example-typescript-project ./output \
  --input org_scope=jalexw project_name=my_new_project_name
```

Or to be prompted for inputs:
```bash
mould --sources-files ./test-fixtures/test-template-sources.json \
  use example-typescript-project ./output \
  --interactive
```


### Keep files out of the generated output (`ignorePatterns`)

Anything in a template directory is copied by default, so a template that is itself a working app tends to drag its build output and installed dependencies along. List `.gitignore`-style patterns under `ignorePatterns` in the template's [`.mouldconfig.json`](#json-schemas) to leave them out:
```json
{
  "$schema": "https://jalexw.github.io/mould/openapi/mouldconfig.json",
  "inputs": [],
  "ignorePatterns": ["dist/", "node_modules/", "*.log", "src/generated/**"]
}
```

- `dist/` — a trailing slash matches directories only, at any depth. An ignored directory is skipped whole.
- `*.log` — a pattern without a `/` matches the file or directory *name* at any depth; `*` and `?` never cross a `/`.
- `/coverage` — a leading slash anchors the pattern to the template root, and so does any pattern containing a `/` (e.g. `src/generated/`).
- `**` matches any number of directories: `**/fixtures/`, `src/**/*.snap`, `docs/**`.
- Negation (`!pattern`) is not supported.

`.mouldconfig.json`, `node_modules` and `.DS_Store` are always skipped, whether or not they are listed. See the [`ignore-patterns-mould`](./test-fixtures/test-moulds/ignore-patterns-mould) fixture: a small TypeScript app whose test installs and builds it first, then asserts that the resulting `dist/` and `node_modules/` never reach the output.

### Rename files on copy (`renames`)

Some files cannot be stored in a template under the name they should have in the output. The usual case is a `.gitignore` meant for the *generated* project: npm renames a packed `.gitignore` to `.npmignore` and applies nested `.gitignore` rules when packing, so a template shipped inside an npm package cannot carry one. Store it under another name and map it with `renames`:
```json
{
  "renames": { "_gitignore": ".gitignore", "config/_npmrc": "config/.npmrc" }
}
```

Keys and values are `/`-separated paths relative to the template root. A key naming a directory renames its whole subtree. Two entries resolving to the same output path fail the run; a key that matches nothing is only a warning (the file may have been left out by a conditional).

### Conditional files and blocks

Inputs can decide what gets generated. Declare a `select` or `boolean` input, then:

- **Whole files or directories** — `conditionalPaths` lists gitignore-style patterns (same grammar as `ignorePatterns`) that are only copied when a condition holds:
  ```json
  {
    "inputs": [
      { "id": "deployment", "label": "Deployment", "required": false, "type": "select", "options": ["vercel", "none"], "default": "none" },
      { "id": "with_docs", "label": "Include docs?", "required": false, "type": "boolean", "default": false }
    ],
    "conditionalPaths": [
      { "when": "deployment == vercel", "paths": ["/vercel.json"] },
      { "when": "with_docs", "paths": ["docs/"] }
    ]
  }
  ```
- **Blocks of lines inside a file** — wrap them in marker lines. A marker is a line holding only a comment leader, the directive and an optional comment trailer, so the file stays valid in your editor:
  ```yaml
  jobs:
    build:
      runs-on: ubuntu-latest
    # mould:if deployment == vercel
    publish-to-vercel:
      needs: build
    # mould:endif
  ```
  ```tsx
  {/* mould:if with_docs */}
  <DocsLink />
  {/* mould:else */}
  <span>No docs</span>
  {/* mould:endif */}
  ```
  `# …`, `// …`, `/* … */`, `{/* … */}`, `<!-- … -->`, `-- …` and `; …` leaders are recognised. Marker lines are always removed; the lines of an inactive branch are removed; nothing else changes. Blocks cannot nest. JSON has no comments, so use `conditionalPaths` (or two variant files) for JSON.

Conditions are tiny on purpose: `<input_id>` (true unless the value is empty or `false`), `<input_id> == <value>` or `<input_id> != <value>`. Every id must be a declared input, and a `select` literal must be one of its options — mistakes fail before anything is written.

### Input types, defaults and validation

| `type` | Extra fields | Accepted values |
| --- | --- | --- |
| `text` | `default`, `pattern` (a regular expression the value must match) | any string |
| `select` | `options` (required), `default` (one of the options) | one of the options |
| `boolean` | `default` | `true`/`false`, `yes`/`no`, `y`/`n`, `1`/`0` |

Boolean values are substituted as the strings `true` / `false`. An input that is not supplied takes its `default`; only inputs marked `required` with no value fail a non-interactive run, so optional inputs no longer have to be passed. `mould inputs <template>` shows the `options` and `default` columns.

### Literal substitutions

Alongside the `[regex, input_id]` tuple form, substitutions may be objects. `find` is matched **literally** unless `regex` is `true`, so dots and dollar signs need no escaping:
```json
{
  "substitutions": [
    { "find": "xxx_project_name_xxx", "input": "project_name" },
    { "find": "https://auth.example.com", "input": "auth_url" },
    { "find": "v1\\.0", "input": "version", "regex": true }
  ]
}
```
In both forms the input's value is inserted verbatim (`$&` in a value is never expanded), and an explicitly supplied empty value does substitute.

### Other copy rules

- File permission bits are preserved, so an executable script stays executable.
- Files that look binary (a NUL byte in the first 8000 bytes) are copied byte-for-byte with no substitutions.
- `mould use` also accepts a template **directory path** in place of a name — `mould use ./path/to/template ./output` — without any `template-sources.json`.
- `--input key=value` splits at the first `=`, so values may contain `=`; `--input key=` supplies an empty value.

### Use `mould` from JavaScript

`@jalexw/mould` exports a programmatic API for other CLIs. It addresses the template by path, never prompts, and rejects with a `MouldError` subclass instead of exiting the process:
```ts
import { applyTemplate, MouldError } from "@jalexw/mould";

try {
  const result = await applyTemplate({
    templatePath: new URL("../templates/my-template/", import.meta.url).pathname,
    outputPath: "./my-project",
    inputs: { project_name: "demo", with_docs: true },
    onWarning: (message) => console.warn(message),
  });
  console.log(result.writtenFiles);   // output-relative paths
  console.log(result.skippedFiles);   // pruned by conditionalPaths
} catch (e) {
  if (e instanceof MouldError) console.error(e.message);
  else throw e;
}
```
Also exported: `loadTemplateConfig(templatePath)`, `resolveInputs(...)`, the error classes (`TemplateNotFoundError`, `TemplateConfigError`, `OutputPathExistsError`, `OutputParentMissingError`, `MissingRequiredInputError`, `InvalidInputValueError`, `ConditionSyntaxError`, `RenameConflictError`) and the config types. The requirements that drove this API are in [`docs/requirements/init-next-app-template-support.md`](./docs/requirements/init-next-app-template-support.md).

### Load the configured list of template sources files
```bash
mould template-sources
```

## JSON schemas

The JSON Schema for `.mouldconfig.json` is generated on every build and published to GitHub Pages at [https://jalexw.github.io/mould/mouldconfig.json](https://jalexw.github.io/mould/mouldconfig.json).

Reference it from your own `.mouldconfig.json` files for editor autocompletion and validation:
```json
{
  "$schema": "https://jalexw.github.io/mould/openapi/mouldconfig.json"
}
```
