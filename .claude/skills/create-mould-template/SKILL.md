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
`node_modules`, and `.DS_Store`, which are skipped by name at every level.

Keep out of the template:

- Binary assets — files are round-tripped as UTF-8 and will be corrupted.
- Installed dependencies, build output, lockfile-adjacent junk.
- Real secrets. Templates are copied verbatim; there is no redaction step.

### 4. Choose placeholders and mark up the files

Put a distinctive placeholder everywhere a value should be injected:

```jsonc
// package.json inside the template
{ "name": "@YyY_OrgScope_YyY/XxX_ProjectName_XxX" }
```

Placeholder rules that matter:

- **Patterns are compiled as regexes** (`new RegExp(pattern, "g")`). Stick to
  letters, digits, and underscores — `XxX_ProjectName_XxX`, `__PROJECT_NAME__` —
  or escape every metacharacter. A pattern like `v1.0` would also match `v100`.
- **Make them unmistakable.** A pattern applies to every copied file, so a bare
  word like `name` will shred unrelated text.
- **Filenames are never rewritten** — only file contents. A file called
  `__NAME__.ts` is emitted with that literal name. Do not try to template paths.
- `{{DOUBLE_BRACE}}` style works too (`{{` is literal in JS regex) and is used by
  the `interactive-test-mould` fixture — but underscore-only patterns are safer.

### 5. Declare inputs and substitutions

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
    },
    {
      "id": "org_scope",
      "label": "Org Scope",
      "description": "npm scope for the generated package.json",
      "required": true,
      "type": "text"
    }
  ],
  "substitutions": [
    ["XxX_ProjectName_XxX", "project_name"],
    ["YyY_OrgScope_YyY", "org_scope"]
  ]
}
```

- Every input needs `id`, `label`, `required`, and `type` (`"text"` is the only
  type today); `description` is optional. The schema is strict — an extra or
  misspelled field fails the run, not just that input.
- Each substitution is `[pattern, input_id]` — the **second** element is the
  input `id`, not a value. Pairs apply in listed order.
- Referencing an `input_id` that no input declares is not an error, but nothing
  will prompt for it — the substitution only fires if a caller happens to pass
  `--input <id>=<value>`, and otherwise leaves the placeholder in the output.
  Keep the two lists in sync.
- Omit `substitutions` entirely for a verbatim template. An empty array is
  rejected (the list must be non-empty when present).
- `inputs` may be `[]` for a template that collects nothing.

The `$schema` URL gives editors autocompletion and validation:
`https://jalexw.github.io/mould/openapi/mouldconfig.json`.

### 6. Verify it end to end

Never ship a template without generating from it once.

```bash
mould list      # the new name should appear

mould use my-new-template /tmp/mould-check \
  --input project_name=demo org_scope=acme

find /tmp/mould-check -type f -exec grep -l 'XxX_\|__PROJECT' {} +   # should print nothing
rm -rf /tmp/mould-check
```

Check that: every placeholder is gone, no `.mouldconfig.json` leaked into the
output, the tree shape is right, and the generated project actually
builds/installs if that is the point of it.

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
4. Run `bun run test` (tests plus `rm -rf ./tmp`).

Fixture configs may point `$schema` at `../../../dist/openapi/mouldconfig.json`
to validate against the locally built schema instead of the published one.

## Gotchas checklist

- [ ] Directory name is the template name users will type
- [ ] Template registered under a `templatesDirectories` (or `templates`) entry, absolute path
- [ ] No name collision with an existing template — the **first** match across sources wins
- [ ] Placeholders are regex-safe and distinctive
- [ ] Every substitution's `input_id` matches a declared input `id`
- [ ] No binaries, no `node_modules`, no secrets
- [ ] Generated once into a throwaway directory and inspected
