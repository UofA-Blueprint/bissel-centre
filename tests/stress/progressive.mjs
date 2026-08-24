#!/usr/bin/env node
/**
 * Progressive production scale test.
 *
 * Runs staged load against the live Firestore project, organized to stay
 * inside Firebase limits:
 *   - batches capped at 400 ops AND ~8 MB per commit (10 MiB request limit)
 *   - 250 ms pause between commits (write-rate ramp)
 *   - concurrent-writer stage uses bounded parallelism (default 12 writers)
 *
 * Stages (run one at a time — progressive by design):
 *   node tests/stress/progressive.mjs baseline
 *   node tests/stress/progressive.mjs s1         # +100 users, +250 cards
 *   node tests/stress/progressive.mjs s2         # concurrent multi-writer burst
 *   node tests/stress/progressive.mjs s3         # +2250 cards (~2500 total)
 *   node tests/stress/progressive.mjs cleanup    # delegate to cleanup.mjs
 *
 * Every synthetic doc ID is prefixed "__stress_" so cleanup.mjs removes it.
 */

import {
  getAdmin,
  STRESS_PREFIX,
  generateUser,
  generateUserPhoto,
  generateCard,
  formatBytes,
  formatMs,
} from "./lib.mjs";
import { FieldValue } from "firebase-admin/firestore";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── Byte-aware throttled batch writer ────────────────────────────
// Firestore commit limits: 500 ops/request, 10 MiB/request.
const MAX_OPS_PER_BATCH = 400;
const MAX_BYTES_PER_BATCH = 8 * 1024 * 1024;
const PAUSE_BETWEEN_COMMITS_MS = 250;

async function throttledBatchWrite(db, items, label) {
  let batch = db.batch();
  let ops = 0;
  let bytes = 0;
  let commits = 0;
  const t0 = performance.now();

  const commit = async () => {
    if (ops === 0) return;
    await batch.commit();
    commits++;
    batch = db.batch();
    ops = 0;
    bytes = 0;
    await sleep(PAUSE_BETWEEN_COMMITS_MS);
  };

  for (const { ref, data } of items) {
    const size = Buffer.byteLength(JSON.stringify(data), "utf8") + 256;
    if (ops >= MAX_OPS_PER_BATCH || bytes + size > MAX_BYTES_PER_BATCH) {
      await commit();
    }
    batch.set(ref, data);
    ops++;
    bytes += size;
  }
  await commit();

  const ms = performance.now() - t0;
  console.log(
    `  ${label}: ${items.length} docs in ${commits} commits, ${formatMs(Math.round(ms))}`,
  );
}

// ── Measurement (mirrors the app's actual query patterns) ────────

async function timeQuery(label, fn) {
  const t0 = performance.now();
  const result = await fn();
  const ms = Math.round(performance.now() - t0);
  return { label, ms, result };
}

async function measure(db) {
  const VERCEL_LIMIT = 4.5 * 1024 * 1024;

  // Counts via aggregates (cheap)
  const names = ["users", "user_photos", "arc_cards", "issues", "history", "banned_users"];
  const counts = {};
  for (const n of names) {
    counts[n] = (await db.collection(n).count().get()).data().count;
  }
  console.log(
    `  Counts: ${names.map((n) => `${n}=${counts[n]}`).join("  ")}`,
  );

  // The exact scans the endpoints perform, timed:
  const q1 = await timeQuery("/api/cards full scan (arc_cards + issues)", async () => {
    const [cards, issues] = await Promise.all([
      db.collection("arc_cards").get(),
      db.collection("issues").get(),
    ]);
    let bytes = 0;
    for (const d of cards.docs) bytes += Buffer.byteLength(JSON.stringify(d.data()), "utf8");
    for (const d of issues.docs) bytes += Buffer.byteLength(JSON.stringify(d.data()), "utf8");
    return { docs: cards.size + issues.size, bytes };
  });

  const q2 = await timeQuery("dashboard users scan (NEW: photoThumb)", async () => {
    const snap = await db
      .collection("users")
      .select("firstName", "secondName", "photoThumb", "banned", "status", "createdAt")
      .get();
    let bytes = 0;
    for (const d of snap.docs) bytes += Buffer.byteLength(JSON.stringify(d.data()), "utf8");
    return { docs: snap.size, bytes };
  });

  const q2legacy = await timeQuery("dashboard users scan (LEGACY: full picture)", async () => {
    const snap = await db
      .collection("users")
      .select("firstName", "secondName", "picture", "banned", "status", "createdAt")
      .get();
    let bytes = 0;
    for (const d of snap.docs) bytes += Buffer.byteLength(JSON.stringify(d.data()), "utf8");
    return { docs: snap.size, bytes };
  });

  const q3 = await timeQuery("card search (bounded, limit 7)", async () => {
    const snap = await db
      .collection("arc_cards")
      .where("currentUserId", "==", null)
      .where("status", "==", "Unattributed")
      .orderBy("arcCardNumber")
      .startAt("900")
      .endAt("900")
      .limit(7)
      .get();
    return { docs: snap.size, bytes: 0 };
  });

  console.log("\n  Query timing (the app's real access patterns):");
  for (const q of [q1, q2, q2legacy, q3]) {
    const pct = q.result.bytes
      ? ` — ${formatBytes(q.result.bytes)} (${((q.result.bytes / VERCEL_LIMIT) * 100).toFixed(0)}% of 4.5 MB cap${q.result.bytes > VERCEL_LIMIT ? " ⚠ OVER" : ""})`
      : "";
    console.log(`    ${q.label}: ${formatMs(q.ms)} · ${q.result.docs} docs${pct}`);
  }

  return { counts, cardsScan: q1, dashScan: q2, boundedSearch: q3 };
}

