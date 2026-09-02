// test/integration/freshinstall.test.ts
//
// THE M0.8 GATE TEST.
//
// This test verifies that a clean `npm install -g` of the
// package gives a working `tunnelcat` CLI, with no pre-existing
// installation.
//
// What we test:
//   1. `npm pack` produces a valid tarball
//   2. Installing the tarball in a fresh prefix puts `tunnelcat` on PATH
//   3. `tunnelcat` (no args) prints usage and exits 0
//   4. `tunnelcat identity init` creates a key file
//   5. `tunnelcat identity show` prints the pubkey
//
// What we do NOT test (deferred to M0.8 friend test):
//   - Real network echo round-trip after install
//   - Cross-platform install (only the host platform)

import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, existsSync, readdirSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..", "..");

test("M0.8 fresh install: npm pack succeeds", { timeout: 60000 }, () => {
  const r = spawnSync("npm", ["pack"], {
    cwd: REPO_ROOT,
    stdio: "pipe",
    env: { ...process.env, npm_config_cache: "/tmp/npm-cache-test" },
  });
  if (r.status !== 0) {
    console.error("stdout:", r.stdout.toString());
    console.error("stderr:", r.stderr.toString());
  }
  assert.equal(r.status, 0, "npm pack failed");
  // The tarball should be in REPO_ROOT.
  const tarballs = readdirSync(REPO_ROOT).filter((f) => f.endsWith(".tgz"));
  assert.ok(tarballs.length > 0, "no .tgz produced");
  // Cleanup
  for (const t of tarballs) rmSync(join(REPO_ROOT, t));
});

test("M0.8 fresh install: install + identity init + show", { timeout: 120000 }, () => {
  // Build a tarball.
  const pack = spawnSync("npm", ["pack"], {
    cwd: REPO_ROOT,
    stdio: "pipe",
    env: { ...process.env, npm_config_cache: "/tmp/npm-cache-test" },
  });
  assert.equal(pack.status, 0, `npm pack failed: ${pack.stderr.toString()}`);
  const tarballs = readdirSync(REPO_ROOT).filter((f) => f.endsWith(".tgz"));
  assert.equal(tarballs.length, 1, "expected exactly one tarball");
  const tarball = join(REPO_ROOT, tarballs[0]);

  try {
    // Make a fresh install prefix.
    const prefix = mkdtempSync(join(tmpdir(), "tc-fresh-"));
    const home = mkdtempSync(join(tmpdir(), "tc-fresh-home-"));

    // Install the tarball into the fresh prefix.
    const install = spawnSync("npm", [
      "install",
      "--prefix", prefix,
      "--global",
      tarball,
    ], {
      env: { ...process.env, HOME: home, npm_config_cache: "/tmp/npm-cache-test" },
      stdio: "pipe",
    });
    if (install.status !== 0) {
      console.error("install stdout:", install.stdout.toString());
      console.error("install stderr:", install.stderr.toString());
    }
    assert.equal(install.status, 0, "npm install failed");

    // The `tunnelcat` binary should be at <prefix>/bin/tunnelcat
    // (npm install --global layout on macOS/Linux).
    const bin = join(prefix, "bin", "tunnelcat");
    assert.ok(existsSync(bin), `tunnelcat binary not at ${bin}`);
    assert.ok(statSync(bin).mode & 0o111, "tunnelcat binary is not executable");

    // Run tunnelcat (no args) — should print usage and exit 0.
    const noargs = spawnSync(bin, [], {
      env: { ...process.env, HOME: home, TUNNELCAT_CONFIG_DIR: join(home, "config") },
      stdio: "pipe",
    });
    assert.equal(noargs.status, 0, "tunnelcat (no args) exited non-zero");
    assert.match(noargs.stdout.toString(), /Usage:/);

    // Run identity init.
    const init = spawnSync(bin, ["identity", "init", "--name=fresh"], {
      env: { ...process.env, HOME: home, TUNNELCAT_CONFIG_DIR: join(home, "config") },
      stdio: "pipe",
    });
    if (init.status !== 0) {
      console.error("init stdout:", init.stdout.toString());
      console.error("init stderr:", init.stderr.toString());
    }
    assert.equal(init.status, 0, "tunnelcat identity init failed");

    // Run identity show — should print a pubkey.
    const show = spawnSync(bin, ["identity", "show", "--name=fresh"], {
      env: { ...process.env, HOME: home, TUNNELCAT_CONFIG_DIR: join(home, "config") },
      stdio: "pipe",
    });
    assert.equal(show.status, 0, "tunnelcat identity show failed");
    assert.match(show.stdout.toString(), /nodekey:[0-9a-f]{64}/);
  } finally {
    // Cleanup tarball.
    rmSync(tarball, { force: true });
  }
});
