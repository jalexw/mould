# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

Bun is the package manager and test runner (`bun@1.3.14`); the *published* CLI runs on plain Node (`engines.node >= 24`).

```bash
bun install
bun run dev -- list                  # run the CLI from TypeScript source (NODE_ENV=development)
bun run build                        # tsc + tsc-alias, then generate the JSON Schema, then postbuild cleanup
bun run build:github-pages           # Build the GitHub pages static site (run package + openapi build first with `bun run build`)
bun run execute -- list              # run the compiled CLI from ./dist
bun test                             # run tests (leaves ./tmp behind)
bun run test                         # tests + `rm -rf ./tmp`
bun test --test-name-pattern "hello-world-mould"   # single test case
```

There is no linter or formatter configured. Type checking happens via `bun run build:typescript`.

## Architecture

`mould` copies a template directory ("mould") to an output directory, applying string substitutions on the way. A template's `.mouldconfig.json` may list `ignorePatterns` (gitignore-style, compiled by `src/lib/IgnorePatterns/`) to keep files such as `dist/` out of the output; `.mouldconfig.json`, `node_modules` and `.DS_Store` are always skipped. It may also declare `renames` (template path → output path), `conditionalPaths` (patterns copied only when a `when` condition on the inputs holds) and inputs of type `text`/`select`/`boolean` with defaults. Inside files, `mould:if <expr>` / `mould:else` / `mould:endif` marker lines (behind any comment leader) include or drop blocks of lines — see `src/lib/Conditions/`. Inputs are resolved once by `src/lib/Inputs/resolveInputs.ts`; file modes are preserved and binary files are copied verbatim (`src/lib/Template/exportTemplate.ts`).

Library code throws `MouldError` subclasses (`src/lib/errors/`) and never calls `process.exit`; only `src/cli.ts` does. `applyTemplate()` (`src/lib/Template/applyTemplate.ts`, exported from the package root) is the programmatic entrypoint other CLIs use — it must stay free of `import.meta.url` / `mouldAppDir` so it works when bundled.

**CLI Entry chain:** `src/bin/mould.ts` (the published `bin`, `#!/usr/bin/env node`) → `run()` in `src/index.ts` → `MouldCommandLineInterface` (`src/cli.ts`, commander-based)

## Build details

- Path aliases (`$/mould`, `@/lib/*`, `@/types/*`, `@/schemas/*`) are declared in `tsconfig.json` and rewritten to relative paths by **tsc-alias**, which also appends the `.js` extensions Node's ESM resolver requires and `tsc` does not emit. Removing tsc-alias breaks the published package at runtime; keep imports on these aliases rather than deep relative paths.
- `postbuild` runs `cleanup`, which deletes compiled tests, `__test__` directories, `dist/build-openapi`, and `dist/build-github-pages-site` from the output.
- `dist/` is gitignored but is what gets published; `.npmignore` controls the tarball contents.
- `dist/openapi/` contains JSON schemas for interoperability.
- `dist/github-pages/` is deployed to GitHub Pages at `https://jalexw.github.io/mould/` (built by `bun run build:github-pages` (ensure normal build is run first))

## Tests

`src/__test__/moulds.test.ts` is data-driven: **every immediate subdirectory of `test-fixtures/test-moulds/` automatically becomes a test case** that runs `mould --sources-files <generated>.json use <name> ./tmp/test-run-<uuid>/<name>`, where the generated sources file points at `test-fixtures/test-moulds`. Note that `--sources-files` is a program-level flag, so it must precede the subcommand. Adding a fixture directory adds a test. To supply inputs or assert on the output, add entries keyed by the fixture name to the `sampleInputs` and `checks` maps in that file; a `prepares` entry runs against the fixture directory before `mould use` (the `ignore-patterns-mould` fixture uses it to `bun install` and `bun run build`, so its gitignored `dist/` and `node_modules/` exist; those need network on a cold cache). The CLI is invoked in-process via the exported `run()`, so `process.exit` in library code will kill the test run. Templates that must *fail* live under `test-fixtures/invalid-moulds/` (outside the auto-runner) and are exercised by `src/__test__/applyTemplate.test.ts`; `src/__test__/conditions.test.ts` unit-tests the condition grammar and block stripping. A fixture file that must stay executable (e.g. `executable-mould/run.sh`) has to be committed with `git update-index --chmod=+x`.
