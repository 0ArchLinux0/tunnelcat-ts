#!/usr/bin/env node
// bin/tunnelcat.js — the entry point that npm installs to PATH.
// Loads the built JS from dist/, falling back to tsx for dev.

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dist = join(__dirname, "..", "dist", "index.js");
const src = join(__dirname, "..", "src", "index.ts");

if (existsSync(dist)) {
  const mod = await import(dist);
  const rc = mod.main(process.argv.slice(2));
  if (rc instanceof Promise) {
    rc.then((code) => process.exit(code));
  } else {
    process.exit(rc);
  }
} else if (existsSync(src)) {
  // Dev mode: run via tsx.
  const r = spawnSync("npx", ["tsx", src, ...process.argv.slice(2)], {
    stdio: "inherit",
    cwd: join(__dirname, ".."),
  });
  process.exit(r.status ?? 1);
} else {
  console.error("tunnelcat: cannot find dist/index.js or src/index.ts");
  console.error("Did you run `npm install` and `npm run build`?");
  process.exit(1);
}
