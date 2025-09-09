# mould

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


### Load configured list of paths to template source directories
```bash
mould sources
```
