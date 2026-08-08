# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

Bun is the package manager and test runner (`bun@1.3.14`); the *published* CLI runs on plain Node (`engines.node >= 24`).

```bash
bun install
bun run dev -- list                  # run the CLI from TypeScript source (NODE_ENV=development)
bun run build                        # tsc + tsc-alias, then generate the JSON Schema, then postbuild cleanup
bun run execute -- list              # run the compiled CLI from ./dist
bun test                             # run tests (leaves ./tmp behind)
bun run test                         # tests + `rm -rf ./tmp`
bun test --test-name-pattern "hello-world-mould"   # single test case
```

There is no linter or formatter configured. Type checking happens via `bun run build:typescript`.

## Architecture

`mould` copies a template directory ("mould") to an output directory, applying string substitutions on the way.

**Entry chain:** `src/bin/mould.ts` (the published `bin`, `#!/usr/bin/env node`) → `run()` in `src/index.ts` → `MouldCommandLineInterface` (`src/cli.ts`, commander-based) → `Template` (`src/lib/Template/`).

**`mouldAppDir` is derived from the module's own location**, not the cwd: `src/index.ts` computes `dirname(fileURLToPath(import.meta.url))/..`. This means both `template-sources.json` (the list of directories searched for templates) and `package.json` (read by `src/lib/version.ts` for `--version`) are resolved relative to the *installed package root* — repo root in dev, the npm install dir when published. `--template-sources` on `mould use` overrides the config file entirely.

**Export flow** (`mould use <template> <output>`): `searchForTemplate` scans each source directory's immediate subfolders by name → `Template.loadConfig()` parses `.mouldconfig.json` (missing config falls back to `TemplateConfig.default`) → CLI collects `--input k=v` pairs, prompting interactively only with `--interactive`, otherwise erroring on any missing declared input → `gatherFilesInTemplate` walks the template recursively (skipping `.DS_Store`, `.mouldconfig.json`, `node_modules`) → `exportTemplate` mkdirs the output and writes each file with transforms applied.

Substitution semantics worth knowing before changing `exportTemplate.ts`:
- Each entry is `[pattern, input_id]`; `pattern` is compiled as `new RegExp(pattern, "g")`, so regex metacharacters in a template placeholder are live.
- A substitution is silently skipped when its input value is missing or empty.
- Transforms apply to **file contents only** — file and directory names are never rewritten.
- The command exits 1 if the output path already exists.

**Zod is the single source of truth for the config format.** `src/lib/schemas/templateConfigSchema.ts` produces both the `ITemplateConfig` TypeScript type (via `z.infer` in `src/lib/types/ITemplateConfig.ts`) and the published JSON Schema — `src/build-openapi/mouldconfig.ts` writes `templateConfigSchema.toJSONSchema()` to `dist/openapi/mouldconfig.json`, which CI deploys to GitHub Pages at `https://jalexw.github.io/mould/mouldconfig.json`. Changing the schema changes all three; run `bun run build` after editing it. The schema is `.strict()`, so unknown keys in a `.mouldconfig.json` are errors.

## Build details

- Path aliases (`$/mould`, `@/lib/*`, `@/types/*`, `@/schemas/*`) are declared in `tsconfig.json` and rewritten to relative paths by **tsc-alias**, which also appends the `.js` extensions Node's ESM resolver requires and `tsc` does not emit. Removing tsc-alias breaks the published package at runtime; keep imports on these aliases rather than deep relative paths.
- `postbuild` runs `cleanup`, which deletes compiled tests, `__test__` directories, and `dist/build-openapi` from the output.
- `dist/` is gitignored but is what gets published; `.npmignore` controls the tarball contents.

## Tests

`src/__test__/moulds.test.ts` is data-driven: **every immediate subdirectory of `test-fixtures/test-moulds/` automatically becomes a test case** that runs `mould use <name> ./tmp/test-run-<uuid>/<name> --template-sources test-fixtures/test-moulds`. Adding a fixture directory adds a test. To supply inputs or assert on the output, add entries keyed by the fixture name to the `sampleInputs` and `checks` maps in that file. The CLI is invoked in-process via the exported `run()`, so `process.exit` in library code will kill the test run.

## Local-only files

`template-sources.json`, `templates/`, `.npmrc`, and `.env*` are gitignored. `.npmrc.npmjs` / `.npmrc.github` are the checked-in registry templates; secrets come from `.env.local` (see `.env.example`). CI publishes to npmjs and GitHub Packages and deploys Pages on every push to `main`, so bumping `version` in `package.json` on `main` triggers a release.
