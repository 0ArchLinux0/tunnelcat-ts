// src/derpcheck.ts — TCP reachability check for DERP relay.
//
// M1.16: doctor check #5. Tries to connect to the DERP host
// on port 443 with a 5s timeout. Returns true on success.

import { createConnection } from "node:net";

export function checkDERP(host: string, timeoutMs = 5000): Promise<{ ok: boolean; err?: string }> {
  return new Promise((resolve) => {
    let done = false;
    const finish = (ok: boolean, err?: string) => {
      if (done) return;
      done = true;
      resolve({ ok, err });
    };
    const sock = createConnection({ host, port: 443 });
    const timer = setTimeout(() => {
      sock.destroy();
      finish(false, `timeout after ${timeoutMs}ms`);
    }, timeoutMs);
    sock.on("connect", () => {
      clearTimeout(timer);
      sock.end();
      finish(true);
    });
    sock.on("error", (e) => {
      clearTimeout(timer);
      finish(false, e.message);
    });
  });
}
