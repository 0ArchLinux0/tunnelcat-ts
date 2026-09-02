// test/argv.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseArgs } from "../src/argv.js";

test("parseArgs: empty", () => {
  const r = parseArgs([]);
  assert.equal(r.verb, "");
  assert.deepEqual(r.flags, {});
  assert.deepEqual(r.positional, []);
});

test("parseArgs: simple verb", () => {
  const r = parseArgs(["up"]);
  assert.equal(r.verb, "up");
  assert.deepEqual(r.flags, {});
  assert.deepEqual(r.positional, []);
});

test("parseArgs: --flag=value", () => {
  const r = parseArgs(["dial", "tc123", "--port=22"]);
  assert.equal(r.verb, "dial");
  assert.deepEqual(r.flags, { port: "22" });
  assert.deepEqual(r.positional, ["tc123"]);
});

test("parseArgs: --flag value (separate)", () => {
  const r = parseArgs(["dial", "tc123", "--port", "22"]);
  assert.equal(r.verb, "dial");
  assert.deepEqual(r.flags, { port: "22" });
  assert.deepEqual(r.positional, ["tc123"]);
});

test("parseArgs: boolean flag", () => {
  const r = parseArgs(["show", "--qr"]);
  assert.equal(r.verb, "show");
  assert.deepEqual(r.flags, { qr: true });
});

test("parseArgs: short flag -h", () => {
  const r = parseArgs(["-h"]);
  assert.equal(r.verb, "-h");
});

test("parseArgs: mixed", () => {
  const r = parseArgs(["up", "--identity=default", "--allow", "alice", "--allow=bob", "extra"]);
  assert.equal(r.verb, "up");
  assert.deepEqual(r.flags, { identity: "default", allow: "bob" });
  assert.deepEqual(r.positional, ["extra"]);
});
