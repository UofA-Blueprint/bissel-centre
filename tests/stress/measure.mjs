#!/usr/bin/env node
/**
 * Measure Firestore query sizes and (optionally) API endpoint responses.
 *
 * Runs two modes:
 *   1. Direct Firestore measurement (always) — no running app needed
 *   2. HTTP endpoint measurement — requires --url http://localhost:3000
 *
 * Usage:
 *   node tests/stress/measure.mjs                              # Firestore only
 *   node tests/stress/measure.mjs --url http://localhost:3000   # + API endpoints
 */

import {
  getAdmin,
  STRESS_PREFIX,
  formatBytes,
  formatMs,
  createStaffSession,
  getSessionCookie,
  measureEndpoint,
} from "./lib.mjs";

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { url: null };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--url" && args[i + 1]) opts.url = args[++i].replace(/\/$/, "");
  }
  return opts;
}

// ── Firestore direct measurements ────────────────────────────────

async function measureCollection(db, name) {
  const snap = await db.collection(name).get();
  let totalBytes = 0;
  let maxDocBytes = 0;
  let photoBytes = 0;

  for (const doc of snap.docs) {
    const json = JSON.stringify(doc.data());
    const bytes = Buffer.byteLength(json, "utf8");
    totalBytes += bytes;
    if (bytes > maxDocBytes) maxDocBytes = bytes;

    const picture = doc.data().picture;
    if (picture && typeof picture === "string") {
      photoBytes += Buffer.byteLength(picture, "utf8");
    }
  }

  return {
    collection: name,
    docCount: snap.size,
    totalBytes,
    maxDocBytes,
    avgDocBytes: snap.size ? Math.round(totalBytes / snap.size) : 0,
    photoBytes,
  };
}

async function simulateDashboardPayload(db) {
  // The dashboard endpoint selects: picture, firstName, secondName, banned, status, arcCardNumber, createdAt
  const snap = await db.collection("users").get();
  let payloadBytes = 0;
  for (const doc of snap.docs) {
    const d = doc.data();
    const subset = {
      id: doc.id,
      firstName: d.firstName || "",
      secondName: d.secondName || "",
      picture: d.picture || "",
      banned: d.banned || false,
      status: d.status || "Active",
      arcCardNumber: d.arcCardNumber || "",
    };
    payloadBytes += Buffer.byteLength(JSON.stringify(subset), "utf8");
  }
  return { docCount: snap.size, payloadBytes };
}

async function simulateReportsPayload(db) {
  // Reports reads: users + arc_cards + issues + banned_users + history (full)
  const [users, cards, issues, banned, history] = await Promise.all([
    db.collection("users").get(),
    db.collection("arc_cards").get(),
    db.collection("issues").get(),
    db.collection("banned_users").get(),
    db.collection("history").get(),
  ]);

  const measure = (snap) => {
    let total = 0;
    for (const doc of snap.docs) total += Buffer.byteLength(JSON.stringify(doc.data()), "utf8");
    return total;
  };

  return {
    users: { count: users.size, bytes: measure(users) },
    cards: { count: cards.size, bytes: measure(cards) },
    issues: { count: issues.size, bytes: measure(issues) },
    banned: { count: banned.size, bytes: measure(banned) },
    history: { count: history.size, bytes: measure(history) },
    totalBytes: measure(users) + measure(cards) + measure(issues) + measure(banned) + measure(history),
  };
}

async function simulateCardsPayload(db) {
  const [cardsSnap, issuesSnap] = await Promise.all([
    db.collection("arc_cards").get(),
    db.collection("issues").get(),
  ]);

  let cardsBytes = 0;
  for (const doc of cardsSnap.docs) cardsBytes += Buffer.byteLength(JSON.stringify(doc.data()), "utf8");
  let issuesBytes = 0;
  for (const doc of issuesSnap.docs) issuesBytes += Buffer.byteLength(JSON.stringify(doc.data()), "utf8");

  return {
    cards: cardsSnap.size,
    issues: issuesSnap.size,
    cardsBytes,
    issuesBytes,
    totalBytes: cardsBytes + issuesBytes,
  };
}

// ── Main ─────────────────────────────────────────────────────────

