# XxX_AppName_XxX

A small TypeScript app used to verify that `ignorePatterns` in
`.mouldconfig.json` keeps build output (`dist/`), installed dependencies
(`node_modules/`) and log files (`*.log`) out of the scaffolded project.

The test suite runs `bun install` and `bun run build` in this directory first,
so that `dist/` and `node_modules/` really exist when the template is used.
