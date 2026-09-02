// index.ts — the `tunnelcat` CLI entry point.

import { parseArgs } from "./argv.js";
import {
  runUp, runDial,
  runIdentityInit, runIdentityShow,
  runContactAdd, runContactList, runContactShow, runContactRemove, runContactSetBlob,
  runShow, runDoctor,
} from "./commands.js";

const USAGE = `Usage:
  tunnelcat up                            listen and print a connection token
  tunnelcat dial <token-or-name>          connect to a peer
  tunnelcat identity init [--name=NAME]   create a device identity
  tunnelcat identity show [--name=NAME]   show the device's pubkey
  tunnelcat contact add <name> <pubkey>   add a peer to the contact list
  tunnelcat contact list                  list all contacts
  tunnelcat contact show <name>           show one contact
  tunnelcat contact remove <name>         remove a peer
  tunnelcat contact set-blob <n> <token>  store a peer's ConnBlob
  tunnelcat show --qr                     print a QR code of the pubkey
  tunnelcat doctor                        run diagnostic checks
`;

export function main(argv: string[]): number | Promise<number> {
  const { verb, flags, positional } = parseArgs(argv);
  if (flags.help || flags.h) {
    console.log(USAGE);
    return 0;
  }
  switch (verb) {
    case "":
      console.log(USAGE);
      return 0;
    case "up":
      return runUp(positional, flags);
    case "dial":
      return runDial(positional, flags);
    case "identity":
      switch (positional[0]) {
        case "init": return runIdentityInit(positional.slice(1), flags);
        case "show": return runIdentityShow(flags);
        default:
          console.error("Usage: tunnelcat identity <init|show> [...]");
          return 2;
      }
    case "contact":
      switch (positional[0]) {
        case "add":       return runContactAdd(positional.slice(1));
        case "list":      return runContactList();
        case "show":      return runContactShow(positional.slice(1));
        case "remove":    return runContactRemove(positional.slice(1));
        case "set-blob":  return runContactSetBlob(positional.slice(1));
        default:
          console.error("Usage: tunnelcat contact <add|list|show|remove|set-blob> [...]");
          return 2;
      }
    case "show":
      return runShow(flags);
    case "doctor":
      return runDoctor();
    default:
      console.error(`tunnelcat: unknown command ${verb}`);
      console.error(USAGE);
      return 2;
  }
}

// Run when executed directly. Skip when imported by tests.
import { argv } from "node:process";
if (import.meta.url === `file://${process.argv[1]}`) {
  const rc = main(argv.slice(2));
  if (rc instanceof Promise) {
    rc.then((code) => process.exit(code));
  } else {
    process.exit(rc);
  }
}
