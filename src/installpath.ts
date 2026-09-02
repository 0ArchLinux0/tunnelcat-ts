// installpath.ts — XDG-aware config dir for tunnelcat.
// Mirrors internal/installpath/installpath.go in the Go version.

import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

export function configDir(): string {
  const tc = process.env.TUNNELCAT_CONFIG_DIR;
  if (tc) return tc;
  const xdg = process.env.XDG_CONFIG_HOME;
  if (xdg) return join(xdg, "tunnelcat");
  return join(homedir(), ".config", "tunnelcat");
}

export function ensureConfigDir(): string {
  const dir = configDir();
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  return dir;
}

export function keysDir(): string {
  return join(ensureConfigDir(), "keys");
}

export function contactsPath(): string {
  return join(ensureConfigDir(), "contacts.yaml");
}
