// argv.ts — minimal argv parser for `tunnelcat <verb> [args]`.
// No deps. Handles `--flag=value` and `--flag value`.

export type ParsedArgs = {
  verb: string;
  flags: Record<string, string | boolean>;
  positional: string[];
};

export function parseArgs(argv: string[]): ParsedArgs {
  if (argv.length === 0) {
    return { verb: "", flags: {}, positional: [] };
  }
  const [verb, ...rest] = argv;
  const flags: Record<string, string | boolean> = {};
  const positional: string[] = [];

  let i = 0;
  while (i < rest.length) {
    const a = rest[i];
    if (a.startsWith("--")) {
      const eq = a.indexOf("=");
      if (eq !== -1) {
        const key = a.slice(2, eq);
        const value = a.slice(eq + 1);
        flags[key] = value;
        i++;
        continue;
      }
      const key = a.slice(2);
      // Lookahead: is the next arg a value or another flag?
      const next = rest[i + 1];
      if (next !== undefined && !next.startsWith("--")) {
        flags[key] = next;
        i += 2;
      } else {
        flags[key] = true;
        i++;
      }
    } else {
      positional.push(a);
      i++;
    }
  }
  return { verb, flags, positional };
}
