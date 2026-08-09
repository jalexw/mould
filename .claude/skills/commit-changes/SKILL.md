---
name: commit-changes
description: Commit changes to this repository. Use whenever you are about to run `git commit` here, or the user asks to commit, save, or ship work. Bumps the `package.json` version and prefixes the commit message with the new version, matching this repo's history.
---

# Committing changes to `mould`

`mould` is a published npm package (`@jalexw/mould`). Every commit that changes
shipped behaviour is a release candidate, so the version in `package.json` and
the commit message are kept in lockstep: **bump the version, then use it as the
commit message prefix.**

Commit history to match:

```
0.4.3 - fix link not being within own <li>
0.4.2 - add link to template-sources.json json schema from github pages site
0.4.1 - completing migration to global --sources-files
0.4.0 - big overhall to resolving template directories
```

## Procedure

1. **Review what changed.** `git status` and `git diff` (plus `git diff --staged`).
   Decide from the diff — not from the request wording — which bump applies.

2. **Pick the semver bump** against the current `version` in `package.json`:

   | Bump      | When |
   | --------- | ---- |
   | **patch** | Bug fixes, internal refactors, docs, tests, build/CI tweaks, dependency bumps — anything that leaves the CLI surface and template output unchanged. |
   | **minor** | New behaviour that is backwards compatible: a new subcommand, a new flag, a new field in `.mouldconfig.json` / `template-sources.json`, a new exported helper. |
   | **major** | Breaking changes: removing or renaming a command/flag/config field, changing default output, raising the `engines.node` floor, or changing the shape of a generated project in a way that would surprise existing users. |

   Pre-1.0 caveat: this package is still `0.x`. Breaking changes go out as a
   **minor** bump (`0.4.x` → `0.5.0`) rather than `1.0.0`; do not cut `1.0.0`
   without the user explicitly asking for it.

   When a diff spans several categories, the highest-impact change wins.

3. **Edit `package.json`.** Change only the `version` field. Do not hand-edit
   `bun.lock` — if you prefer a tool, `bun pm version patch|minor|major
   --no-git-tag-version` works, but a direct edit is fine.

4. **Verify the change still builds** before committing, when the diff touches
   TypeScript sources:

   ```bash
   bun run build:typescript
   bun run test          # tests + `rm -rf ./tmp`
   ```

   If either fails, fix the failure — don't commit around it.

5. **Stage and commit** with the new version as the prefix:

   ```
   <new-version> - <lowercase imperative summary of the change>
   ```

   For example, going `0.4.3` → `0.4.4`:

   ```bash
   git add -A
   git commit -m "0.4.4 - stop .mouldconfig.json leaking into scaffolded output"
   ```

   The version bump belongs in the **same commit** as the change it describes —
   never a separate "bump version" commit.

6. **Push** to the current working branch (never straight to `main` unless the
   user says so):

   ```bash
   git push -u origin "$(git rev-parse --abbrev-ref HEAD)"
   ```

## Multi-line commit messages

Keep the versioned prefix on the subject line and put detail in the body:

```
0.5.0 - support MOULD_TEMPLATE_SOURCES environment variable

Template source files are now resolved from, in precedence order:
--sources-files, MOULD_TEMPLATE_SOURCES, then ./template-sources.json.
```

## When *not* to bump

- **Amending** the previous commit, or fixing up a commit whose version bump has
  not been published yet — reuse that version instead of stacking another bump.
- **Merge commits.** Merges keep their default message and carry whatever
  version the merged branch landed.

That list is exhaustive. Everything else gets a bump — including changes to
files excluded from the published tarball, such as `CLAUDE.md`, `.github/`, or
`.claude/` itself. Those land as a **patch**.

If you genuinely cannot tell which bump is right, say what you'd pick and why in
one sentence, then commit with it rather than stopping to ask.
