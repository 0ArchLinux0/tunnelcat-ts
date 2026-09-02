// contacts.ts — read/write the on-disk contacts file.
//
// The on-disk format is byte-compatible with the Go version
// (internal/contacts/contacts.go). YAML in/out, with the
// `version: 1` header.

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { parse, stringify } from "yaml";
import { contactsPath, ensureConfigDir } from "./installpath.js";

const FILE_VERSION = 1;

export type Contact = {
  name: string;
  pubkey: string;
  conn_blob?: string;
  added_at?: string;
  last_seen?: string;
  last_addr?: string;
  note?: string;
};

export type ContactsFile = {
  version: number;
  contacts: Contact[];
};

export function load(): ContactsFile {
  const p = contactsPath();
  if (!existsSync(p)) {
    return { version: FILE_VERSION, contacts: [] };
  }
  const data = readFileSync(p, "utf8");
  const f = parse(data) as ContactsFile;
  if (f.version > FILE_VERSION) {
    throw new Error(`contacts: file version ${f.version} is newer than supported (${FILE_VERSION}); upgrade tunnelcat`);
  }
  if (!f.contacts) f.contacts = [];
  return f;
}

export function save(f: ContactsFile): void {
  ensureConfigDir();
  const p = contactsPath();
  f.version = FILE_VERSION;
  const data = stringify(f, { lineWidth: 0 });
  writeFileSync(p, data, { mode: 0o600 });
}

export function add(c: Contact): void {
  const f = load();
  if (f.contacts.some((x) => x.name === c.name)) {
    throw new Error(`contacts: ${c.name} already exists`);
  }
  c.added_at = c.added_at || new Date().toISOString();
  f.contacts.push(c);
  save(f);
}

export function remove(name: string): void {
  const f = load();
  const before = f.contacts.length;
  f.contacts = f.contacts.filter((c) => c.name !== name);
  if (f.contacts.length === before) {
    throw new Error(`contacts: no such contact ${name}`);
  }
  save(f);
}

export function find(name: string): Contact | null {
  const f = load();
  return f.contacts.find((c) => c.name === name) || null;
}

export function list(): Contact[] {
  return load().contacts;
}

export function update(c: Contact): void {
  const f = load();
  const i = f.contacts.findIndex((x) => x.name === c.name);
  if (i < 0) throw new Error(`contacts: no such contact ${c.name}`);
  // Preserve added_at from the existing entry if not provided.
  if (!c.added_at) c.added_at = f.contacts[i].added_at;
  f.contacts[i] = c;
  save(f);
}
