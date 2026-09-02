# tunnelcat (TypeScript)

> A 1:1 mesh tunnel that ships fast. TypeScript CLI + bundled
> Go data plane. Same wire format as the Go version.

```
machine A (server)         machine B (client)
$ npx tunnelcat up         $ npx tunnelcat dial <token-or-name>
🐈 Server listening...     🐈 Connected.
press Ctrl-C to stop       hello
                           hello    ← echo
```

## Status

**M0 in progress.** Plan in `canon/plans/M0-20260902.md`.

## Quickstart (when M0.8 is done)

```sh
# On machine A
$ npx tunnelcat up
🐈 Server listening with new address: tc...long-string...
```

```sh
# On machine B
$ npx tunnelcat dial tc...long-string...
hello
hello
```

## Why this exists

The Go version (github.com/0ArchLinux0/tunnelcat) is 90% data
plane, 10% CLI. The data plane is hard (NAT traversal, WireGuard,
DERP relay). The CLI is annoying to iterate. This repo is the
CLI redone in TypeScript, with the Go binary bundled as an
npm optional dependency. Same wire format, same identity file,
same contacts file — friends on either version can talk.

## Develop

```sh
npm install
npm test
```

## Stack

- TypeScript on Node 22+
- `qrcode` for terminal QR codes
- `yaml` for the contacts file
- Go binary as a bundled optional dependency (downloads on install)

## Substrate note

This is a network-shaped project (VPN, NAT traversal, WireGuard).
The agent working on the data plane loads the networking-
fundamentals skill before any change to the wire protocol.
The CLI is application-layer only.