// ── Stage: baseline ──────────────────────────────────────────────

async function stageBaseline(db) {
  console.log("── Stage 0: Baseline ──\n");
  await measure(db);
}

// ── Stage 1: +100 users, +250 cards ──────────────────────────────

async function ensureSeederStaff(db) {
  const staffUid = `${STRESS_PREFIX}seeder`;
  await db.collection("administrative_staff").doc(staffUid).set({
    email: `${STRESS_PREFIX}seeder@test.local`,
    firstName: "Stress",
    lastName: "Seeder",
    isDeleted: false,
    onboardingStatus: "active",
    createdBy: "stress-test",
  });
  return staffUid;
}

async function stageS1(db) {
  console.log("── Stage 1: Seed +100 users, +250 cards ──\n");
  const staffUid = await ensureSeederStaff(db);

  const users = [];
  const photos = [];
  const cards = [];
  const issues = [];
  const history = [];

  for (let i = 0; i < 100; i++) {
    const uref = db.collection("users").doc(`${STRESS_PREFIX}user_${i}`);
    const u = generateUser(staffUid, i);
    users.push({ ref: uref, data: u, id: uref.id });
    // Full-res base64 lives in user_photos — same doc ID as the user.
    photos.push({
      ref: db.collection("user_photos").doc(uref.id),
      data: generateUserPhoto(110_000),
    });
  }
  for (let i = 0; i < 250; i++) {
    const cref = db.collection("arc_cards").doc(`${STRESS_PREFIX}card_${i}`);
    const c = generateCard(i);
    // Assign the first 100 cards 1:1 to the users, at generation time
    // (no follow-up per-doc updates — one write per doc total).
    if (i < 100) {
      c.currentUserId = users[i].id;
      c.status = "Active";
      users[i].data.arcCardNumber = c.arcCardNumber;
      users[i].data.passesIssued = [cref.id];
      issues.push({
        ref: db.collection("issues").doc(`${STRESS_PREFIX}issue_${i}`),
        data: {
          cardId: cref.id,
          userId: users[i].id,
          issueDate: "2025-06-15",
          createdAt: new Date(),
          issuedBy: staffUid,
          notes: "",
          returnedAt: null,
        },
      });
    }
    cards.push({ ref: cref, data: c });
  }
  const events = ["Issue Card", "Status Change", "Renew Card", "Ban", "Unban"];
  for (let i = 0; i < 200; i++) {
    history.push({
      ref: db.collection("history").doc(`${STRESS_PREFIX}hist_${i}`),
      data: {
        date: new Date(),
        userId: users[i % users.length].id,
        modifiedBy: staffUid,
        event: events[i % events.length],
        notes: `Stress test entry ${i}`,
      },
    });
  }

  await throttledBatchWrite(db, users.map(({ ref, data }) => ({ ref, data })), "users (3 KB thumbs)");
  await throttledBatchWrite(db, photos, "user_photos (110 KB full-res, byte-capped batches)");
  await throttledBatchWrite(db, cards, "arc_cards");
  await throttledBatchWrite(db, issues, "issues");
  await throttledBatchWrite(db, history, "history");

  console.log("");
  await measure(db);
}

