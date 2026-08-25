import "server-only";

import type {
  DocumentData,
  DocumentReference,
  Firestore,
  SetOptions,
} from "firebase-admin/firestore";
import { FieldValue } from "firebase-admin/firestore";

// Structural stand-in for Transaction | WriteBatch — the union's overloaded
// .set() is not callable in TS, but both satisfy this shape.
interface IndexWriter {
  set(ref: DocumentReference, data: DocumentData, options: SetOptions): unknown;
}
import {
  buildIndexEntry,
  shardForUserId,
  shardDocId,
  SEARCH_INDEX_COLLECTION,
  SEARCH_INDEX_SHARDS,
} from "@/utils/nameSearch.mjs";

export interface SearchIndexEntry {
  n: string; // display name
  s: string[]; // folded search strings (name + aliases + compound variants)
  c: string[]; // double-metaphone codes
}

export type SearchIndexRow = SearchIndexEntry & { id: string };

export function searchIndexShardRef(db: Firestore, shard: number) {
  return db.collection(SEARCH_INDEX_COLLECTION).doc(shardDocId(shard));
}

/**
 * Add or refresh one user's index entry inside the SAME transaction/batch
 * that writes the user doc — the index is never rebuilt on a schedule, it is
 * co-written. (scripts/rebuild-search-index.mjs exists for bootstrap/repair.)
 */
export function upsertSearchIndexEntry(
  writer: IndexWriter,
  db: Firestore,
  userId: string,
  userData: {
    firstName?: string;
    secondName?: string;
    aliases?: string[];
    postalCode?: string | null;
  },
): void {
  const entry = buildIndexEntry(userData);
  const ref = searchIndexShardRef(db, shardForUserId(userId));
  writer.set(
    ref,
    { entries: { [userId]: entry }, updatedAt: FieldValue.serverTimestamp() },
    { merge: true },
  );
}

/** Remove a user's entry (call in the same batch that deletes the user). */
export function deleteSearchIndexEntry(
  writer: IndexWriter,
  db: Firestore,
  userId: string,
): void {
  const ref = searchIndexShardRef(db, shardForUserId(userId));
  writer.set(
    ref,
    {
      entries: { [userId]: FieldValue.delete() },
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
}

/** Read all shards and flatten to rows. ~SEARCH_INDEX_SHARDS doc reads. */
export async function loadSearchIndex(
  db: Firestore,
): Promise<SearchIndexRow[]> {
  const refs = Array.from({ length: SEARCH_INDEX_SHARDS }, (_, i) =>
    searchIndexShardRef(db, i),
  );
  const snaps = await db.getAll(...refs);
  const rows: SearchIndexRow[] = [];
  for (const snap of snaps) {
    if (!snap.exists) continue;
    const entries = (snap.data()?.entries ?? {}) as Record<
      string,
      SearchIndexEntry
    >;
    for (const [id, entry] of Object.entries(entries)) {
      if (entry && Array.isArray(entry.s)) {
        rows.push({ id, n: entry.n ?? "", s: entry.s, c: entry.c ?? [] });
      }
    }
  }
  return rows;
}
