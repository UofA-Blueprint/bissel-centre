#!/usr/bin/env node
/**
 * Remove all synthetic stress-test data from Firestore.
 *
 * Deletes every document whose ID starts with "__stress_" from all collections.
 *
 * Usage:
 *   node tests/stress/cleanup.mjs
 *   node tests/stress/cleanup.mjs --dry-run   # show what would be deleted
 */

import { getAdmin, STRESS_PREFIX } from "./lib.mjs";

const DRY_RUN = process.argv.includes("--dry-run");

async function cleanCollection(db, name) {
  const snap = await db.collection(name).get();
  const refs = snap.docs
    .filter((doc) => doc.id.startsWith(STRESS_PREFIX))
    .map((doc) => doc.ref);

  if (!DRY_RUN) {
    // Firestore caps batches at 500 ops — delete in chunks of 400.
    for (let i = 0; i < refs.length; i += 400) {
      const batch = db.batch();
      for (const ref of refs.slice(i, i + 400)) batch.delete(ref);
      await batch.commit();
    }
  }

  return refs.length;
}

async function cleanAuth(auth) {
  let count = 0;
  const list = await auth.listUsers(1000);
  for (const user of list.users) {
    if (user.uid.startsWith(STRESS_PREFIX) || user.email?.startsWith(STRESS_PREFIX)) {
      if (!DRY_RUN) await auth.deleteUser(user.uid);
      count++;
    }
  }
  return count;
}

async function main() {
  const { db, auth } = getAdmin();

  console.log(DRY_RUN
    ? "╔══════════════════════════════════════════════╗\n║  Cleanup — DRY RUN (no deletions)            ║\n╚══════════════════════════════════════════════╝"
    : "╔══════════════════════════════════════════════╗\n║  Cleanup — Removing Stress Test Data          ║\n╚══════════════════════════════════════════════╝"
  );
  console.log(`  Prefix: ${STRESS_PREFIX}*\n`);

  const collections = [
    "users", "user_photos", "arc_cards", "issues", "banned_users", "history",
    "questions", "administrative_staff", "it_admins", "app_settings",
  ];

  let totalDocs = 0;
  for (const name of collections) {
    const count = await cleanCollection(db, name);
    if (count > 0) {
      console.log(`  ${name}: ${count} docs ${DRY_RUN ? "would be deleted" : "deleted"}`);
      totalDocs += count;
    }
  }

  const authCount = await cleanAuth(auth);
  if (authCount > 0) {
    console.log(`  Auth users: ${authCount} ${DRY_RUN ? "would be deleted" : "deleted"}`);
  }

  if (totalDocs === 0 && authCount === 0) {
    console.log("  No stress test data found.");
  } else {
    console.log(`\n  Total: ${totalDocs} docs + ${authCount} auth users ${DRY_RUN ? "(dry run)" : "removed"}.`);
  }
}

main().catch((e) => { console.error("Cleanup failed:", e); process.exit(1); });
