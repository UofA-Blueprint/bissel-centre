/**
 * Production Firestore Security Rules Tester
 *
 * Tests rules against the LIVE bissel-centre database using the Firebase
 * client SDK. Does not require Java or the emulator.
 *
 * It creates temporary test docs via Admin SDK, then tries to access them
 * from client SDK contexts with different auth states.
 *
 * Usage:
 *   node tests/firestore-rules-production.mjs
 */

import { initializeApp as initAdminApp, cert } from "firebase-admin/app";
import { getAuth as getAdminAuth } from "firebase-admin/auth";
import { getFirestore as getAdminFirestore, FieldValue } from "firebase-admin/firestore";
import { initializeApp, deleteApp } from "firebase/app";
import { getAuth, signInWithCustomToken, signOut } from "firebase/auth";
import {
  getFirestore,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  addDoc,
  collection,
  connectFirestoreEmulator,
} from "firebase/firestore";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, "..", ".env.local") });

// ── Config ───────────────────────────────────────────────────────

const FIREBASE_CONFIG = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "bissel-centre",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const SERVICE_ACCOUNT = {
  projectId: process.env.FIREBASE_PROJECT_ID || "bissel-centre",
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  privateKey: (process.env.FIREBASE_PRIVATE_KEY || "").replace(/\\n/g, "\n"),
};

// ── Initialize Admin SDK ─────────────────────────────────────────

const adminApp = initAdminApp({ credential: cert(SERVICE_ACCOUNT) });
const adminAuth = getAdminAuth(adminApp);
const adminDb = getAdminFirestore(adminApp);

// ── Test state ───────────────────────────────────────────────────

const PASS = "PASS";
const FAIL = "FAIL";
const ERROR = "ERROR";
const results = [];
let passed = 0;
let failed = 0;
let errors = 0;
const TEST_PREFIX = `__test_${Date.now()}_`;

function record(coll, role, operation, expected, actual, ok) {
  const status = ok ? PASS : FAIL;
  results.push({ collection: coll, role, operation, expected, actual, status });
  if (ok) passed++;
  else failed++;
}

function recordError(coll, role, operation, err) {
  results.push({
    collection: coll,
    role,
    operation,
    expected: "—",
    actual: `ERR: ${String(err.message || err).slice(0, 80)}`,
    status: ERROR,
  });
  errors++;
}

// ── Auth helpers ─────────────────────────────────────────────────

const TEST_ADMIN_UID = `${TEST_PREFIX}admin`;
const TEST_STAFF_UID = `${TEST_PREFIX}staff`;
const TEST_DEACTIVATED_UID = `${TEST_PREFIX}deactivated`;

async function createTestUsers() {
  console.log("Creating temporary test auth users...");

  // Create admin user with custom claim
  try { await adminAuth.deleteUser(TEST_ADMIN_UID); } catch {}
  await adminAuth.createUser({ uid: TEST_ADMIN_UID, email: `${TEST_PREFIX}admin@test.local` });
  await adminAuth.setCustomUserClaims(TEST_ADMIN_UID, { admin: true });

  // Create active staff user
  try { await adminAuth.deleteUser(TEST_STAFF_UID); } catch {}
  await adminAuth.createUser({ uid: TEST_STAFF_UID, email: `${TEST_PREFIX}staff@test.local` });

  // Create deactivated staff user
  try { await adminAuth.deleteUser(TEST_DEACTIVATED_UID); } catch {}
  await adminAuth.createUser({ uid: TEST_DEACTIVATED_UID, email: `${TEST_PREFIX}deactivated@test.local` });

  // Write staff docs
  await adminDb.collection("administrative_staff").doc(TEST_STAFF_UID).set({
    email: `${TEST_PREFIX}staff@test.local`,
    firstName: "Test",
    lastName: "Staff",
    isDeleted: false,
    onboardingStatus: "active",
    createdBy: TEST_ADMIN_UID,
    createdAt: FieldValue.serverTimestamp(),
  });

  await adminDb.collection("administrative_staff").doc(TEST_DEACTIVATED_UID).set({
    email: `${TEST_PREFIX}deactivated@test.local`,
    firstName: "Deactivated",
    lastName: "Staff",
    isDeleted: true,
    onboardingStatus: "active",
    createdBy: TEST_ADMIN_UID,
    createdAt: FieldValue.serverTimestamp(),
  });

  console.log("  Admin UID:", TEST_ADMIN_UID);
  console.log("  Staff UID:", TEST_STAFF_UID);
  console.log("  Deactivated UID:", TEST_DEACTIVATED_UID);
}

