// helper.ts — finds and spawns the bundled Go helper binary.
//
// The Go helper is the data plane: it speaks the tailcat wire
// protocol on stdout, reads commands on stdin. The TS CLI is
// a thin wrapper that calls into it.
//
// The binary is shipped as an npm optionalDep per-platform.
// At runtime, we look in node_modules/@scope/tunnelcat-helper-<plat>/bin/.
// If not found, fall back to PATH (dev mode: `go run` from source).

import { spawn, ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

function platformPackage(): string {
  const os = process.platform;
  const arch = process.arch;
  // node:process maps to npm-style os/arch. The helper package
  // names use the npm-style.
  const osMap: Record<string, string> = {
    darwin: "darwin",
    linux: "linux",
    win32: "win32",
  };
  const archMap: Record<string, string> = {
    x64: "x64",
    arm64: "arm64",
  };
  const o = osMap[os] || os;
  const a = archMap[arch] || arch;
  return `@scope/tunnelcat-helper-${o}-${a}`;
}

function findHelperBinary(): string {
  // 1. Look in the local bin/ (when the helper is in the
  //    same package as the dist/). __dirname is dist/;
  //    the helper is in ../bin/ (one level up from dist).
  //    The previous "..", ".." path was wrong: it went up TWO
  //    levels, ending up at the parent of the package
  //    (e.g. lib/node_modules/) instead of inside the package.
  const devPath = join(__dirname, "..", "bin", process.platform === "win32" ? "tunnelcat-helper.exe" : "tunnelcat-helper");
  if (existsSync(devPath)) return devPath;

  // 2. Look in node_modules (npm install: bundled per-platform optionalDep).
  //    The package layout is:
  //      <prefix>/node_modules/@scope/tunnelcat-helper-<plat>/bin/helper
  //    From dist/, that's ../../@scope/tunnelcat-helper-<plat>/bin/...
  const pkg = platformPackage();
  const candidates = [
    join(__dirname, "..", "..", pkg, "bin", process.platform === "win32" ? "tunnelcat-helper.exe" : "tunnelcat-helper"),
    join(__dirname, "..", "..", "..", pkg, "bin", process.platform === "win32" ? "tunnelcat-helper.exe" : "tunnelcat-helper"),
  ];
  for (const c of candidates) {
    if (existsSync(c)) return c;
  }

  // 3. Fall back to PATH (system install).
  return process.platform === "win32" ? "tunnelcat-helper.exe" : "tunnelcat-helper";
}

export type HelperHandle = {
  proc: ChildProcess;
  binaryPath: string;
};

export function startHelper(verb: string, extraArgs: string[] = []): HelperHandle {
  const binaryPath = findHelperBinary();
  const args = [verb, ...extraArgs];
  const proc = spawn(binaryPath, args, {
    stdio: ["pipe", "pipe", "pipe"],
    env: { ...process.env },
  });
  return { proc, binaryPath };
}
