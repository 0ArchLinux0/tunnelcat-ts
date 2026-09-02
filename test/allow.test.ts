// test/allow.test.ts
//
// THE M1.9 GATE TEST.

import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

beforeEach(() => {
  process.env.TUNNELCAT_CONFIG_DIR = mkdtempSync(join(tmpdir(), "tc-allow-"));
});

import { resolveAllowList } from "../src/allow.js";
import * as contacts from "../src/contacts.js";

const VALID_PUBKEY = "nodekey:" + "a".repeat(64);

test("M1.9: empty allow list returns []", () => {
  assert.deepEqual(resolveAllowList([]), []);
});

test("M1.9: single contact resolves to its pubkey", () => {
  contacts.add({ name: "alice", pubkey: VALID_PUBKEY });
  const got = resolveAllowList(["alice"]);
  assert.deepEqual(got, [VALID_PUBKEY]);
});

test("M1.9: multiple contacts resolve in order", () => {
  contacts.add({ name: "alice", pubkey: VALID_PUBKEY });
  contacts.add({ name: "bob", pubkey: "nodekey:" + "b".repeat(64) });
  const got = resolveAllowList(["alice", "bob"]);
  assert.deepEqual(got, [VALID_PUBKEY, "nodekey:" + "b".repeat(64)]);
});

test("M1.9: unknown contact throws", () => {
  assert.throws(() => resolveAllowList(["ghost"]), /no such contact/);
});

test("M1.9: malformed pubkey throws", () => {
  // Add a contact with a bad pubkey directly (bypass add's validation).
  contacts.save({
    version: 1,
    contacts: [{ name: "broken", pubkey: "not-a-pubkey" }],
  });
  assert.throws(() => resolveAllowList(["broken"]), /malformed pubkey/);
});