async function seedTestDocs() {
  console.log("Seeding test documents...");

  await adminDb.doc(`users/${TEST_PREFIX}user1`).set({
    firstName: "TestUser", secondName: "One", banned: false, createdBy: TEST_STAFF_UID,
  });
  await adminDb.doc(`arc_cards/${TEST_PREFIX}card1`).set({
    currentUserId: `${TEST_PREFIX}user1`, arcCardNumber: "0000001", status: "Active", department: "Transit Dept",
  });
  await adminDb.doc(`issues/${TEST_PREFIX}issue1`).set({
    cardId: `${TEST_PREFIX}card1`, userId: `${TEST_PREFIX}user1`, issuedBy: TEST_STAFF_UID, returnedAt: null,
  });
  await adminDb.doc(`banned_users/${TEST_PREFIX}ban1`).set({
    userId: `${TEST_PREFIX}user1`, banReason: "Test", bannedBy: TEST_STAFF_UID,
  });
  await adminDb.doc(`history/${TEST_PREFIX}hist1`).set({
    userId: `${TEST_PREFIX}user1`, modifiedBy: TEST_STAFF_UID, event: "Test",
  });
  await adminDb.doc(`questions/${TEST_PREFIX}q1`).set({
    userId: `${TEST_PREFIX}user1`, questions: ["Q"], answers: ["A"],
  });
  await adminDb.doc(`it_admins/${TEST_PREFIX}itadmin1`).set({
    uid: TEST_ADMIN_UID, firstName: "Test", lastName: "Admin", email: "admin@test.local",
  });
  await adminDb.doc(`it_admin/${TEST_PREFIX}itadmin1`).set({
    email: "admin@test.local", firstName: "Test", lastName: "Admin",
  });
  await adminDb.doc(`app_settings/${TEST_PREFIX}setting1`).set({
    enabled: true, dayOfMonth: 1, time24: "06:00",
  });
  await adminDb.doc(`_migrations/${TEST_PREFIX}mig1`).set({
    migratedAt: FieldValue.serverTimestamp(),
  });
}

async function cleanupTestData() {
  console.log("\nCleaning up test data...");
  const collections = [
    "users", "arc_cards", "issues", "banned_users", "history",
    "questions", "it_admins", "it_admin", "app_settings", "_migrations",
    "administrative_staff", "some_random_collection",
  ];
  for (const coll of collections) {
    const snap = await adminDb.collection(coll).where("__testDoc", "==", true).get();
    for (const d of snap.docs) await d.ref.delete();
    // Also clean by prefix
    try {
      const docRef = adminDb.doc(`${coll}/${TEST_PREFIX}user1`);
      const docSnap = await docRef.get();
      if (docSnap.exists) await docRef.delete();
    } catch {}
    try {
      const docRef = adminDb.doc(`${coll}/${TEST_PREFIX}card1`);
      const docSnap = await docRef.get();
      if (docSnap.exists) await docRef.delete();
    } catch {}
    try {
      const docRef = adminDb.doc(`${coll}/${TEST_PREFIX}issue1`);
      const docSnap = await docRef.get();
      if (docSnap.exists) await docRef.delete();
    } catch {}
    try {
      const docRef = adminDb.doc(`${coll}/${TEST_PREFIX}ban1`);
      const docSnap = await docRef.get();
      if (docSnap.exists) await docRef.delete();
    } catch {}
    try {
      const docRef = adminDb.doc(`${coll}/${TEST_PREFIX}hist1`);
      const docSnap = await docRef.get();
      if (docSnap.exists) await docRef.delete();
    } catch {}
    try {
      const docRef = adminDb.doc(`${coll}/${TEST_PREFIX}q1`);
      const docSnap = await docRef.get();
      if (docSnap.exists) await docRef.delete();
    } catch {}
    try {
      const docRef = adminDb.doc(`${coll}/${TEST_PREFIX}itadmin1`);
      const docSnap = await docRef.get();
      if (docSnap.exists) await docRef.delete();
    } catch {}
    try {
      const docRef = adminDb.doc(`${coll}/${TEST_PREFIX}setting1`);
      const docSnap = await docRef.get();
      if (docSnap.exists) await docRef.delete();
    } catch {}
    try {
      const docRef = adminDb.doc(`${coll}/${TEST_PREFIX}mig1`);
      const docSnap = await docRef.get();
      if (docSnap.exists) await docRef.delete();
    } catch {}
  }

  // Cleanup created test docs (from addDoc)
  for (const coll of collections) {
    const snap = await adminDb.collection(coll).get();
    for (const d of snap.docs) {
      if (d.id.startsWith(TEST_PREFIX)) {
        await d.ref.delete();
      }
    }
  }

  // Delete staff docs
  try { await adminDb.doc(`administrative_staff/${TEST_STAFF_UID}`).delete(); } catch {}
  try { await adminDb.doc(`administrative_staff/${TEST_DEACTIVATED_UID}`).delete(); } catch {}

  // Delete auth users
  try { await adminAuth.deleteUser(TEST_ADMIN_UID); } catch {}
  try { await adminAuth.deleteUser(TEST_STAFF_UID); } catch {}
  try { await adminAuth.deleteUser(TEST_DEACTIVATED_UID); } catch {}

  console.log("Cleanup done.");
}

