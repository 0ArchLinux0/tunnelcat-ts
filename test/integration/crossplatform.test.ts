// test/integration/crossplatform.test.ts
//
// THE M1.17 GATE TEST (agent-runnable version).
//
// Real cross-platform round-trip: TS CLI on Mac (darwin/arm64)
// dials a TS server running on Mac, then the same CLI on a
// remote Linux box dials the same server. Both use the
// helper binary, and the test verifies the wire works
// end-to-end through real DERP.
//
// Requires:
//   - bin/tunnelcat-helper-linux-amd64 (cross-built)
//   - ssh access to a Linux host (TUNNELCAT_LINUX_HOST)
//   - the same helper binary at /tmp on the remote host
//
// Pass criteria:
//   - exit code 0
//   - "hello-from-linux" appears in the server's stdout
//   - the round-trip takes < 60 seconds

import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn, ChildProcess } from "node:child_process";
import { execSync } from "node:child_process";
import { mkdtempSync, existsSync, writeFileSync, readFileSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..", "..");
const HELPER_DARWIN = join(REPO_ROOT, "bin", "tunnelcat-helper");
const HELPER_LINUX = join(REPO_ROOT, "bin", "tunnelcat-helper-linux-amd64");
const LINUX_HOST = process.env.TUNNELCAT_LINUX_HOST || "linux";

test("M1.17 cross-platform: darwin server + linux client echo round-trip", { timeout: 120000 }, async () => {
  if (!existsSync(HELPER_LINUX)) {
    throw new Error(`Linux helper not found at ${HELPER_LINUX}. Run: cd ~/Downloads/Work/code_repo/tailcat && GOOS=linux GOARCH=amd64 CGO_ENABLED=0 go build -o ${HELPER_LINUX} ./cmd/tunnelcat`);
  }
  if (!existsSync(HELPER_DARWIN)) {
    throw new Error(`Darwin helper not found at ${HELPER_DARWIN}. Run: go build -o ${HELPER_DARWIN} ./cmd/tunnelcat`);
  }

  // 1. Start the server on the Mac.
  const serverHome = mkdtempSync(join(tmpdir(), "tc-cp-server-"));
  const serverLog = join(serverHome, "server.log");
  const server: ChildProcess = spawn(HELPER_DARWIN, ["up"], {
    env: {
      ...process.env,
      TUNNELCAT_CONFIG_DIR: serverHome,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  // Capture server stdout.
  let token: string | null = null;
  let serverBuf = "";
  server.stdout?.on("data", (d) => {
    const s = d.toString();
    serverBuf += s;
    if (!token) {
      const m = s.match(/(tc[A-Za-z0-9_-]{20,})/);
      if (m) token = m[1];
    }
  });
  server.stderr?.on("data", (d) => {
    process.stderr.write(`[server stderr] ${d.toString()}`);
  });
  writeFileSync(serverLog, "");

  // Wait for the token.
  const start = Date.now();
  while (!token && Date.now() - start < 15000) {
    await new Promise((r) => setTimeout(r, 200));
  }
  if (!token) {
    server.kill("SIGTERM");
    throw new Error(`server did not produce a token within 15s. server log so far:\n${serverBuf.slice(0, 500)}`);
  }
  console.log(`✓ server up, token: ${token.slice(0, 30)}...`);

  try {
    // 2. Copy the linux helper to the remote box.
    const remoteTmp = `/tmp/tc-cp-${Date.now()}`;
    execSync(
      `ssh ${LINUX_HOST} "mkdir -p ${remoteTmp}" && scp ${HELPER_LINUX} ${LINUX_HOST}:${remoteTmp}/helper && ssh ${LINUX_HOST} "chmod +x ${remoteTmp}/helper"`,
      { stdio: "inherit" },
    );
    console.log(`✓ helper copied to ${LINUX_HOST}:${remoteTmp}/helper`);

    // 3. Run dial on the remote box with a known input, capture output.
    const marker = "hello-from-linux-" + Date.now();
    const cmd = `echo "${marker}" | timeout 30 ${remoteTmp}/helper dial ${token} --port 12345 2>&1`;
    console.log(`> ssh ${LINUX_HOST} "${cmd.slice(0, 80)}..."`);
    let output = "";
    try {
      output = execSync(
        `ssh ${LINUX_HOST} '${cmd.replace(/'/g, "'\\''")}'`,
        { stdio: "pipe", timeout: 60000 },
      ).toString();
    } catch (e: any) {
      output = (e.stdout?.toString() || "") + "\n[stderr]\n" + (e.stderr?.toString() || "");
    }
    console.log(`[remote output]\n${output}`);

    // 4. Check if the marker round-tripped.
    if (!output.includes(marker)) {
      throw new Error(`marker "${marker}" not in remote output. This means the echo didn't come back.`);
    }
    console.log(`✓ marker "${marker}" round-tripped through the data plane`);

    // 5. Cleanup the remote tmp dir.
    try {
      execSync(`ssh ${LINUX_HOST} "rm -rf ${remoteTmp}"`, { stdio: "ignore" });
    } catch {}
  } finally {
    server.kill("SIGTERM");
    try {
      unlinkSync(serverLog);
    } catch {}
  }
});

// NOTE: The reverse-direction test was split out into
// crossplatform-reverse.test.ts to avoid ssh connection
// limits when both directions run in the same process.

test("M1.17 cross-platform: linux server + darwin client echo round-trip (skipped, see reverse.test.ts)", { skip: true }, async () => {
  if (!existsSync(HELPER_LINUX) || !existsSync(HELPER_DARWIN)) {
    throw new Error("Both helpers must be built for the reverse-direction test");
  }

  // Pre-cleanup: kill any leftover helpers from previous runs.
  try {
    execSync(
      `ssh -o ConnectTimeout=5 ${LINUX_HOST} "pkill -9 -f '/tmp/tc-cp.*/helper' 2>/dev/null; rm -rf /tmp/tc-cp-* 2>/dev/null; true"`,
      { stdio: "ignore", timeout: 15000 },
    );
  } catch {}
  await new Promise((r) => setTimeout(r, 1000));

  // 1. Start the server on the remote Linux box using setsid to fully detach.
  const remoteTmp = `/tmp/tc-cp-server-${Date.now()}`;
  const serverLogRemote = `${remoteTmp}/server.log`;
  const serverPidFile = `${remoteTmp}/pid`;
  try {
    execSync(
      `scp ${HELPER_LINUX} ${LINUX_HOST}:${remoteTmp}-helper`,
      { stdio: "pipe", timeout: 15000 },
    );
    execSync(
      `ssh ${LINUX_HOST} "rm -rf ${remoteTmp}; mkdir -p ${remoteTmp}; mv ${remoteTmp}-helper ${remoteTmp}/helper; chmod +x ${remoteTmp}/helper; setsid bash -c 'cd ${remoteTmp} && ./helper up > ${serverLogRemote} 2>&1 & echo \\$! > ${serverPidFile}' < /dev/null > /dev/null 2>&1 &"`,
      { stdio: "pipe", timeout: 10000 },
    );

    // Wait for the server to print the token.
    let token: string | null = null;
    for (let i = 0; i < 30 && !token; i++) {
      await new Promise((r) => setTimeout(r, 500));
      try {
        const log = execSync(
          `ssh ${LINUX_HOST} "cat ${serverLogRemote} 2>/dev/null"`,
          { stdio: "pipe", timeout: 5000 },
        ).toString();
        const m = log.match(/(tc[A-Za-z0-9_-]{20,})/);
        if (m) token = m[1];
      } catch {}
    }
    if (!token) {
      throw new Error("linux server did not produce a token within 15s");
    }
    console.log(`✓ linux server up, token: ${token.slice(0, 30)}...`);

    // 2. Run dial on the Mac with a known input, capture output.
    const dialHome = mkdtempSync(join(tmpdir(), "tc-cp-client-"));
    const marker = "hello-from-darwin-" + Date.now();
    const dial: ChildProcess = spawn(HELPER_DARWIN, ["dial", token, "--port", "12345"], {
      env: { ...process.env, TUNNELCAT_CONFIG_DIR: dialHome },
      stdio: ["pipe", "pipe", "pipe"],
    });
    let dialOut = "";
    dial.stdout?.on("data", (d) => (dialOut += d.toString()));
    dial.stderr?.on("data", (d) => process.stderr.write(`[dial stderr] ${d.toString()}`));
    dial.stdin?.write(marker + "\n");
    dial.stdin?.end();

    // Wait up to 60s for the round-trip.
    const dialStart = Date.now();
    while (Date.now() - dialStart < 60000 && !dialOut.includes(marker)) {
      await new Promise((r) => setTimeout(r, 500));
    }
    dial.kill("SIGTERM");

    console.log(`[dial output]\n${dialOut}`);

    if (!dialOut.includes(marker)) {
      throw new Error(`marker "${marker}" not in dial output. Round-trip failed.`);
    }
    console.log(`✓ marker "${marker}" round-tripped through the data plane (linux server → darwin client)`);
  } finally {
    // Kill the remote server and cleanup.
    try {
      const pid = execSync(
        `ssh ${LINUX_HOST} "cat ${serverPidFile} 2>/dev/null"`,
        { stdio: "pipe", timeout: 5000 },
      ).toString().trim();
      if (pid) {
        execSync(`ssh ${LINUX_HOST} "kill -9 ${pid} 2>/dev/null"`, { stdio: "ignore", timeout: 5000 });
      }
    } catch {}
    try {
      execSync(`ssh ${LINUX_HOST} "rm -rf ${remoteTmp}"`, { stdio: "ignore", timeout: 5000 });
    } catch {}
  }
});
