---
name: create-mould-template
description: Author a new `mould` template — scaffold the directory, register it in a `template-sources.json` source, write `.mouldconfig.json` inputs and substitutions, and verify it generates correctly. Use when asked to create, add, or edit a mould template/mould, to turn an existing project or snippet into a reusable template, or to fix a `.mouldconfig.json`.
---

# Creating a `mould` template

A template is a directory of ordinary files plus an optional
`.mouldconfig.json` at its root. Read the `mould-templates` skill first if the
resolution model or substitution semantics are unclear.

## Procedure

### 1. Pick where the template lives

It must end up reachable from a `template-sources.json`, either as a
subdirectory of a `templatesDirectories` entry (the usual choice) or as its own
`templates` entry.

```bash
mould template-sources   # which sources files are in play
cat ~/mould/template-sources.json
```

If no templates directory is registered yet:

```bash
mkdir -p ~/mould/templates
```

…then add its **absolute** path to `templatesDirectories` (relative paths in a
sources file resolve against the process working directory, not the file):

```json
{
  "$schema": "https://jalexw.github.io/mould/openapi/template-sources.json",
  "templatesDirectories": ["/Users/you/mould/templates"],
  "templates": []
}
```

### 2. Scaffold the directory

The directory name **is** the template name, so pick the name users will type.

```bash
mould create-minimal-template ~/mould/templates/my-new-template
```

That creates the directory (parents included) with a `.mouldconfig.json`
pointing at the published JSON Schema. It refuses to run if anything already
exists at that path — for an existing directory, write `.mouldconfig.json` by
hand instead.

### 3. Add the files to be generated

Copy in the real files the template should produce. Everything in the tree
ships, at any depth, including dotfiles — except `.mouldconfig.json`,
`node_modules`, and `.DS_Store`, which are skipped by name at every level, and
whatever the config's `ignorePatterns` excludes (step 5).

Keep out of the template:

- Real secrets. Templates are copied verbatim; there is no redaction step.
- A `.gitignore` meant for the *generated* project, if the template will be
  published to npm — store it as `_gitignore` and map it with `renames`
  (step 5). npm renames a packed `.gitignore` to `.npmignore` and applies its
  rules while packing.

Binary assets (images, fonts) are fine: files containing a NUL byte are copied
byte-for-byte. Executable scripts keep their mode — commit them with
`git update-index --chmod=+x` so a fresh clone has the bit set.

Build output, lockfile-adjacent junk and other generated files are best kept
out too — but when the template doubles as a working app (so `dist/` or
`coverage/` keep reappearing), list them under `ignorePatterns` instead of
deleting them before every commit.

### 4. Choose placeholders and mark up the files

Put a distinctive placeholder everywhere a value should be injected:

```jsonc
// package.json inside the template
{ "name": "@yyy_org_scope_yyy/xxx_project_name_xxx" }
```

Placeholder rules that matter:

- **Object-form substitutions match literally**, so any distinctive text works
  as a placeholder — including a real default value such as
  `https://auth.example.com`, which keeps the template runnable as-is. Tuple
  substitutions are regexes; avoid them unless you need one.
- **Make them unmistakable.** A placeholder applies to every copied text file,
  so a bare word like `name` will shred unrelated text.
- **Keep them valid where they sit.** A lowercase token such as
  `xxx_project_name_xxx` is a legal npm package name, dotenv value and
  identifier, so the template still installs and type-checks in an IDE.
- **Filenames are never rewritten** — only file contents. Use `renames` for the
  few names that must differ.

For input-dependent *sections*, wrap lines in marker comments of the host
language; the file stays valid for editors and linters:

```yaml
  # mould:if deployment == vercel
  publish-to-vercel:
    needs: build
  # mould:endif
```

```tsx
{/* mould:if with_analytics */}
<Analytics />
{/* mould:else */}
{/* mould:endif */}
```

Whole files or directories that depend on an input go under `conditionalPaths`
instead (JSON files have no comments, so this is the only option for them).

### 5. Declare inputs, substitutions, renames and conditions

```json
{
  "$schema": "https://jalexw.github.io/mould/openapi/mouldconfig.json",
  "inputs": [
    {
      "id": "project_name",
      "label": "Project Name",
      "description": "Package name for the generated package.json",
      "required": true,
      "type": "text",
      "pattern": "^[a-z0-9-]+$"
    },
    {
      "id": "deployment",
      "label": "Deployment strategy",
      "required": false,
      "type": "select",
      "options": ["vercel", "none"],
      "default": "none"
    },
    {
      "id": "with_analytics",
      "label": "Include analytics?",
      "required": false,
      "type": "boolean",
      "default": false
    }
  ],
  "substitutions": [
    { "find": "xxx_project_name_xxx", "input": "project_name" }
  ],
  "renames": { "_gitignore": ".gitignore" },
  "conditionalPaths": [
    { "when": "deployment == vercel", "paths": ["/vercel.json"] }
  ],
  "ignorePatterns": ["dist/", "coverage/", "*.log"]
}
```

