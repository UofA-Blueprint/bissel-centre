#!/usr/bin/env node
/**
 * Bootstrap/repair the sharded name-search index (search_index/users_N).
 *
 * The index is normally co-written transactionally by the API on every user
 * write; this script exists to create it initially and to repair drift
 * (e.g. writes that bypassed the API). Idempotent — full rebuild replaces
 * each shard, so stale entries for deleted users are dropped too.
 *
 * Usage: node scripts/rebuild-search-index.mjs
 */

import { getAdmin } from "../tests/stress/lib.mjs";
import {
  buildIndexEntry,
  shardForUserId,
  shardDocId,
  SEARCH_INDEX_COLLECTION,
  SEARCH_INDEX_SHARDS,
} from "../src/utils/nameSearch.mjs";

const { db } = getAdmin();

console.log("Rebuilding name-search index...\n");

const snap = await db
  .collection("users")
  .select("firstName", "secondName", "aliases", "postalCode")
  .get();

const shards = Array.from({ length: SEARCH_INDEX_SHARDS }, () => ({}));
for (const doc of snap.docs) {
  shards[shardForUserId(doc.id)][doc.id] = buildIndexEntry(doc.data());
}

let totalBytes = 0;
for (let i = 0; i < SEARCH_INDEX_SHARDS; i++) {
  const payload = { entries: shards[i], rebuiltAt: new Date() };
  const bytes = Buffer.byteLength(JSON.stringify(payload), "utf8");
  totalBytes += bytes;
  await db
    .collection(SEARCH_INDEX_COLLECTION)
    .doc(shardDocId(i))
    .set(payload); // full replace, not merge — drops stale entries
  console.log(
    `  ${shardDocId(i)}: ${Object.keys(shards[i]).length} entries, ${(bytes / 1024).toFixed(1)} KB`,
  );
}

console.log(
  `\nDone. ${snap.size} users indexed across ${SEARCH_INDEX_SHARDS} shards (${(totalBytes / 1024).toFixed(1)} KB total).`,
);
