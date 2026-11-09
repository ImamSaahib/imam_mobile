/** Platform and configuration schema versions (Contracts section 12.4 and Architecture section 13). */
export const PLATFORM_VERSION = "0.1.0";
export const CONFIG_SCHEMA_VERSION = 1;

/** Compares dotted numeric versions. Returns negative, zero or positive like a comparator. */
export function compareVersions(a: string, b: string): number {
  const pa = a.split(".").map((n) => Number.parseInt(n, 10) || 0);
  const pb = b.split(".").map((n) => Number.parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}
