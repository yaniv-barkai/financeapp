import { addTag, getTags } from "@/lib/firestore/tags";
import { ImportRow, Tag } from "@/lib/types";

const CARD_TAG_COLOR = "#3b82f6";

/**
 * Create missing tags by name and map `pendingTagNames` on import rows to tag IDs.
 * Returns updated rows + the refreshed tag list for the book.
 */
export async function resolvePendingTagNames(
  uid: string,
  bookId: string,
  rows: ImportRow[],
  existingTags: Tag[]
): Promise<{ rows: ImportRow[]; tags: Tag[] }> {
  const needed = new Set<string>();
  for (const row of rows) {
    for (const name of row.pendingTagNames ?? []) {
      const n = name.trim();
      if (n) needed.add(n);
    }
  }
  if (needed.size === 0) {
    return { rows, tags: existingTags };
  }

  const byName = new Map(
    existingTags.map((t) => [t.name.trim().toLowerCase(), t] as const)
  );

  let tags = existingTags;
  for (const name of needed) {
    const key = name.toLowerCase();
    if (byName.has(key)) continue;
    await addTag(uid, bookId, name, CARD_TAG_COLOR);
    tags = await getTags(uid, bookId);
    for (const t of tags) byName.set(t.name.trim().toLowerCase(), t);
  }

  const nextRows = rows.map((row) => {
    const names = row.pendingTagNames ?? [];
    if (names.length === 0) return row;
    const ids = names
      .map((n) => byName.get(n.trim().toLowerCase())?.id)
      .filter((id): id is string => !!id);
    const merged = [...new Set([...(row.tags ?? []), ...ids])];
    const { pendingTagNames: _, ...rest } = row;
    return { ...rest, tags: merged };
  });

  return { rows: nextRows, tags };
}