// ── Client SDK helpers ───────────────────────────────────────────

async function getClientApp(uid) {
  const appName = `test-${uid || "anon"}-${Date.now()}`;
  const app = initializeApp(FIREBASE_CONFIG, appName);
  const auth = getAuth(app);

  if (uid) {
    const token = await adminAuth.createCustomToken(uid);
    await signInWithCustomToken(auth, token);
  }

  return { app, db: getFirestore(app), auth };
}

async function cleanupClient(client) {
  try { await signOut(client.auth); } catch {}
  try { await deleteApp(client.app); } catch {}
}

// ── Test execution ───────────────────────────────────────────────

async function testRead(collName, docId, roleName, uid, expectAllow) {
  let client;
  try {
    client = await getClientApp(uid);
    const ref = doc(client.db, collName, docId);
    const snap = await getDoc(ref);
    // If we got here without error, the read was allowed
    record(collName, roleName, "read", expectAllow ? "allow" : "deny", "allow", expectAllow);
  } catch (e) {
    const denied = e.code === "permission-denied" || e.message?.includes("Missing or insufficient permissions");
    if (denied) {
      record(collName, roleName, "read", expectAllow ? "allow" : "deny", "deny", !expectAllow);
    } else {
      recordError(collName, roleName, "read", e);
    }
  } finally {
    if (client) await cleanupClient(client);
  }
}

async function testCreate(collName, roleName, uid, data, expectAllow) {
  let client;
  const docId = `${TEST_PREFIX}create_${roleName}_${Date.now()}`;
  try {
    client = await getClientApp(uid);
    const ref = doc(client.db, collName, docId);
    await setDoc(ref, data);
    record(collName, roleName, "create", expectAllow ? "allow" : "deny", "allow", expectAllow);
    // Cleanup created doc
    try { await adminDb.doc(`${collName}/${docId}`).delete(); } catch {}
  } catch (e) {
    const denied = e.code === "permission-denied" || e.message?.includes("Missing or insufficient permissions");
    if (denied) {
      record(collName, roleName, "create", expectAllow ? "allow" : "deny", "deny", !expectAllow);
    } else {
      recordError(collName, roleName, "create", e);
    }
  } finally {
    if (client) await cleanupClient(client);
  }
}

async function testUpdate(collName, docId, roleName, uid, data, expectAllow) {
  let client;
  try {
    client = await getClientApp(uid);
    const ref = doc(client.db, collName, docId);
    await updateDoc(ref, data);
    record(collName, roleName, "update", expectAllow ? "allow" : "deny", "allow", expectAllow);
  } catch (e) {
    const denied = e.code === "permission-denied" || e.message?.includes("Missing or insufficient permissions");
    const notFound = e.code === "not-found";
    if (denied) {
      record(collName, roleName, "update", expectAllow ? "allow" : "deny", "deny", !expectAllow);
    } else if (notFound && !expectAllow) {
      // not-found can also mean permission denied (Firestore hides existence)
      record(collName, roleName, "update", "deny", "deny", true);
    } else {
      recordError(collName, roleName, "update", e);
    }
  } finally {
    if (client) await cleanupClient(client);
  }
}

