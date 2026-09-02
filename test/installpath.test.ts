// test/installpath.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { configDir, ensureConfigDir, keysDir, contactsPath } from "../src/installpath.js";

test("configDir: TUNNELCAT_CONFIG_DIR wins", () => {
  process.env.TUNNELCAT_CONFIG_DIR = "/tmp/tc-test";
  process.env.XDG_CONFIG_HOME = "/tmp/xdg";
  assert.equal(configDir(), "/tmp/tc-test");
  delete process.env.TUNNELCAT_CONFIG_DIR;
});

test("configDir: XDG_CONFIG_HOME second", () => {
  process.env.XDG_CONFIG_HOME = "/tmp/xdg";
  assert.equal(configDir().startsWith("/tmp/xdg/"), true);
  delete process.env.XDG_CONFIG_HOME;
});

test("configDir: $HOME/.config/tunnelcat default", () => {
  process.env.HOME = "/tmp/home";
  process.env.XDG_CONFIG_HOME = "";
  assert.equal(configDir().includes(".config/tunnelcat"), true);
});

test("ensureConfigDir: creates with 0700", () => {
  const tmp = process.env.TMPDIR || "/tmp";
  const testDir = `${tmp}/tc-test-${Date.now()}`;
  process.env.TUNNELCAT_CONFIG_DIR = testDir;
  const got = ensureConfigDir();
  assert.equal(got, testDir);
  delete process.env.TUNNELCAT_CONFIG_DIR;
});

test("keysDir: nested under configDir", () => {
  process.env.TUNNELCAT_CONFIG_DIR = "/tmp/tc-x";
  assert.equal(keysDir(), "/tmp/tc-x/keys");
  delete process.env.TUNNELCAT_CONFIG_DIR;
});

test("contactsPath: contacts.yaml under configDir", () => {
  process.env.TUNNELCAT_CONFIG_DIR = "/tmp/tc-x";
  assert.equal(contactsPath(), "/tmp/tc-x/contacts.yaml");
  delete process.env.TUNNELCAT_CONFIG_DIR;
});
