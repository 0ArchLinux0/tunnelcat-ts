# Test gates — what "done" means at each stage

> **Rule:** a stage is DONE only when its gate test passes.
> No skipping. No "the wire looks right, the friend will
> test it." If the test doesn't pass, the stage isn't done.

## Gate definitions

### M0.7 — Wire interop (CURRENT GATE)

**Claim:** the TS CLI can dial a server (Go or TS) and get
echo round-trip.

**Test:** `./test/integration/echoroundtrip.test.ts`
spawns the helper twice (one as up, one as dial), sends
"hello\n" through stdin of the client, asserts "hello\n"
comes back on stdout of the client, both within 30s.

**Pass criteria:**
- `npm test` includes this test
- Test runs in CI (not just locally)
- Test passes 5/5 times in a row (no flake)
- The wire format is verified: same ConnBlob, same identity
  file, same contacts file across the two stacks

**Fail criteria:**
- Test takes >30s
- Output doesn't round-trip exactly
- Test only works with TS-on-TS (not TS-on-Go)
- Test flakes (passes 3/5)

### M0.8 — npm install

**Claim:** a clean `npm install -g` of the package, with
NO pre-existing tunnelcat installation, gives a working
`tunnelcat` CLI.

**Test:** `./test/integration/freshinstall.test.sh`
- mkdir /tmp/fresh
- npm install -g <pack>
- tunnelcat --version (or equivalent)
- tunnelcat identity init
- tunnelcat up & (with --port=test)

**Pass criteria:** all three succeed in <30s wall time.

### M1.x — each M1 sub-step

Each M1 sub-step in the Go version had a paired test. The
TS port re-implements them; each MUST have a passing test
before merging.

## What I commit to

- No stage advance without a green test
- No "I'll test it later" — test it NOW
- No "the wire looks right" without a round-trip proof
- If a test fails, the next 5 minutes are debugging, not
  new features