async function testDelete(collName, docId, roleName, uid, expectAllow) {
  let client;
  try {
    client = await getClientApp(uid);
    const ref = doc(client.db, collName, docId);
    await deleteDoc(ref);
    record(collName, roleName, "delete", expectAllow ? "allow" : "deny", "allow", expectAllow);
    // Re-seed if we actually deleted
    if (expectAllow) await seedTestDocs();
  } catch (e) {
    const denied = e.code === "permission-denied" || e.message?.includes("Missing or insufficient permissions");
    if (denied) {
      record(collName, roleName, "delete", expectAllow ? "allow" : "deny", "deny", !expectAllow);
    } else {
      recordError(collName, roleName, "delete", e);
    }
  } finally {
    if (client) await cleanupClient(client);
  }
}

// ── Main ─────────────────────────────────────────────────────────

async function main() {
  console.log("╔══════════════════════════════════════════════════════════════╗");
  console.log("║  Firestore Security Rules — Production Test Suite           ║");
  console.log("║  Project: bissel-centre                                     ║");
  console.log("╚══════════════════════════════════════════════════════════════╝\n");

  await createTestUsers();
  await seedTestDocs();

  // Wait for auth claims to propagate
  console.log("Waiting for auth claims propagation...\n");
  await new Promise((r) => setTimeout(r, 2000));

  // Role definitions: [roleName, uid (null=unauth)]
  const roles = [
    ["admin", TEST_ADMIN_UID],
    ["staff", TEST_STAFF_UID],
    ["deactivated", TEST_DEACTIVATED_UID],
    ["unauth", null],
  ];

  const sampleData = {
    users: { firstName: "X", secondName: "Y", banned: false, createdBy: TEST_STAFF_UID },
    arc_cards: { currentUserId: null, arcCardNumber: "0000099", status: "Unloaded", department: "Transit Dept" },
    issues: { cardId: "c", userId: "u", issuedBy: TEST_STAFF_UID, returnedAt: null },
    banned_users: { userId: "u", banReason: "Test", bannedBy: TEST_STAFF_UID },
    history: { userId: "u", modifiedBy: TEST_STAFF_UID, event: "Test" },
    questions: { userId: "u", questions: ["Q"], answers: ["A"] },
    administrative_staff: { email: "x@x.com", firstName: "X", lastName: "Y" },
    it_admins: { uid: "x", firstName: "X", lastName: "Y", email: "x@x.com" },
    it_admin: { email: "x@x.com", firstName: "X", lastName: "Y" },
    app_settings: { enabled: false, dayOfMonth: 15, time24: "12:00" },
    _migrations: { note: "test" },
  };

  const docIds = {
    users: `${TEST_PREFIX}user1`,
    arc_cards: `${TEST_PREFIX}card1`,
    issues: `${TEST_PREFIX}issue1`,
    banned_users: `${TEST_PREFIX}ban1`,
    history: `${TEST_PREFIX}hist1`,
    questions: `${TEST_PREFIX}q1`,
    it_admins: `${TEST_PREFIX}itadmin1`,
    it_admin: `${TEST_PREFIX}itadmin1`,
    app_settings: `${TEST_PREFIX}setting1`,
    _migrations: `${TEST_PREFIX}mig1`,
  };

  // ── Permission matrix definition ────────────────────────────────
  // [collection, read, create, update, delete] per role
  // true = allowed, false = denied
  const matrix = {
    users: {
      admin:       { read: true,  create: false, update: false, delete: false },
      staff:       { read: true,  create: true,  update: true,  delete: true  },
      deactivated: { read: false, create: false, update: false, delete: false },
      unauth:      { read: false, create: false, update: false, delete: false },
    },
    arc_cards: {
      admin:       { read: true,  create: false, update: false, delete: false },
      staff:       { read: true,  create: true,  update: true,  delete: false },
      deactivated: { read: false, create: false, update: false, delete: false },
      unauth:      { read: false, create: false, update: false, delete: false },
    },
    issues: {
      admin:       { read: true,  create: false, update: false, delete: false },
      staff:       { read: true,  create: true,  update: true,  delete: false },
      deactivated: { read: false, create: false, update: false, delete: false },
      unauth:      { read: false, create: false, update: false, delete: false },
    },
    banned_users: {
      admin:       { read: true,  create: false, update: false, delete: false },
      staff:       { read: true,  create: true,  update: true,  delete: true  },
      deactivated: { read: false, create: false, update: false, delete: false },
      unauth:      { read: false, create: false, update: false, delete: false },
    },
    history: {
      admin:       { read: true,  create: false, update: false, delete: false },
      staff:       { read: true,  create: true,  update: false, delete: false },
      deactivated: { read: false, create: false, update: false, delete: false },
      unauth:      { read: false, create: false, update: false, delete: false },
    },
    questions: {
      admin:       { read: true,  create: false, update: false, delete: false },
      staff:       { read: true,  create: true,  update: true,  delete: true  },
      deactivated: { read: false, create: false, update: false, delete: false },
      unauth:      { read: false, create: false, update: false, delete: false },
    },
    it_admins: {
      admin:       { read: true,  create: false, update: false, delete: false },
      staff:       { read: false, create: false, update: false, delete: false },
      deactivated: { read: false, create: false, update: false, delete: false },
      unauth:      { read: false, create: false, update: false, delete: false },
    },
    it_admin: {
      admin:       { read: true,  create: false, update: false, delete: false },
      staff:       { read: false, create: false, update: false, delete: false },
      deactivated: { read: false, create: false, update: false, delete: false },
      unauth:      { read: false, create: false, update: false, delete: false },
    },
    app_settings: {
      admin:       { read: true,  create: false, update: false, delete: false },
      staff:       { read: true,  create: false, update: false, delete: false },
      deactivated: { read: false, create: false, update: false, delete: false },
      unauth:      { read: false, create: false, update: false, delete: false },
    },
    _migrations: {
      admin:       { read: false, create: false, update: false, delete: false },
      staff:       { read: false, create: false, update: false, delete: false },
      deactivated: { read: false, create: false, update: false, delete: false },
      unauth:      { read: false, create: false, update: false, delete: false },
    },
  };

  // ── Run all tests ──────────────────────────────────────────────

  const collections = Object.keys(matrix);
  const ops = ["read", "create", "update", "delete"];

  for (const coll of collections) {
    console.log(`Testing: ${coll}...`);

    for (const [roleName, uid] of roles) {
      const perms = matrix[coll][roleName];

      // READ
      await testRead(coll, docIds[coll] || `${TEST_PREFIX}doc`, roleName, uid, perms.read);

      // CREATE
      await testCreate(coll, roleName, uid, sampleData[coll] || { test: true }, perms.create);

      // UPDATE
      await testUpdate(coll, docIds[coll] || `${TEST_PREFIX}doc`, roleName, uid, { __updated: true }, perms.update);

      // DELETE
      await testDelete(coll, docIds[coll] || `${TEST_PREFIX}doc`, roleName, uid, perms.delete);

      // Re-seed after destructive tests
      if (perms.delete) await seedTestDocs();
    }
  }

  // ── Special: staff self-read vs cross-read on administrative_staff ──
  console.log("Testing: administrative_staff (self-read vs cross-read)...");

  // Staff reads own doc
  {
    let client;
    try {
      client = await getClientApp(TEST_STAFF_UID);
      const ref = doc(client.db, "administrative_staff", TEST_STAFF_UID);
      await getDoc(ref);
      record("admin_staff", "staff (self)", "read", "allow", "allow", true);
    } catch (e) {
      const denied = e.code === "permission-denied" || e.message?.includes("Missing or insufficient");
      if (denied) record("admin_staff", "staff (self)", "read", "allow", "deny", false);
      else recordError("admin_staff", "staff (self)", "read", e);
    } finally {
      if (client) await cleanupClient(client);
    }
  }

  // Staff reads other staff's doc
  {
    let client;
    try {
      client = await getClientApp(TEST_STAFF_UID);
      const ref = doc(client.db, "administrative_staff", TEST_DEACTIVATED_UID);
      await getDoc(ref);
      record("admin_staff", "staff (other)", "read", "deny", "allow", false);
    } catch (e) {
      const denied = e.code === "permission-denied" || e.message?.includes("Missing or insufficient");
      if (denied) record("admin_staff", "staff (other)", "read", "deny", "deny", true);
      else recordError("admin_staff", "staff (other)", "read", e);
    } finally {
      if (client) await cleanupClient(client);
    }
  }

  // ── Special: default-deny on unknown collection ────────────────
  console.log("Testing: unknown_collection (default deny)...");
  for (const [roleName, uid] of roles) {
    await testRead("some_random_collection", "doc1", roleName, uid, false);
    await testCreate("some_random_collection", roleName, uid, { foo: "bar" }, false);
  }

  // ── Cleanup ────────────────────────────────────────────────────
  await cleanupTestData();

  // ── Print results ──────────────────────────────────────────────
  console.log("\n");
  printResults();
  printMatrixGrids();

  // Write JSON for artifact
  const { writeFileSync } = await import("fs");
  const jsonPath = resolve(__dirname, "..", "test-results.json");
  writeFileSync(jsonPath, JSON.stringify({
    results,
    summary: { total: results.length, passed, failed, errors },
    timestamp: new Date().toISOString(),
  }, null, 2));
  console.log(`\nResults JSON: ${jsonPath}`);

  if (failed > 0 || errors > 0) process.exit(1);
}