async function main() {
  const opts = parseArgs();
  const { db } = getAdmin();

  console.log("╔══════════════════════════════════════════════╗");
  console.log("║  Stress Test — Measure Payloads & Latency    ║");
  console.log("╚══════════════════════════════════════════════╝\n");

  // ── Part 1: Direct Firestore measurements ──────────────────────
  console.log("── Part 1: Firestore Collection Sizes ──\n");

  const collections = ["users", "arc_cards", "issues", "banned_users", "history", "questions", "administrative_staff"];
  const results = [];

  for (const name of collections) {
    const r = await measureCollection(db, name);
    results.push(r);
  }

  // Table header
  const col = { n: 24, cnt: 8, total: 14, avg: 12, max: 12, photo: 14 };
  console.log(
    "Collection".padEnd(col.n) +
    "Docs".padEnd(col.cnt) +
    "Total Size".padEnd(col.total) +
    "Avg Doc".padEnd(col.avg) +
    "Max Doc".padEnd(col.max) +
    "Photo Data"
  );
  console.log("─".repeat(84));

  for (const r of results) {
    console.log(
      r.collection.padEnd(col.n) +
      String(r.docCount).padEnd(col.cnt) +
      formatBytes(r.totalBytes).padEnd(col.total) +
      formatBytes(r.avgDocBytes).padEnd(col.avg) +
      formatBytes(r.maxDocBytes).padEnd(col.max) +
      (r.photoBytes ? formatBytes(r.photoBytes) : "—")
    );
  }

  // ── Part 2: Simulated endpoint payloads ────────────────────────
  console.log("\n── Part 2: Simulated API Payload Sizes ──\n");

  const VERCEL_LIMIT = 4.5 * 1024 * 1024;

  console.log("Dashboard (/api/dashboard/summary):");
  const dash = await simulateDashboardPayload(db);
  const dashPct = ((dash.payloadBytes / VERCEL_LIMIT) * 100).toFixed(1);
  console.log(`  ${dash.docCount} recipients → ${formatBytes(dash.payloadBytes)} (${dashPct}% of 4.5 MB Vercel limit)`);
  if (dash.payloadBytes > VERCEL_LIMIT) {
    console.log(`  ⚠ EXCEEDS Vercel serverless response cap!`);
  } else {
    const headroom = VERCEL_LIMIT - dash.payloadBytes;
    const perUser = dash.docCount ? dash.payloadBytes / dash.docCount : 110_000;
    const usersUntilCap = Math.floor(headroom / perUser);
    console.log(`  Headroom: ${formatBytes(headroom)} → ~${usersUntilCap} more recipients until cap`);
  }

  console.log("\nReports (/api/reports/data):");
  const rep = await simulateReportsPayload(db);
  const repPct = ((rep.totalBytes / VERCEL_LIMIT) * 100).toFixed(1);
  console.log(`  users: ${rep.users.count} (${formatBytes(rep.users.bytes)})`);
  console.log(`  cards: ${rep.cards.count} (${formatBytes(rep.cards.bytes)})`);
  console.log(`  issues: ${rep.issues.count} (${formatBytes(rep.issues.bytes)})`);
  console.log(`  banned: ${rep.banned.count} (${formatBytes(rep.banned.bytes)})`);
  console.log(`  history: ${rep.history.count} (${formatBytes(rep.history.bytes)})`);
  console.log(`  Memory footprint: ${formatBytes(rep.totalBytes)} (${repPct}% of 4.5 MB limit)`);
  if (rep.totalBytes > VERCEL_LIMIT) {
    console.log(`  ⚠ EXCEEDS Vercel serverless response cap!`);
  }

  console.log("\nCards (/api/cards):");
  const cards = await simulateCardsPayload(db);
  console.log(`  ${cards.cards} cards (${formatBytes(cards.cardsBytes)}) + ${cards.issues} issues (${formatBytes(cards.issuesBytes)})`);
  console.log(`  Total in-memory: ${formatBytes(cards.totalBytes)}`);

  // ── Part 3: Projections ────────────────────────────────────────
  console.log("\n── Part 3: Scale Projections ──\n");

  const userTotal = results.find(r => r.collection === "users");
  const avgUserBytes = userTotal?.avgDocBytes || 110_000;

  const projections = [50, 100, 200, 500, 1000, 2000, 5000];
  console.log(
    "Recipients".padEnd(14) +
    "Dashboard".padEnd(16) +
    "Reports (mem)".padEnd(18) +
    "Status"
  );
  console.log("─".repeat(62));

  for (const n of projections) {
    const dashPayload = n * avgUserBytes;
    const reportsPayload = dashPayload * 1.15; // ~15% overhead from cards+issues+history
    const dashOk = dashPayload < VERCEL_LIMIT;
    const repOk = reportsPayload < 256 * 1024 * 1024; // 256 MB function memory
    const status =
      !dashOk ? "⚠ Dashboard response cap exceeded" :
      !repOk ? "⚠ Reports function OOM likely" :
      "OK";
    console.log(
      String(n).padEnd(14) +
      formatBytes(dashPayload).padEnd(16) +
      formatBytes(reportsPayload).padEnd(18) +
      status
    );
  }

  // ── Part 4: Live endpoint testing (optional) ───────────────────
  if (opts.url) {
    console.log(`\n── Part 4: Live API Endpoint Measurement ──`);
    console.log(`  Base URL: ${opts.url}\n`);

    let cookie;
    try {
      console.log("  Creating staff session...");
      const { idToken } = await createStaffSession();
      cookie = await getSessionCookie(opts.url, idToken);
      console.log("  Session cookie obtained.\n");
    } catch (e) {
      console.error("  Failed to create session:", e.message);
      console.log("  Skipping live endpoint tests.\n");
      return;
    }

    const endpoints = [
      { name: "Dashboard", path: "/api/dashboard/summary" },
      { name: "Cards", path: "/api/cards" },
      { name: "Reports", path: "/api/reports/data" },
      { name: "Card Search", path: "/api/cards/search?q=900" },
    ];

    console.log(
      "Endpoint".padEnd(20) +
      "Status".padEnd(8) +
      "Time".padEnd(12) +
      "Size".padEnd(14) +
      "vs Limit"
    );
    console.log("─".repeat(68));

    for (const ep of endpoints) {
      try {
        const r = await measureEndpoint(`${opts.url}${ep.path}`, cookie);
        const pct = ((r.bytes / VERCEL_LIMIT) * 100).toFixed(1);
        const warn = r.bytes > VERCEL_LIMIT ? " ⚠ OVER" : "";
        console.log(
          ep.name.padEnd(20) +
          String(r.status).padEnd(8) +
          formatMs(r.ms).padEnd(12) +
          formatBytes(r.bytes).padEnd(14) +
          `${pct}%${warn}`
        );
      } catch (e) {
        console.log(
          ep.name.padEnd(20) +
          "ERR".padEnd(8) +
          "—".padEnd(12) +
          "—".padEnd(14) +
          e.message.slice(0, 30)
        );
      }
    }
  } else {
    console.log("\n  Tip: pass --url http://localhost:3000 to also test live API endpoints.");
  }

  console.log("\nDone.");
}

main().catch((e) => { console.error("Measure failed:", e); process.exit(1); });
