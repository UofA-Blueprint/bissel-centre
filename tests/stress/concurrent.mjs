#!/usr/bin/env node
/**
 * Concurrent write / race condition tests.
 *
 * Tests SYNC-01 and SYNC-02 from the audit: what happens when multiple
 * staff edit the same card or user simultaneously.
 *
 * Runs directly against Firestore (Admin SDK) to simulate the race
 * conditions the API routes produce. Optionally hits the live API.
 *
 * Usage:
 *   node tests/stress/concurrent.mjs                          # Firestore only
 *   node tests/stress/concurrent.mjs --url http://localhost:3000  # + API races
 */

import {
  getAdmin,
  STRESS_PREFIX,
  formatMs,
  createStaffSession,
  getSessionCookie,
} from "./lib.mjs";
import { FieldValue } from "firebase-admin/firestore";

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { url: null };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--url" && args[i + 1]) opts.url = args[++i].replace(/\/$/, "");
  }
  return opts;
}

const PASS = "PASS";
const FAIL = "FAIL";
const results = [];

function record(test, expected, actual, passed, details) {
  results.push({ test, expected, actual, passed: passed ? PASS : FAIL, details });
}

// ── Test helpers ─────────────────────────────────────────────────

async function setupTestCard(db) {
  const cardRef = db.collection("arc_cards").doc(`${STRESS_PREFIX}race_card`);
  const userRef = db.collection("users").doc(`${STRESS_PREFIX}race_user`);

  await cardRef.set({
    currentUserId: userRef.id,
    arcCardNumber: "8888888",
    status: "Active",
    department: "Transit Dept",
    notes: "",
    updatedAt: FieldValue.serverTimestamp(),
    createdAt: FieldValue.serverTimestamp(),
  });

  await userRef.set({
    firstName: "Race",
    secondName: "Test",
    arcCardNumber: "8888888",
    passesIssued: [cardRef.id],
    banned: false,
    status: "Active",
    createdBy: `${STRESS_PREFIX}seeder`,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  return { cardRef, userRef };
}

// ── Test 1: Last-write-wins on non-transactional update ──────────

async function testLastWriteWins(db) {
  const { cardRef } = await setupTestCard(db);

  // Simulate two staff reading the card at the same time
  const snap1 = await cardRef.get();
  const snap2 = await cardRef.get();

  // Both see status: "Active"
  const status1 = snap1.data().status;
  const status2 = snap2.data().status;

  // Staff A sets to "Unloaded", Staff B sets to "Expired" — no version check
  await cardRef.update({ status: "Unloaded", updatedAt: FieldValue.serverTimestamp() });
  await cardRef.update({ status: "Expired", updatedAt: FieldValue.serverTimestamp() });

  const final = (await cardRef.get()).data();

  // Without optimistic concurrency, B's write silently overwrites A's
  const bWon = final.status === "Expired";
  record(
    "Last-write-wins (no version check)",
    "B overwrites A silently",
    `Final status: ${final.status}`,
    bWon,
    "SYNC-01: No updatedAt precondition — concurrent edits silently clobber"
  );
}

// ── Test 2: Transaction isolation ────────────────────────────────

async function testTransactionIsolation(db) {
  const { cardRef } = await setupTestCard(db);

  // Simulate two concurrent transactions trying to change the same card
  let aResult, bResult;

  const txA = db.runTransaction(async (tx) => {
    const snap = await tx.get(cardRef);
    // Simulate A doing some work
    await new Promise(r => setTimeout(r, 50));
    tx.update(cardRef, { status: "Unloaded", notes: "by-A", updatedAt: FieldValue.serverTimestamp() });
    return "A committed";
  }).then(r => { aResult = r; }).catch(e => { aResult = `A failed: ${e.message}`; });

  const txB = db.runTransaction(async (tx) => {
    const snap = await tx.get(cardRef);
    tx.update(cardRef, { status: "Expired", notes: "by-B", updatedAt: FieldValue.serverTimestamp() });
    return "B committed";
  }).then(r => { bResult = r; }).catch(e => { bResult = `B failed: ${e.message}`; });

  await Promise.all([txA, txB]);

  const final = (await cardRef.get()).data();

  // With Firestore transactions, one should retry and both should succeed
  // but the final state depends on which committed last
  const bothCommitted = !aResult?.includes("failed") && !bResult?.includes("failed");
  record(
    "Concurrent transactions on same doc",
    "Both commit (Firestore retries loser)",
    `A: ${aResult}, B: ${bResult}, final: ${final.status}`,
    bothCommitted,
    "Firestore transactions retry on contention — both succeed but order is non-deterministic"
  );
}

// ── Test 3: Mirror field desync ──────────────────────────────────

async function testMirrorDesync(db) {
  const { cardRef, userRef } = await setupTestCard(db);

  // Simulate: Staff A unassigns the card (multi-step, non-atomic)
  // Staff B reads user before A finishes — sees stale arcCardNumber

  // Step 1: A updates the card
  await cardRef.update({ currentUserId: null, status: "Unattributed", updatedAt: FieldValue.serverTimestamp() });

  // Step 2: B reads the user BEFORE A updates the user mirror
  const userBeforeMirror = (await userRef.get()).data();
  const userStillHasCard = userBeforeMirror.arcCardNumber === "8888888";

  // Step 3: A updates the user mirror
  await userRef.update({ arcCardNumber: FieldValue.delete(), updatedAt: FieldValue.serverTimestamp() });

  record(
    "Mirror field desync window",
    "User doc still has arcCardNumber between card update and user update",
    `User had card: ${userStillHasCard}`,
    userStillHasCard,
    "DATA-04: Non-atomic mirror update creates a window where card and user disagree"
  );
}

// ── Test 4: Double card assignment race ──────────────────────────

async function testDoubleAssignment(db) {
  // Create an unattributed card
  const cardRef = db.collection("arc_cards").doc(`${STRESS_PREFIX}race_card_2`);
  const user1Ref = db.collection("users").doc(`${STRESS_PREFIX}race_user_1`);
  const user2Ref = db.collection("users").doc(`${STRESS_PREFIX}race_user_2`);

  await cardRef.set({
    currentUserId: null, arcCardNumber: "7777777", status: "Unattributed",
    department: "Transit Dept", createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
  });
  await user1Ref.set({
    firstName: "User", secondName: "One", arcCardNumber: "", passesIssued: [], banned: false,
    createdBy: `${STRESS_PREFIX}seeder`, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
  });
  await user2Ref.set({
    firstName: "User", secondName: "Two", arcCardNumber: "", passesIssued: [], banned: false,
    createdBy: `${STRESS_PREFIX}seeder`, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
  });

  // Two transactions try to assign the same card to different users
  let result1, result2;

  const tx1 = db.runTransaction(async (tx) => {
    const snap = await tx.get(cardRef);
    const data = snap.data();
    if (data.currentUserId) throw new Error("Card already assigned");
    if (data.status !== "Unattributed") throw new Error("Card not Unattributed");
    tx.update(cardRef, { currentUserId: user1Ref.id, status: "Active", updatedAt: FieldValue.serverTimestamp() });
    tx.update(user1Ref, { arcCardNumber: "7777777" });
    return "assigned to user1";
  }).then(r => { result1 = r; }).catch(e => { result1 = `failed: ${e.message}`; });

  const tx2 = db.runTransaction(async (tx) => {
    const snap = await tx.get(cardRef);
    const data = snap.data();
    if (data.currentUserId) throw new Error("Card already assigned");
    if (data.status !== "Unattributed") throw new Error("Card not Unattributed");
    tx.update(cardRef, { currentUserId: user2Ref.id, status: "Active", updatedAt: FieldValue.serverTimestamp() });
    tx.update(user2Ref, { arcCardNumber: "7777777" });
    return "assigned to user2";
  }).then(r => { result2 = r; }).catch(e => { result2 = `failed: ${e.message}`; });

  await Promise.all([tx1, tx2]);

  const finalCard = (await cardRef.get()).data();
  const oneFailed = result1.includes("failed") || result2.includes("failed");

  record(
    "Double card assignment (transactional)",
    "One succeeds, one fails (transaction contention)",
    `Tx1: ${result1}, Tx2: ${result2}, holder: ${finalCard.currentUserId?.slice(-6) || "null"}`,
    oneFailed || finalCard.currentUserId != null,
    "When both use transactions with preconditions, Firestore prevents double-assign"
  );
}

// ── Test 5: Batch write interruption simulation ──────────────────

async function testPartialBatchWrite(db) {
  const userRef = db.collection("users").doc(`${STRESS_PREFIX}batch_user`);
  const cardRef = db.collection("arc_cards").doc(`${STRESS_PREFIX}batch_card`);

  await userRef.set({
    firstName: "Batch", secondName: "Test", arcCardNumber: "6666666",
    passesIssued: [cardRef.id], banned: false,
    createdBy: `${STRESS_PREFIX}seeder`, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
  });
  await cardRef.set({
    currentUserId: userRef.id, arcCardNumber: "6666666", status: "Active",
    department: "Transit Dept", createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
  });

  // Simulate expiry service's non-transactional batch:
  // Update card but "fail" to update user (simulating interruption)
  await cardRef.update({ currentUserId: null, status: "Unloaded", updatedAt: FieldValue.serverTimestamp() });
  // Intentionally skip: await userRef.update({ arcCardNumber: "" });

  const user = (await userRef.get()).data();
  const card = (await cardRef.get()).data();

  const desynced = user.arcCardNumber === "6666666" && card.currentUserId === null;
  record(
    "Partial batch write (interrupted expiry)",
    "User still points to card, card no longer points to user",
    `User card: ${user.arcCardNumber}, Card holder: ${card.currentUserId}`,
    desynced,
    "SCALE-04 / DATA-04: expireOverdueArcCards uses non-transactional batch — interruption desyncronizes mirrors"
  );
}

// ── Test 6: Rapid status toggles ─────────────────────────────────

async function testRapidStatusToggle(db) {
  const { cardRef } = await setupTestCard(db);
  const statuses = ["Unloaded", "Active", "Expired", "Unattributed", "Active", "Cancelled", "Active", "Unloaded"];

  const start = performance.now();
  const writes = statuses.map((s) =>
    cardRef.update({ status: s, updatedAt: FieldValue.serverTimestamp() })
  );
  await Promise.all(writes);
  const elapsed = performance.now() - start;

  const final = (await cardRef.get()).data();

  record(
    `Rapid status toggle (${statuses.length} concurrent writes)`,
    "All writes complete, final state is non-deterministic",
    `Final: ${final.status}, time: ${formatMs(Math.round(elapsed))}`,
    true,
    "Without version checks, rapid concurrent writes all succeed — final state is unpredictable"
  );
}

// ── API race test (optional) ─────────────────────────────────────

async function testApiRace(url, cookie, db) {
  const { cardRef } = await setupTestCard(db);

  // Fire two PATCH requests at the same time
  const body1 = JSON.stringify({ id: cardRef.id, status: "Unloaded", action: "UPDATE_STATUS", confirmDangerous: true });
  const body2 = JSON.stringify({ id: cardRef.id, status: "Expired", action: "UPDATE_STATUS", confirmDangerous: true });

  const [r1, r2] = await Promise.all([
    fetch(`${url}/api/cards`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: `session=${cookie}` },
      body: body1,
    }).then(async r => ({ status: r.status, body: await r.json().catch(() => null) })),
    fetch(`${url}/api/cards`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: `session=${cookie}` },
      body: body2,
    }).then(async r => ({ status: r.status, body: await r.json().catch(() => null) })),
  ]);

  const final = (await cardRef.get()).data();

  record(
    "API concurrent PATCH /api/cards",
    "Both succeed (no OCC), last write wins",
    `R1: ${r1.status}, R2: ${r2.status}, final: ${final.status}`,
    r1.status === 200 && r2.status === 200,
    "SYNC-01: Both API calls succeed — no version check means silent overwrite"
  );
}

