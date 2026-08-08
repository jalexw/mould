# mould

## About

🧩🪄 Generate sample projects and insert code snippets from your configurable templates collection!

After installing `mould`, you can create a `templates/` directory where every immediate subfolder represents a new template. Files are then copied from this folder (an operation configurable by a `.mouldconfig.json` file) to a destination directory after applying any transformations.

For an example of what your own `templates/` folder may look like, [follow this link to see some example template moulds we use in test cases](./test-fixtures/test-moulds).

## Run `mould` without installing (`bunx`/`npx`)

`@jalexw/mould` publishes the compiled `mould` executable as the package's `bin`, so you can run it
straight from the npm registry without cloning or installing anything:

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

# list the directories that are searched for templates
bunx @jalexw/mould sources

# run the initial configuration steps
bunx @jalexw/mould setup

# generate ./output from a template, passing inputs on the command line
bunx @jalexw/mould use example-typescript-project ./output \
  --template-sources ./test-fixtures/test-moulds \
  --input org_scope=jalexw project_name=my_new_project_name
```

> Note: `bunx` caches packages between runs. Use `bunx --bun @jalexw/mould@latest --help` to force the
> newest published version.

> ⚠️ The published `bin` is a single self-contained binary compiled by CI on Linux x64, so it only runs
> on Linux x64 machines. On macOS or Windows, [build from source](#install-and-build-mould-from-source)
> until per-platform binaries are published.

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

There should now be an executable binary named `mould` in the `./dist/bin` folder. Add it to your Shell/Terminal's PATH so you can use the `mould` command from anywhere. Edit your `.zshrc` or `.bashrc` (or equivalent) to include the following line at the end:
```bash
export PATH=$HOME/mould/dist/bin:$PATH
```

Refresh your shell and the `mould` command should now be available:
```bash
# refresh active shell (for zsh, use ~/.bashrc for bash) without creating a new one:
source ~/.zshrc

# test that 'mould' is now in your path
mould --help
```

## Usage

### Configuring your template source directories

Create a file named `template-sources.json` inside the `mould` directory (e.g. `vim ~/mould/template-sources.json`). Inside the file, add a JSON-formatted list of paths to template source directories. For example:
```json
["/Users/YourUsername/mould/templates"]
```

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
- Loading template from a one-off source directory using `--template-sources` flag. This overrides the `template-sources.json` configured. In this example, we're trying to use a template named `example-typescript-project` (found in the [`./test-fixtures/test-moulds` templates directory](./test-fixtures/test-moulds)).
- Passing custom inputs `org_scope=jalexw` and `project_name=my_new_project_name` after the `--input` flag, allowing custom variable substitution as defined by the [`.mouldconfig.json`](./test-fixtures/test-moulds/example-typescript-project/.mouldconfig.json) configuration for the mould.

```bash
mould use example-typescript-project ./output \
  --template-sources ./test-fixtures/test-moulds \
  --input org_scope=jalexw project_name=my_new_project_name
```

Or to be prompted for inputs:
```bash
mould use example-typescript-project ./output \
  --template-sources ./test-fixtures/test-moulds \
  --interactive
```


### Load configured list of paths to template source directories
```bash
mould sources
```

## JSON schemas

The JSON Schema for `.mouldconfig.json` is generated on every build and published to GitHub Pages at [https://jalexw.github.io/mould/mouldconfig.json](https://jalexw.github.io/mould/mouldconfig.json).

Reference it from your own config files for editor autocompletion and validation:
```json
{
  "$schema": "https://jalexw.github.io/mould/mouldconfig.json"
}
```
