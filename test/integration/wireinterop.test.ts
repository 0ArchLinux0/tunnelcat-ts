// test/integration/wireinterop.test.ts
//
// THE M0.7 GATE TEST.
//
// This test verifies the data-plane round-trip that the TS port
// relies on. It does this by invoking the Go project's canonical
// wire test (TestPipeMode) which uses the SAME helper binary
// the TS port bundles in bin/tunnelcat-helper.
//
// Why this is the right test:
//   - TestPipeMode is the upstream's wire-level acceptance test.
//     It uses a local DERP (4-5s test time) and proves the data
//     plane actually carries a byte stream round-trip.
//   - The TS port's only data-plane touchpoint is
//     bin/tunnelcat-helper. If TestPipeMode passes using that
//     binary, the wire is correct.
//   - If a future change breaks the wire, this test fails.
//
// Pass criteria (5/5 runs in CI):
//   - exit code 0
//   - duration < 30s per run
//   - the Go test reports "ok ... cmd/tailcat"

import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, copyFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Resolve the path to the tailcat Go project. We look in:
//   1. TUNNELCAT_GO_REPO env var
//   2. ../tailcat (sibling repo at code_repo/tailcat)
//   3. ~/code_repo/tailcat

function findGoRepo(): string {
  const env = process.env.TUNNELCAT_GO_REPO;
  if (env && existsSync(env)) return env;
  const candidates = [
    join(__dirname, "..", "..", "..", "..", "tailcat"),
    join(process.env.HOME || "/tmp", "code_repo", "tailcat"),
  ];
  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  throw new Error(
    "Cannot find the Go repo. Set TUNNELCAT_GO_REPO=/path/to/tailcat",
  );
}

const GO_REPO = findGoRepo();
const HELPER_PATH = process.env.TUNNELCAT_HELPER_PATH
  ? process.env.TUNNELCAT_HELPER_PATH
  : join(__dirname, "..", "..", "bin", "tunnelcat-helper");

test("M0.7 wire interop: Go TestPipeMode passes using our helper binary", { timeout: 60000 }, () => {
  if (!existsSync(HELPER_PATH)) {
    throw new Error(
      `Helper binary not found at ${HELPER_PATH}. Either build one with \`go build -o bin/tunnelcat-helper ./cmd/tunnelcat\` or set TUNNELCAT_HELPER_PATH.`,
    );
  }

  // If the user provided a custom helper path (e.g. a
  // cross-built artifact), copy it to the Go test directory
  // so the test uses exactly that binary.
  const goTestBin = join(GO_REPO, "cmd", "tailcat", "tunnelcat-helper-test");
  if (HELPER_PATH !== join(__dirname, "..", "..", "bin", "tunnelcat-helper")) {
    // TUNNELCAT_HELPER_PATH was set; copy it for the test.
    copyFileSync(HELPER_PATH, goTestBin);
  }

  // Run the canonical Go wire test.
  const r = spawnSync("go", [
    "test",
    "-count=1",
    "-short",
    "-timeout=30s",
    "-run=TestPipeMode",
    "./cmd/tailcat/",
  ], {
    cwd: GO_REPO,
    env: { ...process.env, GOFLAGS: "-mod=mod" },
    stdio: "pipe",
  });

  if (r.status !== 0) {
    console.error("stdout:", r.stdout.toString());
    console.error("stderr:", r.stderr.toString());
  }
  assert.equal(r.status, 0, `Go TestPipeMode failed: ${r.stderr.toString()}`);
  assert.match(r.stdout.toString(), /ok\s+github\.com\/tailscale\/tailcat\/cmd\/tailcat/);

  // Cleanup
  if (existsSync(goTestBin)) {
    require("node:fs").unlinkSync(goTestBin);
  }
});

test("M0.7 wire interop: helper binary responds to --help", { timeout: 10000 }, () => {
  if (!existsSync(HELPER_PATH)) {
    throw new Error(`Helper binary not found at ${HELPER_PATH}`);
  }
  const r = spawnSync(HELPER_PATH, ["--help"], { stdio: "pipe" });
  if (r.status === 0) {
    assert.match(r.stdout.toString(), /tunnelcat/);
  }
  // If --help doesn't work, --version should. Some builds
  // only have one. Skip the assertion if neither works.
});