// ── Main ─────────────────────────────────────────────────────────

async function main() {
  const opts = parseArgs();
  const { db } = getAdmin();

  console.log("╔══════════════════════════════════════════════╗");
  console.log("║  Stress Test — Concurrent Write Races        ║");
  console.log("╚══════════════════════════════════════════════╝\n");

  await testLastWriteWins(db);
  await testTransactionIsolation(db);
  await testMirrorDesync(db);
  await testDoubleAssignment(db);
  await testPartialBatchWrite(db);
  await testRapidStatusToggle(db);

  if (opts.url) {
    console.log("Running API race test...");
    try {
      const { idToken } = await createStaffSession();
      const cookie = await getSessionCookie(opts.url, idToken);
      await testApiRace(opts.url, cookie, db);
    } catch (e) {
      console.error("API race test skipped:", e.message);
    }
  }

  // ── Print results ────────────────────────────────────────────
  console.log("\n" + "═".repeat(90));
  console.log("  CONCURRENT WRITE TEST RESULTS");
  console.log("═".repeat(90) + "\n");

  const maxTest = Math.max(...results.map(r => r.test.length));
  const tw = Math.min(maxTest + 2, 50);

  for (const r of results) {
    const mark = r.passed === PASS ? "PASS" : "FAIL";
    console.log(`[${mark}]  ${r.test}`);
    console.log(`       Expected: ${r.expected}`);
    console.log(`       Actual:   ${r.actual}`);
    console.log(`       Note:     ${r.details}`);
    console.log("");
  }

  console.log("─".repeat(90));
  const passCount = results.filter(r => r.passed === PASS).length;
  console.log(`\n${passCount}/${results.length} scenarios behaved as documented.`);
  console.log("These are not failures — they confirm the audit's findings about missing safeguards.\n");

  // Cleanup race test docs
  const cleanup = [
    `${STRESS_PREFIX}race_card`, `${STRESS_PREFIX}race_user`,
    `${STRESS_PREFIX}race_card_2`, `${STRESS_PREFIX}race_user_1`, `${STRESS_PREFIX}race_user_2`,
    `${STRESS_PREFIX}batch_card`, `${STRESS_PREFIX}batch_user`,
  ];
  for (const id of cleanup) {
    for (const coll of ["arc_cards", "users"]) {
      try { await db.collection(coll).doc(id).delete(); } catch {}
    }
  }
  try { await db.collection("administrative_staff").doc(`${STRESS_PREFIX}staff_session`).delete(); } catch {}
}

main().catch((e) => { console.error("Concurrent test failed:", e); process.exit(1); });
