#!/usr/bin/env node
/**
 * Seed synthetic recipients + cards into Firestore for stress testing.
 *
 * Usage:
 *   node tests/stress/seed.mjs              # default: 50 users, 50 cards
 *   node tests/stress/seed.mjs --users 200 --cards 300
 *   node tests/stress/seed.mjs --users 10 --photo-kb 200   # 200 KB photos
 */

import {
  getAdmin,
  STRESS_PREFIX,
  generateUser,
  generateCard,
  generateFakePhoto,
  batchWrite,
  formatBytes,
} from "./lib.mjs";

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { users: 50, cards: 50, photoKb: 110 };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--users" && args[i + 1]) opts.users = parseInt(args[++i], 10);
    if (args[i] === "--cards" && args[i + 1]) opts.cards = parseInt(args[++i], 10);
    if (args[i] === "--photo-kb" && args[i + 1]) opts.photoKb = parseInt(args[++i], 10);
  }
  return opts;
}

async function main() {
  const opts = parseArgs();
  const { db } = getAdmin();

  console.log("╔══════════════════════════════════════════════╗");
  console.log("║  Stress Test — Seed Synthetic Data           ║");
  console.log("╚══════════════════════════════════════════════╝");
  console.log(`  Users:    ${opts.users}`);
  console.log(`  Cards:    ${opts.cards}`);
  console.log(`  Photo:    ~${opts.photoKb} KB each`);
  console.log("");

  const staffUid = `${STRESS_PREFIX}seeder`;

  // Ensure a staff doc exists for createdBy references
  await db.collection("administrative_staff").doc(staffUid).set({
    email: `${STRESS_PREFIX}seeder@test.local`,
    firstName: "Stress",
    lastName: "Seeder",
    isDeleted: false,
    onboardingStatus: "active",
    createdBy: "stress-test",
  });

  // ── Seed users ─────────────────────────────────────────────────
  console.log(`Seeding ${opts.users} users...`);
  const userItems = [];
  const userIds = [];

  for (let i = 0; i < opts.users; i++) {
    const ref = db.collection("users").doc(`${STRESS_PREFIX}user_${i}`);
    const data = generateUser(staffUid, i);
    if (opts.photoKb !== 110) {
      data.picture = generateFakePhoto(opts.photoKb * 1000);
    }
    userItems.push({ ref, data });
    userIds.push(ref.id);
  }

  const t0 = performance.now();
  await batchWrite(userItems);
  const userTime = performance.now() - t0;

  const sampleSize = Buffer.byteLength(JSON.stringify(userItems[0]?.data || {}), "utf8");
  console.log(`  Done in ${(userTime / 1000).toFixed(1)}s`);
  console.log(`  Sample doc size: ~${formatBytes(sampleSize)}`);
  console.log(`  Estimated total: ~${formatBytes(sampleSize * opts.users)}`);

  // ── Seed cards ─────────────────────────────────────────────────
  console.log(`\nSeeding ${opts.cards} cards...`);
  const cardItems = [];
  const cardIds = [];

  for (let i = 0; i < opts.cards; i++) {
    const ref = db.collection("arc_cards").doc(`${STRESS_PREFIX}card_${i}`);
    const data = generateCard(i);

    // Assign first N cards to users (1:1 while both have capacity)
    if (i < opts.users) {
      data.currentUserId = userIds[i];
      data.status = "Active";

      // Update user with card number
      await db.collection("users").doc(userIds[i]).update({
        arcCardNumber: data.arcCardNumber,
        passesIssued: [ref.id],
      });
    }

    cardItems.push({ ref, data });
    cardIds.push(ref.id);
  }

  const t1 = performance.now();
  await batchWrite(cardItems);
  const cardTime = performance.now() - t1;
  console.log(`  Done in ${(cardTime / 1000).toFixed(1)}s`);

  // ── Seed issues for assigned cards ─────────────────────────────
  const assignedCount = Math.min(opts.users, opts.cards);
  console.log(`\nSeeding ${assignedCount} issues (one per assigned card)...`);
  const issueItems = [];

  for (let i = 0; i < assignedCount; i++) {
    const ref = db.collection("issues").doc(`${STRESS_PREFIX}issue_${i}`);
    issueItems.push({
      ref,
      data: {
        cardId: cardIds[i],
        userId: userIds[i],
        issueDate: "2025-06-15",
        createdAt: new Date(),
        issuedBy: staffUid,
        notes: "",
        returnedAt: null,
      },
    });
  }

  await batchWrite(issueItems);
  console.log(`  Done.`);

  // ── Seed some history entries ──────────────────────────────────
  const histCount = Math.min(opts.users * 2, 200);
  console.log(`\nSeeding ${histCount} history entries...`);
  const histItems = [];
  const events = ["Issue Card", "Status Change", "Renew Card", "Ban", "Unban"];

  for (let i = 0; i < histCount; i++) {
    const ref = db.collection("history").doc(`${STRESS_PREFIX}hist_${i}`);
    histItems.push({
      ref,
      data: {
        date: new Date(),
        userId: userIds[i % opts.users],
        modifiedBy: staffUid,
        event: events[i % events.length],
        notes: `Stress test entry ${i}`,
      },
    });
  }

  await batchWrite(histItems);
  console.log(`  Done.`);

  // ── Summary ────────────────────────────────────────────────────
  console.log("\n──────────────────────────────────────────────");
  console.log("Seed complete.");
  console.log(`  ${opts.users} users  (${STRESS_PREFIX}user_0 .. ${STRESS_PREFIX}user_${opts.users - 1})`);
  console.log(`  ${opts.cards} cards  (${STRESS_PREFIX}card_0 .. ${STRESS_PREFIX}card_${opts.cards - 1})`);
  console.log(`  ${assignedCount} issues`);
  console.log(`  ${histCount} history entries`);
  console.log(`  Total write time: ${((userTime + cardTime) / 1000).toFixed(1)}s`);
  console.log(`\nTo clean up:  node tests/stress/cleanup.mjs`);
}

main().catch((e) => { console.error("Seed failed:", e); process.exit(1); });
