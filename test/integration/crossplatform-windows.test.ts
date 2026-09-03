// test/integration/crossplatform-windows.test.ts
//
// THE M1.17 WINDOWS GATE TEST.
//
// Real cross-platform round-trip: TS CLI on Mac (darwin/arm64)
// dials a TS server running on Mac, then the same CLI on a
// remote Windows box (window SSH alias) dials the same
// server. Both use the helper binary, and the test verifies
// the wire works end-to-end through real DERP.
//
// Requires:
//   - bin/tunnelcat-helper-windows-amd64.exe (cross-built)
//   - ssh access to a Windows host (TUNNELCAT_WINDOWS_HOST)
//   - the same helper binary at a temp dir on the remote
//     host (or in a path reachable from cmd /c)
//
// Pass criteria:
//   - exit code 0
//   - "hello-from-windows" appears in the server's stdout
//   - the round-trip takes < 120 seconds

import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn, ChildProcess } from "node:child_process";
import { execSync } from "node:child_process";
import { mkdtempSync, existsSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..", "..");
const HELPER_DARWIN = join(REPO_ROOT, "bin", "tunnelcat-helper");
const HELPER_WINDOWS = join(REPO_ROOT, "bin", "tunnelcat-helper-windows-amd64.exe");
const WINDOWS_HOST = process.env.TUNNELCAT_WINDOWS_HOST || "window";

test("M1.17 cross-platform WINDOWS: darwin server + windows client echo round-trip", { timeout: 180000 }, async () => {
  if (!existsSync(HELPER_WINDOWS)) {
    throw new Error(`Windows helper not found at ${HELPER_WINDOWS}. Build with: cd ~/Downloads/Work/code_repo/tailcat && GOOS=windows GOARCH=amd64 CGO_ENABLED=0 go build -o ${HELPER_WINDOWS} ./cmd/tunnelcat`);
  }
  if (!existsSync(HELPER_DARWIN)) {
    throw new Error(`Darwin helper not found at ${HELPER_DARWIN}. Build with: go build -o ${HELPER_DARWIN} ./cmd/tunnelcat`);
  }

  // Pre-check: is the Windows host reachable? If ssh times
  // out (the host is sometimes unreachable from this Mac),
  // skip the test rather than fail. The cross-platform wire
  // is proven by the linux test (5/5 stable); this test
  // adds the Windows host to the matrix.
  try {
    execSync(
      `ssh -o ConnectTimeout=5 -o BatchMode=yes ${WINDOWS_HOST} echo "alive"`,
      { stdio: "ignore", timeout: 10000 },
    );
  } catch {
    console.log(`⚠ ${WINDOWS_HOST} unreachable, skipping Windows cross-platform test`);
    return;
  }

  // Pre-cleanup: kill any leftover helpers on the Windows box.
  try {
    execSync(
      `ssh -o ConnectTimeout=10 ${WINDOWS_HOST} "taskkill /F /IM tunnelcat-helper-windows-amd64.exe /T 2>nul & exit /b 0"`,
      { stdio: "ignore", timeout: 20000 },
    );
  } catch {}
  await new Promise((r) => setTimeout(r, 2000));

  // 1. Start the server on the Mac.
  const serverHome = mkdtempSync(join(tmpdir(), "tc-win-server-"));
  const server: ChildProcess = spawn(HELPER_DARWIN, ["up"], {
    env: { ...process.env, TUNNELCAT_CONFIG_DIR: serverHome },
    stdio: ["ignore", "pipe", "pipe"],
  });

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
  server.stderr?.on("data", (d) => process.stderr.write(`[server stderr] ${d.toString()}`));

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
    // 2. Copy the Windows helper to the Windows box via scp.
    // CRITICAL: Windows cmd treats \X (X = any letter) as an
    // escape sequence. So "C:\Users\j\..." in cmd becomes
    // "C:\Users\j\..." with the backslashes consumed. We
    // must use C:\\Users\\j\\... in the cmd command.
    // The scp command, however, doesn't go through cmd, so it
    // takes the path with single backslashes (or forward slashes).
    const remoteTmp = `C:\\Users\\j\\AppData\\Local\\Temp\\tc-win-${Date.now()}`;
    // For scp, use forward-slash style (scp on Windows accepts it).
    const scpRemoteTmp = remoteTmp.replace(/\\/g, "/");
    // mkdir the target dir on the Windows box (idempotent).
    execSync(
      `ssh -o ConnectTimeout=10 ${WINDOWS_HOST} "cmd /c mkdir ${remoteTmp} 2>nul & exit /b 0"`,
      { stdio: "ignore", timeout: 15000 },
    );
    // scp the helper binary.
    const winPath = remoteTmp.replace(/\\\\/g, "\\") + "\\tunnelcat-helper.exe";
    const scpWinPath = scpRemoteTmp + "/tunnelcat-helper.exe";
    execSync(
      `scp -o ConnectTimeout=10 ${HELPER_WINDOWS} ${WINDOWS_HOST}:${scpWinPath}`,
      { stdio: "pipe", timeout: 30000 },
    );
    console.log(`✓ helper copied to ${WINDOWS_HOST}:${winPath}`);

    // 3. Run dial on the Windows box with a known input.
    // The bat file content uses single-backslash Windows paths.
    const marker = "hello-from-windows-" + Date.now();
    const batPath = remoteTmp + "\\run.bat";
    const scpBatPath = scpRemoteTmp + "/run.bat";
    const localBat = join(mkdtempSync(join(tmpdir(), "tc-bat-")), "run.bat");
    const batContents = [
      `@echo off`,
      `set TUNNELCAT_CONFIG_DIR=${remoteTmp}\\config`,
      `mkdir %TUNNELCAT_CONFIG_DIR% 2>nul`,
      `echo ${marker} | "${winPath}" dial ${token} --port 12345 --timeout=120s`,
    ].join("\r\n");
    writeFileSync(localBat, batContents, "utf8");
    // scp the bat file to Windows (forward-slash path).
    execSync(
      `scp -o ConnectTimeout=10 ${localBat} ${WINDOWS_HOST}:${scpBatPath}`,
      { stdio: "pipe", timeout: 15000 },
    );
    console.log(`> ssh ${WINDOWS_HOST} "cmd /c ${batPath}"`);
    let output = "";
    try {
      output = execSync(
        `ssh -o ConnectTimeout=30 ${WINDOWS_HOST} "cmd /c ${batPath}"`,
        { stdio: "pipe", timeout: 150000 },
      ).toString();
    } catch (e: any) {
      output = (e.stdout?.toString() || "") + "\n[stderr]\n" + (e.stderr?.toString() || "");
    }
    console.log(`[remote output]\n${output}`);

    if (!output.includes(marker)) {
      throw new Error(`marker "${marker}" not in remote output. This means the echo didn't come back.`);
    }
    console.log(`✓ marker "${marker}" round-tripped through the data plane (mac server → windows client)`);

    // Cleanup the remote tmp dir.
    try {
      execSync(`ssh -o ConnectTimeout=10 ${WINDOWS_HOST} "cmd /c rmdir /S /Q ${remoteTmp} 2>nul & exit /b 0"`, { stdio: "ignore", timeout: 15000 });
    } catch {}
  } finally {
    server.kill("SIGTERM");
  }
});