// ── Stage 2: concurrent multi-writer burst ───────────────────────

function percentile(sorted, p) {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[Math.max(0, idx)];
}

function reportLatencies(name, arr) {
  const sorted = [...arr].sort((a, b) => a - b);
  console.log(
    `    ${name}: n=${arr.length} p50=${formatMs(percentile(sorted, 50))} p95=${formatMs(percentile(sorted, 95))} max=${formatMs(sorted[sorted.length - 1] ?? 0)}`,
  );
}

async function stageS2(db) {
  const WRITERS = 12; // matches realistic simultaneous staff count
  const ROUNDS = 2;
  console.log(`── Stage 2: Concurrent writers (${WRITERS} parallel staff, ${ROUNDS} rounds each) ──\n`);
  const staffUid = await ensureSeederStaff(db);

  const lat = { register: [], createCard: [], assignTx: [], statusTx: [] };
  let txConflicts = 0;

  const writer = async (w) => {
    for (let r = 0; r < ROUNDS; r++) {
      const tag = `w${w}_r${r}`;
      const userRef = db.collection("users").doc(`${STRESS_PREFIX}cc_user_${tag}`);
      const cardRef = db.collection("arc_cards").doc(`${STRESS_PREFIX}cc_card_${tag}`);
      const issueRef = db.collection("issues").doc(`${STRESS_PREFIX}cc_issue_${tag}`);

      // 1. Register recipient — mirrors the new API write: user doc (thumb)
      //    + user_photos doc (full-res base64) in one atomic batch.
      let t = performance.now();
      const regBatch = db.batch();
      regBatch.set(userRef, generateUser(staffUid, 1000 + w * 10 + r));
      regBatch.set(db.collection("user_photos").doc(userRef.id), generateUserPhoto(110_000));
      await regBatch.commit();
      lat.register.push(Math.round(performance.now() - t));

      // 2. Create card
      t = performance.now();
      const card = generateCard(1000 + w * 10 + r);
      await cardRef.set(card);
      lat.createCard.push(Math.round(performance.now() - t));

      // 3. Assign transaction (mirrors register-recipient tx shape)
      t = performance.now();
      try {
        await db.runTransaction(async (tx) => {
          const snap = await tx.get(cardRef);
          const d = snap.data() || {};
          if (d.currentUserId) throw new Error("already assigned");
          tx.update(cardRef, { currentUserId: userRef.id, status: "Active", updatedAt: FieldValue.serverTimestamp() });
          tx.update(userRef, { arcCardNumber: card.arcCardNumber, passesIssued: [cardRef.id], updatedAt: FieldValue.serverTimestamp() });
          tx.set(issueRef, { cardId: cardRef.id, userId: userRef.id, issueDate: "2025-08-24", createdAt: new Date(), issuedBy: staffUid, notes: "", returnedAt: null });
        });
      } catch { txConflicts++; }
      lat.assignTx.push(Math.round(performance.now() - t));

      // 4. Status-change transaction (mirrors PATCH /api/cards shape)
      t = performance.now();
      try {
        await db.runTransaction(async (tx) => {
          const snap = await tx.get(cardRef);
          if (!snap.exists) throw new Error("gone");
          const holder = snap.data().currentUserId ?? null;
          if (holder) {
            const openIssue = await tx.get(
              db.collection("issues").where("cardId", "==", cardRef.id).where("userId", "==", holder).where("returnedAt", "==", null).limit(1),
            );
            tx.update(userRef, { arcCardNumber: FieldValue.delete(), updatedAt: FieldValue.serverTimestamp() });
            if (!openIssue.empty) tx.update(openIssue.docs[0].ref, { returnedAt: FieldValue.serverTimestamp(), closedCardStatus: "Unloaded" });
          }
          tx.update(cardRef, { status: "Unloaded", currentUserId: null, updatedAt: FieldValue.serverTimestamp() });
        });
      } catch { txConflicts++; }
      lat.statusTx.push(Math.round(performance.now() - t));
    }
  };

  const t0 = performance.now();
  await Promise.all(Array.from({ length: WRITERS }, (_, w) => writer(w)));
  const wallMs = Math.round(performance.now() - t0);

  console.log(`  ${WRITERS} writers x ${ROUNDS} rounds x 4 ops = ${WRITERS * ROUNDS * 4} ops in ${formatMs(wallMs)} (unexpected tx failures: ${txConflicts})\n`);
  console.log("  Per-operation latency under concurrency:");
  reportLatencies("register recipient (user + 110 KB photo doc)", lat.register);
  reportLatencies("create card", lat.createCard);
  reportLatencies("assign transaction (3-doc)", lat.assignTx);
  reportLatencies("status transaction (query-in-tx)", lat.statusTx);

  // ── Contention: 8 writers race to assign the SAME card ─────────
  console.log("\n  Contention test: 8 concurrent assigns of one card (expect exactly 1 winner)");
  const hotCardRef = db.collection("arc_cards").doc(`${STRESS_PREFIX}cc_hotcard`);
  await hotCardRef.set(generateCard(9999));

  const results = await Promise.all(
    Array.from({ length: 8 }, (_, i) =>
      db
        .runTransaction(async (tx) => {
          const snap = await tx.get(hotCardRef);
          const d = snap.data() || {};
          if (d.currentUserId) throw new Error("already assigned");
          tx.update(hotCardRef, { currentUserId: `${STRESS_PREFIX}racer_${i}`, status: "Active", updatedAt: FieldValue.serverTimestamp() });
          return "won";
        })
        .then(() => ({ i, outcome: "won" }))
        .catch((e) => ({ i, outcome: e.message === "already assigned" ? "lost-clean" : `error: ${e.message}` })),
    ),
  );
  const winners = results.filter((r) => r.outcome === "won").length;
  const clean = results.filter((r) => r.outcome === "lost-clean").length;
  const other = results.filter((r) => r.outcome.startsWith("error")).length;
  console.log(`    winners=${winners} clean-rejections=${clean} unexpected-errors=${other} ${winners === 1 && other === 0 ? "✅" : "⚠ INVARIANT VIOLATED"}`);
}