function printResults() {
  console.log("╔══════════════════════════════════════════════════════════════════════════════════════════════╗");
  console.log("║  DETAILED RESULTS                                                                          ║");
  console.log("╚══════════════════════════════════════════════════════════════════════════════════════════════╝");

  const colW = { coll: 22, role: 18, op: 10, exp: 8, act: 8 };
  const header =
    "Collection".padEnd(colW.coll) +
    "Role".padEnd(colW.role) +
    "Operation".padEnd(colW.op) +
    "Expect".padEnd(colW.exp) +
    "Actual".padEnd(colW.act) +
    "Result";
  console.log(header);
  console.log("─".repeat(90));

  for (const r of results) {
    const mark = r.status === PASS ? "  PASS" : r.status === FAIL ? "  FAIL <<<" : "  ERR  <<<";
    console.log(
      r.collection.padEnd(colW.coll) +
      r.role.padEnd(colW.role) +
      r.operation.padEnd(colW.op) +
      r.expected.padEnd(colW.exp) +
      r.actual.padEnd(colW.act) +
      mark
    );
  }

  console.log("─".repeat(90));
  console.log(`\nTotal: ${results.length}  |  PASS: ${passed}  |  FAIL: ${failed}  |  ERROR: ${errors}\n`);
}

function printMatrixGrids() {
  const operations = ["read", "create", "update", "delete"];
  const collections = [
    "users", "arc_cards", "issues", "banned_users", "history",
    "questions", "administrative_staff", "it_admins", "it_admin",
    "app_settings", "_migrations", "admin_staff", "some_random_collection",
  ];
  const roleNames = ["admin", "staff", "staff (self)", "staff (other)", "deactivated", "unauth"];

  for (const op of operations) {
    console.log(`\n${"═".repeat(90)}`);
    console.log(`  MATRIX: ${op.toUpperCase()}`);
    console.log("═".repeat(90));

    const colW = 22;
    const roleW = 14;
    let hdr = "Collection".padEnd(colW);
    for (const r of roleNames) hdr += r.padEnd(roleW);
    console.log(hdr);
    console.log("─".repeat(colW + roleNames.length * roleW));

    for (const coll of collections) {
      let row = coll.slice(0, colW - 1).padEnd(colW);
      for (const role of roleNames) {
        const match = results.find(
          (r) => r.collection === coll && r.role === role && r.operation === op
        );
        if (!match) {
          row += "·".padEnd(roleW);
        } else if (match.status === PASS) {
          row += (match.expected === "allow" ? "ALLOW" : "DENY").padEnd(roleW);
        } else if (match.status === FAIL) {
          row += "FAIL!".padEnd(roleW);
        } else {
          row += "ERR!".padEnd(roleW);
        }
      }
      console.log(row);
    }
  }
}

main().catch(async (e) => {
  console.error("Fatal error:", e);
  try { await cleanupTestData(); } catch {}
  process.exit(2);
});
