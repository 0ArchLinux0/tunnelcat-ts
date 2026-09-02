// identity.ts — read/write the on-disk identity file.
//
// The on-disk format is byte-compatible with the Go version
// (internal/identity/identity.go). A Go server's identity file
// can be loaded by this code and vice versa.
//
// File format (version 1):
//
//   {
//     "version": 1,
//     "name": "default",
//     "created_at": "2026-08-30T15:00:00Z",
//     "key": "nodekey:9c8d2e...",
//     "key_raw": "base64-of-32-bytes",
//     "key_sha256": "hex-of-sha256(key_raw)"
//   }

import { createHash, randomBytes } from "node:crypto";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { keysDir, ensureConfigDir } from "./installpath.js";

const FILE_VERSION = 1;

export type IdentityFile = {
  version: number;
  name: string;
  created_at: string;
  key: string; // "nodekey:<64 hex chars>"
  key_raw: string; // base64 of 32 raw bytes
  key_sha256: string; // hex of sha256(key_raw)
};

export function keyPath(name: string): string {
  return join(keysDir(), `${name}.private.json`);
}

export function exists(name: string): boolean {
  return existsSync(keyPath(name));
}

export function load(name: string): IdentityFile | null {
  const p = keyPath(name);
  if (!existsSync(p)) return null;
  const data = readFileSync(p, "utf8");
  const f = JSON.parse(data) as IdentityFile;
  if (f.version > FILE_VERSION) {
    throw new Error(`identity: file version ${f.version} is newer than supported (${FILE_VERSION}); upgrade tunnelcat`);
  }
  // Integrity check: re-derive the sha256 and compare.
  const raw = Buffer.from(f.key_raw, "base64");
  const sha = createHash("sha256").update(raw).digest("hex");
  if (sha !== f.key_sha256) {
    throw new Error(`identity: file ${p} is corrupt (sha256 mismatch)`);
  }
  return f;
}

export function save(f: IdentityFile): void {
  ensureConfigDir();
  mkdirSync(keysDir(), { recursive: true, mode: 0o700 });
  const p = keyPath(f.name);
  const data = JSON.stringify(f, null, 2) + "\n";
  writeFileSync(p, data, { mode: 0o600 });
}

// newIdentity generates a fresh identity with a Curve25519
// private key. The format "nodekey:<64 hex chars>" is the
// tailscale.com standard.
//
// Note: Node's crypto module doesn't expose Curve25519
// directly. We use a placeholder 32-byte random key here;
// the Go helper (the data plane) is what actually uses
// this key for the wire protocol. The TS CLI is a
// pass-through: it just stores and reads the file.
//
// For the M0.3 round-trip test, we only need the JSON
// format to be correct; the actual cryptographic
// operations happen in the helper.

export function newIdentity(name: string): IdentityFile {
  const raw = randomBytes(32);
  const hex = raw.toString("hex");
  const sha = createHash("sha256").update(raw).digest("hex");
  return {
    version: FILE_VERSION,
    name,
    created_at: new Date().toISOString(),
    key: `nodekey:${hex}`,
    key_raw: raw.toString("base64"),
    key_sha256: sha,
  };
}

// getOrCreate returns the named identity, or creates one if
// it doesn't exist.
export function getOrCreate(name: string): { identity: IdentityFile; created: boolean } {
  const existing = load(name);
  if (existing) return { identity: existing, created: false };
  const id = newIdentity(name);
  save(id);
  return { identity: id, created: true };
}
