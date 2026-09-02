// test/contacts.test.ts
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readFileSync } from "node:fs";

let testDir: string;

beforeEach(() => {
  testDir = mkdtempSync(join(tmpdir(), "tc-contact-test-"));
  process.env.TUNNELCAT_CONFIG_DIR = testDir;
});

import { add, list, find, remove, update, load, save } from "../src/contacts.js";

const alice = {
  name: "alice",
  pubkey: "nodekey:" + "a".repeat(64),
  note: "test contact",
};

test("add: appends a new contact", () => {
  add(alice);
  const all = list();
  assert.equal(all.length, 1);
  assert.equal(all[0].name, "alice");
  assert.equal(all[0].pubkey, alice.pubkey);
  assert.ok(all[0].added_at, "added_at should be set");
});

test("add: rejects duplicate name", () => {
  add(alice);
  assert.throws(() => add(alice), /already exists/);
});

test("list: empty file returns []", () => {
  const all = list();
  assert.deepEqual(all, []);
});

test("find: returns null for missing", () => {
  assert.equal(find("ghost"), null);
});

test("find: returns the contact", () => {
  add(alice);
  const got = find("alice");
  assert.ok(got);
  assert.equal(got!.pubkey, alice.pubkey);
});

test("remove: deletes the contact", () => {
  add(alice);
  remove("alice");
  assert.equal(find("alice"), null);
});

test("remove: errors on missing", () => {
  assert.throws(() => remove("ghost"), /no such contact/);
});

test("update: changes pubkey, preserves added_at", () => {
  add(alice);
  const originalAdded = find("alice")!.added_at;
  update({ ...alice, pubkey: "nodekey:" + "b".repeat(64) });
  const after = find("alice")!;
  assert.equal(after.pubkey, "nodekey:" + "b".repeat(64));
  assert.equal(after.added_at, originalAdded);
});

test("on-disk format has version: 1 (Go-compatible)", () => {
  add(alice);
  const p = join(testDir, "contacts.yaml");
  const text = readFileSync(p, "utf8");
  assert.match(text, /^version: 1/m);
  // The Go version uses "pubkey:" with no quotes for hex strings.
  assert.match(text, /pubkey: nodekey:aaaa/);
});
