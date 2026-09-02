# STATUS.md — tunnelcat-ts (TypeScript port)

> Read this to know what tunnelcat-ts is right now.
> The Go version (0ArchLinux0/tunnelcat) has M0 + M1.1-M1.16
> shipped. This TypeScript port is at M0 code-complete, waiting
> for the friend test.

---

## TL;DR

**tunnelcat-ts v0.1.0 — M0 code-complete.** 8/8 sub-steps
shipped. The CLI is in TypeScript (Node 22+), the data plane
is the vendored Go helper (28 MB binary). Wire format,
identity file, and contacts file are byte-compatible with
the Go version. A friend can `npm install -g` and run
`tunnelcat up` in under 30 seconds.

**M0 gate:** a friend runs the install one-liner, follows
the README, and forms a tunnel with the user. Held for
the user (per standing rule, the agent doesn't run the
friend test).

## What got done most recently (last 5 entries, newest first)

| When | What | Where to read more |
|---|---|---|
| 2026-09-02 | M0 closure doc + npm pack test | `canon/closures/M0-20260902.md` |
| 2026-09-02 | M0.1-M0.6 (TS CLI + helper) | `src/`, `bin/`, `test/` |
| 2026-09-02 | M0 plan | `canon/plans/M0-20260902.md` |

## What's on the queue (planned, not started)

The M1 plan is in `canon/plans/M0-20260902.md` (the M1
section was scoped but not started). M1 sub-steps would
mirror the Go version's M1.1-M1.16:

- M1.1-M1.7: already-shipped, re-tested in TS
- M1.8: `dial <name>` (already wired)
- M1.9: `--allow` on the helper side (passes through to helper)
- M1.10: `show --qr` (already wired)
- M1.11: installpath pkg (already in TS)
- M1.12: README quickstart (already in TS)
- M1.13-M1.14: CI cross-build + release workflow (TODO)
- M1.15: `--log-level` (helper handles this; pass-through)
- M1.16: `tunnelcat doctor` (already in TS, 4/5 checks)
- M1.17: friend test (held)