- Every input needs `id`, `label`, `required`, and `type` (`text`, `select` or
  `boolean`); `description`, `default` and (for `text`) `pattern` are optional;
  `select` needs `options`. The schema is strict — an extra or misspelled field
  fails the run.
- Prefer object substitutions `{ "find", "input", "regex"? }` — `find` is
  literal unless `regex` is `true`. The tuple form `[regex, input_id]` still
  works. Entries apply in listed order.
- Referencing an `input_id` that no input declares is not an error, but nothing
  will prompt for it — the substitution only fires if a caller happens to pass
  `--input <id>=<value>`, and otherwise leaves the placeholder in the output.
  Keep the two lists in sync.
- Omit `substitutions` entirely for a verbatim template. An empty array is
  rejected (the list must be non-empty when present).
- `inputs` may be `[]` for a template that collects nothing.
- `renames` maps template-relative paths to output-relative paths; a directory
  key renames its subtree. Colliding targets fail; an unmatched key warns.
- `conditionalPaths[].when` and every `mould:if` expression must reference a
  declared input (`id`, `id == value`, `id != value`); a `select` literal must
  be one of its options. Bad expressions fail when the config loads.
- `ignorePatterns` lists `.gitignore`-style patterns for files and directories
  that must not be copied: `dist/` (directories only, any depth), `*.log` (by
  name, any depth), `/coverage` or `src/generated/` (relative to the template
  root), `**` for any number of directories. Negation is not supported. Omit it
  or pass `[]` when nothing needs excluding — `node_modules` is skipped anyway.

The `$schema` URL gives editors autocompletion and validation:
`https://jalexw.github.io/mould/openapi/mouldconfig.json`.

### 6. Verify it end to end

Never ship a template without generating from it once.

```bash
mould list      # the new name should appear

mould use my-new-template /tmp/mould-check \
  --input project_name=demo deployment=vercel with_analytics=yes
# or straight from the directory, without registering it:
mould use ./path/to/my-new-template /tmp/mould-check --input project_name=demo

grep -rn 'xxx_\|mould:' /tmp/mould-check   # should print nothing: no placeholders, no marker lines
rm -rf /tmp/mould-check
```

Check that: every placeholder and marker line is gone, no `.mouldconfig.json`
leaked into the output, nothing listed in `ignorePatterns` made it through,
renamed files carry their output names, conditional files appear only for the
inputs that select them (render once per branch), the tree shape is right, and
the generated project actually builds/installs if that is the point of it.

The output directory must not already exist, and its parent must — re-running
into the same path fails until you delete it.

## Working in this repo (`jalexw/mould`)

Templates under `test-fixtures/test-moulds/` are the project's test corpus:
**every immediate subdirectory there automatically becomes a test case** in
`src/__test__/moulds.test.ts`, run as
`mould --sources-files <generated>.json use <name> ./tmp/test-run-<uuid>/<name>`.

So when adding a fixture template:

1. Create the directory under `test-fixtures/test-moulds/`.
2. If it declares inputs, add an entry keyed by the template name to the
   `sampleInputs` map — otherwise the generated test fails on missing inputs.
3. To assert on the generated output, add a validator to the `checks` map.
4. If the fixture needs files that are not committed (e.g. a `dist/` or
   `node_modules/` that `.gitignore` excludes), add a step to the `prepares`
   map — it runs against the fixture directory before `mould use`, the way
   `ignore-patterns-mould` runs `bun install --no-save` and `bun run build`,
   and `binary-mould` writes its gitignored `blob.bin` (commit no binaries).
5. Templates that must *fail* (malformed markers, rename collisions) go under
   `test-fixtures/invalid-moulds/` instead, which the auto-runner ignores, and
   are asserted in `src/__test__/applyTemplate.test.ts`.
6. A fixture file that must stay executable needs
   `git update-index --chmod=+x <file>` — a plain `chmod` is not enough on a
   fresh clone.
7. Run `bun run test` (tests plus `rm -rf ./tmp`).

Fixture configs may point `$schema` at `../../../dist/openapi/mouldconfig.json`
to validate against the locally built schema instead of the published one.

## Gotchas checklist

- [ ] Directory name is the template name users will type
- [ ] Template registered under a `templatesDirectories` (or `templates`) entry, absolute path
- [ ] No name collision with an existing template — the **first** match across sources wins
- [ ] Placeholders are distinctive and valid where they sit (object-form substitutions are literal)
- [ ] Every substitution's `input` matches a declared input `id`
- [ ] Every `when` / `mould:if` references a declared input; blocks are closed and not nested
- [ ] Any `.gitignore` for the output is stored as `_gitignore` and listed under `renames`
- [ ] No `node_modules`, no secrets
- [ ] Build output and other generated files either absent or listed under `ignorePatterns`
- [ ] Generated once into a throwaway directory and inspected
