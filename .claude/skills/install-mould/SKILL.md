---
name: install-mould
description: Install or run the `@jalexw/mould` CLI — via bunx/npx without installing, as a global bun/npm install, or built from a source checkout — and finish the one-time `mould setup`. Use when the `mould` command is missing, when asked how to install/uninstall/upgrade mould, or when a task needs mould on a machine that does not have it yet.
---

# Installing `@jalexw/mould`

`mould` is published to npm as `@jalexw/mould`, which exposes a single `bin`
named `mould` (a plain Node entrypoint — no native binary, no postinstall step).

Pick the lightest option that fits the job:

| Situation | Use |
| --------- | --- |
| One-off run, CI job, or "just try it" | [No install](#option-1-run-without-installing-bunx--npx) |
| A `mould` command you keep using | [Global install](#option-2-install-globally) |
| Working *on* mould itself, or need unreleased changes | [From source](#option-3-build-from-a-source-checkout) |

## Requirements

`package.json` declares `engines.node >= 24`, so install with Node 24 or newer.
npm prints an `EBADENGINE` warning on older Node; the README's looser "Node 18+"
claim predates that floor — treat 24 as the supported minimum. `bun` satisfies
the requirement on its own.

Check first — if this prints a version, mould is already installed and there is
nothing to do:

```bash
mould --version
```

## Option 1: Run without installing (`bunx` / `npx`)

```bash
bunx @jalexw/mould --help
npx @jalexw/mould --help     # if you'd rather not use bun
```

Every subcommand works this way — substitute `bunx @jalexw/mould` wherever docs
say `mould`:

```bash
bunx @jalexw/mould list
bunx @jalexw/mould use my-template ./output
```

`bunx`/`npx` cache packages between runs. Force the newest published build with
an explicit tag:

```bash
bunx @jalexw/mould@latest --help
```

## Option 2: Install globally

```bash
bun add --global @jalexw/mould
# or
npm install --global @jalexw/mould
```

Then:

```bash
mould --help
```

Upgrade later by re-running the same command (npm) or
`bun add --global @jalexw/mould@latest` (bun). Uninstall with
`bun remove --global @jalexw/mould` / `npm uninstall --global @jalexw/mould`.

If the shell still reports `command not found: mould` right after a successful
install, the package manager's global bin directory is not on `PATH`. Print it
and add it to the shell profile:

```bash
bun pm bin --global    # e.g. ~/.bun/bin
npm bin -g             # e.g. /usr/local/bin or ~/.npm-global/bin
```

## Option 3: Build from a source checkout

Building is required — `bin` points at `dist/bin/mould.js`, which does not exist
until `bun run build` has run.

```bash
cd ~ && git clone https://github.com/jalexw/mould.git && cd mould
bun install
bun run build
```

Put the checkout's `mould` on `PATH`:

```bash
bun link      # from inside the cloned repo
# or
npm link
```

Or skip linking and call the built entrypoint directly:

```bash
node ~/mould/dist/bin/mould.js --help
```

Inside the repo you can also run straight from TypeScript, which needs no build
and prints extra debug logging (`NODE_ENV=development`):

```bash
bun run dev -- list
bun run execute -- list    # the compiled ./dist build instead
```

Note that `bun run dev -- …` and `bun run execute -- …` always execute with the
repo root as the working directory.

## After installing: one-time setup

`mould` finds templates through `template-sources.json` files. Create the
default one:

```bash
mould setup      # alias: mould init
```

This writes a minimal `template-sources.json` (empty `templates` and
`templatesDirectories` lists) into `~/mould/`, and into the installed package's
own directory. It never overwrites an existing file, so it is safe to re-run.

Confirm which sources files the other commands will read:

```bash
mould template-sources
```

If that prints nothing, no sources file was found — run `mould setup`, or point
mould at a sources file explicitly with the program-level `--sources-files` flag
or the `MOULD_TEMPLATE_SOURCES` environment variable.

Then register a templates directory and start using templates — see the
`mould-templates`, `create-mould-template`, and `use-mould-template` skills.

## Verify the install

```bash
mould --version    # prints the semver from the installed package.json
mould list         # prints a table of available templates (empty until sources are configured)
```
