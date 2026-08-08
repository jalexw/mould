#!/usr/bin/env node
// mould - bin/mould.ts
// Executable entrypoint published as the `mould` command in package.json

import run from "$/mould";

await run(process.argv);
