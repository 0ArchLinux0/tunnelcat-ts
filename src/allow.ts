// src/allow.ts — resolve --allow=NAME flags to pubkeys.
//
// M1.9: when `tunnelcat up --allow=NAME` is given, look up
// the contact's pubkey and pass it to the helper as
// `--allow-pubkey=nodekey:...`. The helper (Go) does the
// actual allowlist enforcement.

import * as contacts from "./contacts.js";

export function resolveAllowList(names: string[]): string[] {
  const out: string[] = [];
  for (const name of names) {
    const c = contacts.find(name);
    if (!c) {
      throw new Error(`no such contact ${JSON.stringify(name)} (add it with \`tunnelcat contact add\`)`);
    }
    if (!/^nodekey:[0-9a-f]{64}$/.test(c.pubkey)) {
      throw new Error(`contact ${JSON.stringify(name)} has malformed pubkey ${c.pubkey}`);
    }
    out.push(c.pubkey);
  }
  return out;
}