// ── Stage 3: scale cards to ~2500 ────────────────────────────────

async function stageS3(db) {
  console.log("── Stage 3: Seed +2250 cards (→ ~2500 stress cards) ──\n");
  const cards = [];
  for (let i = 250; i < 2500; i++) {
    cards.push({
      ref: db.collection("arc_cards").doc(`${STRESS_PREFIX}card_${i}`),
      data: generateCard(i),
    });
  }
  await throttledBatchWrite(db, cards, "arc_cards");

  console.log("");
  const m = await measure(db);

  // Growth projection from measured per-card cost
  const cardCount = m.counts.arc_cards;
  const perCardBytes = m.cardsScan.result.bytes / Math.max(1, m.cardsScan.result.docs);
  const perCardMs = m.cardsScan.ms / Math.max(1, cardCount);
  const VERCEL_LIMIT = 4.5 * 1024 * 1024;
  console.log("\n  Projection for /api/cards (linear in collection size):");
  for (const n of [5000, 10000, 20000]) {
    const bytes = Math.round(perCardBytes * n * 1.6); // + issues growth factor
    const ms = Math.round(perCardMs * n);
    console.log(
      `    ${String(n).padEnd(6)} cards → ~${formatBytes(bytes)} payload (${((bytes / VERCEL_LIMIT) * 100).toFixed(0)}% of cap${bytes > VERCEL_LIMIT ? " ⚠ OVER" : ""}), ~${formatMs(ms)} scan`,
    );
  }
  console.log("    (bounded search stays flat at every size — compare its timing above)");
}

// ── Main ─────────────────────────────────────────────────────────

const STAGES = { baseline: stageBaseline, s1: stageS1, s2: stageS2, s3: stageS3 };

async function main() {
  const stage = process.argv[2];
  if (!STAGES[stage]) {
    console.error(`Usage: node tests/stress/progressive.mjs <${Object.keys(STAGES).join("|")}>`);
    console.error("Cleanup: node tests/stress/cleanup.mjs");
    process.exit(1);
  }
  const { db } = getAdmin();
  console.log("╔══════════════════════════════════════════════╗");
  console.log("║  Progressive Production Scale Test           ║");
  console.log("╚══════════════════════════════════════════════╝\n");
  await STAGES[stage](db);
  console.log("\nDone.");
}

main().catch((e) => { console.error("Stage failed:", e); process.exit(1); });
