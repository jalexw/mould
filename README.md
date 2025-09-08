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

### Use a template

```bash
# creates a folder named ./output with a file.txt within and "Example File Content"
mould use my-new-template ./output
```

### Load configured list of paths to template source directories
```bash
mould sources
```
