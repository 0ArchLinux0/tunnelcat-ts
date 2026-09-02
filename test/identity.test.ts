// test/identity.test.ts
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

let testDir: string;

beforeEach(() => {
  testDir = mkdtempSync(join(tmpdir(), "tc-id-test-"));
  process.env.TUNNELCAT_CONFIG_DIR = testDir;
});

import { getOrCreate, load, save, keyPath, newIdentity } from "../src/identity.js";

test("getOrCreate: creates on first call", () => {
  const { identity, created } = getOrCreate("default");
  assert.equal(created, true);
  assert.equal(identity.name, "default");
  assert.equal(identity.version, 1);
  assert.match(identity.key, /^nodekey:[0-9a-f]{64}$/);
});

test("getOrCreate: returns existing on second call", () => {
  const a = getOrCreate("default");
  const b = getOrCreate("default");
  assert.equal(a.created, true);
  assert.equal(b.created, false);
  assert.equal(a.identity.key, b.identity.key);
});

test("load: returns null on missing", () => {
  assert.equal(load("ghost"), null);
});

test("save/load round-trip: byte-identical JSON", () => {
  const a = newIdentity("studio-mac");
  save(a);
  const raw = readFileSync(keyPath("studio-mac"), "utf8");
  const loaded = load("studio-mac");
  assert.deepEqual(loaded, a);
  // The on-disk file is parseable JSON that matches what the
  // Go version would write (same field names, same shape).
  const parsed = JSON.parse(raw);
  assert.equal(parsed.version, 1);
  assert.equal(parsed.name, "studio-mac");
  assert.equal(typeof parsed.key, "string");
  assert.equal(typeof parsed.key_raw, "string");
  assert.equal(typeof parsed.key_sha256, "string");
});

test("save: file mode is 0600", () => {
  const a = newIdentity("default");
  save(a);
  const stat = statSync(keyPath("default"));
  // 0o600 = 384 decimal. mode includes file-type bits in the
  // high bits; mask to 0o777 to get just the permission bits.
  assert.equal(stat.mode & 0o777, 0o600);
});

test("file format is Go-compatible (same field names)", () => {
  const a = newIdentity("default");
  save(a);
  const raw = readFileSync(keyPath("default"), "utf8");
  const parsed = JSON.parse(raw);
  // These are the exact field names the Go version writes.
  for (const field of ["version", "name", "created_at", "key", "key_raw", "key_sha256"]) {
    assert.ok(field in parsed, `missing field ${field}`);
  }
});
