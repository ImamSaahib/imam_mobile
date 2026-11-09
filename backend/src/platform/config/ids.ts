// Identifier rules (Contracts section 12.2, Decisions D5).

export const ID_PREFIX = {
  application: "app",
  menu: "mnu",
  module: "mod",
  page: "pge",
  component: "cmp",
  dataSource: "dsr",
  property: "prp",
  release: "rel"
} as const;

export type ItemType = keyof typeof ID_PREFIX;

export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Fixed ID for a seed item: derived from the application key, item type and stable seed key. Never from labels. */
export async function deriveSeedId(applicationKey: string, type: ItemType, seedKey: string): Promise<string> {
  const hash = await sha256Hex(`${applicationKey}:${type}:${seedKey}`);
  return `${ID_PREFIX[type]}_${hash.slice(0, 16)}`;
}

/** Random ID for an item created in configure mode. Same shape as seed IDs. */
export function newId(type: ItemType): string {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return `${ID_PREFIX[type]}_${[...bytes].map((b) => b.toString(16).padStart(2, "0")).join("")}`;
}

export const ID_PATTERN = /^[a-z]{3}_[0-9a-f]{16}$/;
