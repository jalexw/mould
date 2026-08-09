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
