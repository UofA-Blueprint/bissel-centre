/**
 * Comprehensive Firestore Security Rules Test Suite
 *
 * Tests every collection × role × operation combination against the
 * deny-by-default rules in firestore.rules.
 *
 * Run:
 *   npx firebase emulators:exec --only firestore "node --experimental-vm-modules tests/firestore-rules.test.mjs"
 *
 * Or start emulator separately:
 *   npx firebase emulators:start --only firestore
 *   FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 node tests/firestore-rules.test.mjs
 */

import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} from "@firebase/rules-unit-testing";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import {
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  addDoc,
  collection,
} from "firebase/firestore";

const __dirname = dirname(fileURLToPath(import.meta.url));
const RULES_PATH = resolve(__dirname, "..", "firestore.rules");

// ── Test infrastructure ──────────────────────────────────────────

const PASS = "PASS";
const FAIL = "FAIL";
const ERROR = "ERROR";

const results = [];
let testEnv;
let passed = 0;
let failed = 0;
let errors = 0;

function record(collection, role, operation, expected, actual, ok) {
  const status = ok ? PASS : FAIL;
  results.push({ collection, role, operation, expected, actual, status });
  if (ok) passed++;
  else failed++;
}

function recordError(collection, role, operation, error) {
  results.push({
    collection,
    role,
    operation,
    expected: "—",
    actual: `ERROR: ${error.message?.slice(0, 60)}`,
    status: ERROR,
  });
  errors++;
}

// ── Helpers ──────────────────────────────────────────────────────

function getFirestore(role) {
  switch (role) {
    case "admin":
      return testEnv.authenticatedContext("admin-uid-001", {
        admin: true,
      });
    case "staff":
      return testEnv.authenticatedContext("staff-uid-001");
    case "deactivated-staff":
      return testEnv.authenticatedContext("staff-uid-deactivated");
    case "unauth":
      return testEnv.unauthenticatedContext();
    default:
      throw new Error(`Unknown role: ${role}`);
  }
}

async function seedTestData() {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();

    // Active staff member
    await setDoc(doc(db, "administrative_staff", "staff-uid-001"), {
      email: "staff1@test.com",
      firstName: "Test",
      lastName: "Staff",
      isDeleted: false,
      onboardingStatus: "active",
      createdBy: "admin-uid-001",
    });

    // Deactivated staff member
    await setDoc(doc(db, "administrative_staff", "staff-uid-deactivated"), {
      email: "staff-deactivated@test.com",
      firstName: "Deactivated",
      lastName: "Staff",
      isDeleted: true,
      onboardingStatus: "active",
      createdBy: "admin-uid-001",
    });

    // Sample user (recipient)
    await setDoc(doc(db, "users", "user-001"), {
      firstName: "Alice",
      secondName: "Smith",
      banned: false,
      createdBy: "staff-uid-001",
    });

    // Sample ARC card
    await setDoc(doc(db, "arc_cards", "card-001"), {
      currentUserId: "user-001",
      arcCardNumber: "1234567",
      status: "Active",
      department: "Transit Dept",
    });

    // Sample issue
    await setDoc(doc(db, "issues", "issue-001"), {
      cardId: "card-001",
      userId: "user-001",
      issuedBy: "staff-uid-001",
      returnedAt: null,
    });

    // Sample banned user
    await setDoc(doc(db, "banned_users", "ban-001"), {
      userId: "user-001",
      banReason: "Test ban",
      bannedBy: "staff-uid-001",
    });

    // Sample history entry
    await setDoc(doc(db, "history", "hist-001"), {
      userId: "user-001",
      modifiedBy: "staff-uid-001",
      event: "Ban",
    });

    // Sample question
    await setDoc(doc(db, "questions", "q-001"), {
      userId: "user-001",
      questions: ["Q1"],
      answers: ["A1"],
    });

    // Sample IT admin
    await setDoc(doc(db, "it_admins", "admin-uid-001"), {
      uid: "admin-uid-001",
      firstName: "Admin",
      lastName: "User",
      email: "admin@test.com",
    });

    // Legacy IT admin collection
    await setDoc(doc(db, "it_admin", "admin-uid-001"), {
      email: "admin@test.com",
      firstName: "Admin",
      lastName: "User",
    });

    // App settings
    await setDoc(doc(db, "app_settings", "arc_card_monthly_unload"), {
      enabled: true,
      dayOfMonth: 1,
      time24: "06:00",
    });

    // Migration marker
    await setDoc(doc(db, "_migrations", "issues_v1"), {
      migratedAt: new Date(),
    });
  });
}

// ── Test runner ──────────────────────────────────────────────────

async function testReadDoc(collectionName, docId, role, expectedAllow) {
  try {
    const ctx = getFirestore(role);
    const ref = doc(ctx.firestore(), collectionName, docId);
    if (expectedAllow) {
      await assertSucceeds(getDoc(ref));
      record(collectionName, role, "read", "allow", "allow", true);
    } else {
      await assertFails(getDoc(ref));
      record(collectionName, role, "read", "deny", "deny", true);
    }
  } catch (e) {
    if (e.message?.includes("Expected request to")) {
      const actual = expectedAllow ? "deny" : "allow";
      record(collectionName, role, "read", expectedAllow ? "allow" : "deny", actual, false);
    } else {
      recordError(collectionName, role, "read", e);
    }
  }
}

async function testListDocs(collectionName, role, expectedAllow) {
  try {
    const ctx = getFirestore(role);
    const ref = collection(ctx.firestore(), collectionName);
    if (expectedAllow) {
      await assertSucceeds(getDocs(ref));
      record(collectionName, role, "list", "allow", "allow", true);
    } else {
      await assertFails(getDocs(ref));
      record(collectionName, role, "list", "deny", "deny", true);
    }
  } catch (e) {
    if (e.message?.includes("Expected request to")) {
      const actual = expectedAllow ? "deny" : "allow";
      record(collectionName, role, "list", expectedAllow ? "allow" : "deny", actual, false);
    } else {
      recordError(collectionName, role, "list", e);
    }
  }
}

async function testCreateDoc(collectionName, role, data, expectedAllow) {
  try {
    const ctx = getFirestore(role);
    const ref = doc(ctx.firestore(), collectionName, `test-create-${role}-${Date.now()}`);
    if (expectedAllow) {
      await assertSucceeds(setDoc(ref, data));
      record(collectionName, role, "create", "allow", "allow", true);
    } else {
      await assertFails(setDoc(ref, data));
      record(collectionName, role, "create", "deny", "deny", true);
    }
  } catch (e) {
    if (e.message?.includes("Expected request to")) {
      const actual = expectedAllow ? "deny" : "allow";
      record(collectionName, role, "create", expectedAllow ? "allow" : "deny", actual, false);
    } else {
      recordError(collectionName, role, "create", e);
    }
  }
}

async function testUpdateDoc(collectionName, docId, role, data, expectedAllow) {
  try {
    const ctx = getFirestore(role);
    const ref = doc(ctx.firestore(), collectionName, docId);
    if (expectedAllow) {
      await assertSucceeds(updateDoc(ref, data));
      record(collectionName, role, "update", "allow", "allow", true);
    } else {
      await assertFails(updateDoc(ref, data));
      record(collectionName, role, "update", "deny", "deny", true);
    }
  } catch (e) {
    if (e.message?.includes("Expected request to")) {
      const actual = expectedAllow ? "deny" : "allow";
      record(collectionName, role, "update", expectedAllow ? "allow" : "deny", actual, false);
    } else {
      recordError(collectionName, role, "update", e);
    }
  }
}

async function testDeleteDoc(collectionName, docId, role, expectedAllow) {
  try {
    const ctx = getFirestore(role);
    const ref = doc(ctx.firestore(), collectionName, docId);
    if (expectedAllow) {
      await assertSucceeds(deleteDoc(ref));
      record(collectionName, role, "delete", "allow", "allow", true);
    } else {
      await assertFails(deleteDoc(ref));
      record(collectionName, role, "delete", "deny", "deny", true);
    }
  } catch (e) {
    if (e.message?.includes("Expected request to")) {
      const actual = expectedAllow ? "deny" : "allow";
      record(collectionName, role, "delete", expectedAllow ? "allow" : "deny", actual, false);
    } else {
      recordError(collectionName, role, "delete", e);
    }
  }
}

// ── Special case: staff self-read on administrative_staff ────────

async function testStaffSelfRead() {
  try {
    const ctx = testEnv.authenticatedContext("staff-uid-001");
    const ref = doc(ctx.firestore(), "administrative_staff", "staff-uid-001");
    await assertSucceeds(getDoc(ref));
    record("administrative_staff", "staff (own doc)", "read", "allow", "allow", true);
  } catch (e) {
    if (e.message?.includes("Expected request to")) {
      record("administrative_staff", "staff (own doc)", "read", "allow", "deny", false);
    } else {
      recordError("administrative_staff", "staff (own doc)", "read", e);
    }
  }
}

async function testStaffCrossRead() {
  try {
    const ctx = testEnv.authenticatedContext("staff-uid-001");
    const ref = doc(ctx.firestore(), "administrative_staff", "staff-uid-deactivated");
    await assertFails(getDoc(ref));
    record("administrative_staff", "staff (other doc)", "read", "deny", "deny", true);
  } catch (e) {
    if (e.message?.includes("Expected request to")) {
      record("administrative_staff", "staff (other doc)", "read", "deny", "allow", false);
    } else {
      recordError("administrative_staff", "staff (other doc)", "read", e);
    }
  }
}

// ── Attribution-binding (anti-forgery) tests ─────────────────────
// Regression guard for the audit-log / attribution-forgery finding. The
// create rules for issues, banned_users, and history must bind the actor
// field (issuedBy / bannedBy / modifiedBy) to request.auth.uid, so an
// authenticated staffer cannot fabricate a record that names a COLLEAGUE as
// the actor (the admin per-staff dashboards count exactly these fields).
//
// Why the original matrix missed this: every create fixture self-attributes —
// sampleIssue.issuedBy / sampleBan.bannedBy / sampleHistory.modifiedBy are all
// "staff-uid-001", the same uid as the staff test context. So "can staff
// create?" passed while a spoofed actor was never exercised.
async function testAttributionCreate(collectionName, data, expectedAllow, label) {
  try {
    const ctx = getFirestore("staff");
    const ref = doc(
      ctx.firestore(),
      collectionName,
      `spoof-${label}-${Date.now()}`,
    );
    if (expectedAllow) {
      await assertSucceeds(setDoc(ref, data));
      record(collectionName, `staff (${label})`, "create", "allow", "allow", true);
    } else {
      await assertFails(setDoc(ref, data));
      record(collectionName, `staff (${label})`, "create", "deny", "deny", true);
    }
  } catch (e) {
    if (e.message?.includes("Expected request to")) {
      record(
        collectionName,
        `staff (${label})`,
        "create",
        expectedAllow ? "allow" : "deny",
        expectedAllow ? "deny" : "allow",
        false,
      );
    } else {
      recordError(collectionName, `staff (${label})`, "create", e);
    }
  }
}

// ── Main test execution ──────────────────────────────────────────

async function main() {
  console.log("=== Firestore Security Rules — Comprehensive Test Suite ===\n");

  const rules = readFileSync(RULES_PATH, "utf8");

  testEnv = await initializeTestEnvironment({
    projectId: "bissel-centre-test",
    firestore: { rules, host: "127.0.0.1", port: 8080 },
  });

  await seedTestData();
  console.log("Test data seeded.\n");

  const ROLES = ["admin", "staff", "deactivated-staff", "unauth"];
  const sampleUser = { firstName: "New", secondName: "User", banned: false, createdBy: "staff-uid-001" };
  const sampleCard = { currentUserId: null, arcCardNumber: "9999999", status: "Unloaded", department: "Transit Dept" };
  const sampleIssue = { cardId: "card-001", userId: "user-001", issuedBy: "staff-uid-001", returnedAt: null };
  const sampleBan = { userId: "user-001", banReason: "Test", bannedBy: "staff-uid-001" };
  const sampleHistory = { userId: "user-001", modifiedBy: "staff-uid-001", event: "Test" };
  const sampleQuestion = { userId: "user-001", questions: ["Q"], answers: ["A"] };

  // ────────────────────────────────────────────────────────────────
  // COLLECTION: users
  // ────────────────────────────────────────────────────────────────
  console.log("Testing: users...");
  for (const role of ROLES) {
    const canRead = role === "admin" || role === "staff";
    const canWrite = role === "staff";
    await testReadDoc("users", "user-001", role, canRead);
    await testListDocs("users", role, canRead);
    await testCreateDoc("users", role, sampleUser, canWrite);
    await testUpdateDoc("users", "user-001", role, { notes: "updated" }, canWrite);
    await testDeleteDoc("users", "user-001", role, canWrite);
  }

  // Re-seed user after staff delete test
  await seedTestData();

  // ────────────────────────────────────────────────────────────────
  // COLLECTION: arc_cards
  // ────────────────────────────────────────────────────────────────
  console.log("Testing: arc_cards...");
  for (const role of ROLES) {
    const canRead = role === "admin" || role === "staff";
    const canCreate = role === "staff";
    const canUpdate = role === "staff";
    await testReadDoc("arc_cards", "card-001", role, canRead);
    await testListDocs("arc_cards", role, canRead);
    await testCreateDoc("arc_cards", role, sampleCard, canCreate);
    await testUpdateDoc("arc_cards", "card-001", role, { notes: "x" }, canUpdate);
    await testDeleteDoc("arc_cards", "card-001", role, false); // delete always denied
  }

  // ────────────────────────────────────────────────────────────────
  // COLLECTION: issues
  // ────────────────────────────────────────────────────────────────
  console.log("Testing: issues...");
  for (const role of ROLES) {
    const canRead = role === "admin" || role === "staff";
    const canCreate = role === "staff";
    const canUpdate = role === "staff";
    await testReadDoc("issues", "issue-001", role, canRead);
    await testListDocs("issues", role, canRead);
    await testCreateDoc("issues", role, sampleIssue, canCreate);
    await testUpdateDoc("issues", "issue-001", role, { notes: "x" }, canUpdate);
    await testDeleteDoc("issues", "issue-001", role, false); // delete always denied
  }

  // ────────────────────────────────────────────────────────────────
  // COLLECTION: banned_users
  // ────────────────────────────────────────────────────────────────
  console.log("Testing: banned_users...");
  for (const role of ROLES) {
    const canRead = role === "admin" || role === "staff";
    const canWrite = role === "staff";
    await testReadDoc("banned_users", "ban-001", role, canRead);
    await testListDocs("banned_users", role, canRead);
    await testCreateDoc("banned_users", role, sampleBan, canWrite);
    await testUpdateDoc("banned_users", "ban-001", role, { notes: "x" }, canWrite);
    await testDeleteDoc("banned_users", "ban-001", role, canWrite);
  }
  await seedTestData();

  // ────────────────────────────────────────────────────────────────
  // COLLECTION: history (append-only)
  // ────────────────────────────────────────────────────────────────
  console.log("Testing: history...");
  for (const role of ROLES) {
    const canRead = role === "admin" || role === "staff";
    const canCreate = role === "staff";
    await testReadDoc("history", "hist-001", role, canRead);
    await testListDocs("history", role, canRead);
    await testCreateDoc("history", role, sampleHistory, canCreate);
    await testUpdateDoc("history", "hist-001", role, { notes: "x" }, false); // update always denied
    await testDeleteDoc("history", "hist-001", role, false); // delete always denied
  }

  // ────────────────────────────────────────────────────────────────
  // COLLECTION: questions
  // ────────────────────────────────────────────────────────────────
  console.log("Testing: questions...");
  for (const role of ROLES) {
    const canRead = role === "admin" || role === "staff";
    const canWrite = role === "staff";
    await testReadDoc("questions", "q-001", role, canRead);
    await testListDocs("questions", role, canRead);
    await testCreateDoc("questions", role, sampleQuestion, canWrite);
    await testUpdateDoc("questions", "q-001", role, { answers: ["B"] }, canWrite);
    await testDeleteDoc("questions", "q-001", role, canWrite);
  }
  await seedTestData();

  // ────────────────────────────────────────────────────────────────
  // COLLECTION: administrative_staff (special read rules, no writes)
  // ────────────────────────────────────────────────────────────────
  console.log("Testing: administrative_staff...");
  // Admin can read all
  await testReadDoc("administrative_staff", "staff-uid-001", "admin", true);
  await testListDocs("administrative_staff", "admin", true);
  // Staff can read own doc
  await testStaffSelfRead();
  // Staff cannot read other staff docs
  await testStaffCrossRead();
  // Staff cannot list all
  // (list requires read on all docs in collection, which staff doesn't have)
  // Deactivated and unauth cannot read
  await testReadDoc("administrative_staff", "staff-uid-001", "deactivated-staff", false);
  await testReadDoc("administrative_staff", "staff-uid-001", "unauth", false);
  // No client writes for anyone
  for (const role of ROLES) {
    await testCreateDoc("administrative_staff", role, { email: "x@x.com" }, false);
    await testUpdateDoc("administrative_staff", "staff-uid-001", role, { email: "y@y.com" }, false);
    await testDeleteDoc("administrative_staff", "staff-uid-001", role, false);
  }

  // ────────────────────────────────────────────────────────────────
  // COLLECTION: it_admins
  // ────────────────────────────────────────────────────────────────
  console.log("Testing: it_admins...");
  await testReadDoc("it_admins", "admin-uid-001", "admin", true);
  await testListDocs("it_admins", "admin", true);
  await testReadDoc("it_admins", "admin-uid-001", "staff", false);
  await testReadDoc("it_admins", "admin-uid-001", "deactivated-staff", false);
  await testReadDoc("it_admins", "admin-uid-001", "unauth", false);
  for (const role of ROLES) {
    await testCreateDoc("it_admins", role, { email: "x@x.com" }, false);
    await testUpdateDoc("it_admins", "admin-uid-001", role, { email: "y@y.com" }, false);
    await testDeleteDoc("it_admins", "admin-uid-001", role, false);
  }

  // ────────────────────────────────────────────────────────────────
  // COLLECTION: it_admin (legacy singular)
  // ────────────────────────────────────────────────────────────────
  console.log("Testing: it_admin (legacy)...");
  await testReadDoc("it_admin", "admin-uid-001", "admin", true);
  await testReadDoc("it_admin", "admin-uid-001", "staff", false);
  await testReadDoc("it_admin", "admin-uid-001", "unauth", false);
  for (const role of ROLES) {
    await testCreateDoc("it_admin", role, { email: "x@x.com" }, false);
  }

  // ────────────────────────────────────────────────────────────────
  // COLLECTION: app_settings
  // ────────────────────────────────────────────────────────────────
  console.log("Testing: app_settings...");
  for (const role of ROLES) {
    const canRead = role === "admin" || role === "staff";
    await testReadDoc("app_settings", "arc_card_monthly_unload", role, canRead);
    await testCreateDoc("app_settings", role, { enabled: false }, false); // no client writes
    await testUpdateDoc("app_settings", "arc_card_monthly_unload", role, { enabled: false }, false);
    await testDeleteDoc("app_settings", "arc_card_monthly_unload", role, false);
  }

  // ────────────────────────────────────────────────────────────────
  // COLLECTION: _migrations
  // ────────────────────────────────────────────────────────────────
  console.log("Testing: _migrations...");
  for (const role of ROLES) {
    await testReadDoc("_migrations", "issues_v1", role, false); // no client reads
    await testCreateDoc("_migrations", role, { migratedAt: new Date() }, false);
    await testUpdateDoc("_migrations", "issues_v1", role, { note: "x" }, false);
    await testDeleteDoc("_migrations", "issues_v1", role, false);
  }

  // ────────────────────────────────────────────────────────────────
  // WILDCARD: unknown collection (default deny)
  // ────────────────────────────────────────────────────────────────
  console.log("Testing: unknown_collection (default deny)...");
  for (const role of ROLES) {
    await testReadDoc("some_random_collection", "doc1", role, false);
    await testCreateDoc("some_random_collection", role, { foo: "bar" }, false);
  }

  // ────────────────────────────────────────────────────────────────
  // ATTRIBUTION BINDING: issues / banned_users / history (anti-forgery)
  // ────────────────────────────────────────────────────────────────
  console.log("Testing: attribution binding (anti-forgery)...");
  const SELF = "staff-uid-001"; // the staff test context uid
  const OTHER = "staff-uid-002"; // a colleague — must never be forgeable

  // issues.issuedBy
  await testAttributionCreate(
    "issues",
    { cardId: "card-001", userId: "user-001", issuedBy: SELF, returnedAt: null },
    true,
    "issuedBy=self",
  );
  await testAttributionCreate(
    "issues",
    { cardId: "card-001", userId: "user-001", issuedBy: OTHER, returnedAt: null },
    false,
    "issuedBy=colleague",
  );
  await testAttributionCreate(
    "issues",
    { cardId: "card-001", userId: "user-001", returnedAt: null },
    false,
    "issuedBy=missing",
  );

  // banned_users.bannedBy
  await testAttributionCreate(
    "banned_users",
    { userId: "user-001", banReason: "Test", bannedBy: SELF },
    true,
    "bannedBy=self",
  );
  await testAttributionCreate(
    "banned_users",
    { userId: "user-001", banReason: "Test", bannedBy: OTHER },
    false,
    "bannedBy=colleague",
  );
  await testAttributionCreate(
    "banned_users",
    { userId: "user-001", banReason: "Test" },
    false,
    "bannedBy=missing",
  );

  // history.modifiedBy (backdated/forged audit entry)
  await testAttributionCreate(
    "history",
    { userId: "user-001", event: "Ban", modifiedBy: SELF },
    true,
    "modifiedBy=self",
  );
  await testAttributionCreate(
    "history",
    { userId: "user-001", event: "Ban", modifiedBy: OTHER },
    false,
    "modifiedBy=colleague",
  );
  await testAttributionCreate(
    "history",
    { userId: "user-001", event: "Ban" },
    false,
    "modifiedBy=missing",
  );

  // ────────────────────────────────────────────────────────────────
  // Output results
  // ────────────────────────────────────────────────────────────────
  await testEnv.cleanup();

  console.log("\n");
  console.log("=".repeat(100));
  console.log("  RESULTS");
  console.log("=".repeat(100));
  console.log("");

  // Print detailed table
  const colW = { coll: 25, role: 22, op: 10, exp: 8, act: 8, status: 8 };
  const header =
    "Collection".padEnd(colW.coll) +
    "Role".padEnd(colW.role) +
    "Operation".padEnd(colW.op) +
    "Expected".padEnd(colW.exp) +
    "Actual".padEnd(colW.act) +
    "Status";
  console.log(header);
  console.log("-".repeat(100));

  for (const r of results) {
    const statusMark =
      r.status === PASS ? "PASS" : r.status === FAIL ? "FAIL <<<" : "ERR  <<<";
    console.log(
      r.collection.padEnd(colW.coll) +
        r.role.padEnd(colW.role) +
        r.operation.padEnd(colW.op) +
        r.expected.padEnd(colW.exp) +
        r.actual.padEnd(colW.act) +
        statusMark
    );
  }

  console.log("-".repeat(100));
  console.log(`\nTotal: ${results.length}  |  Passed: ${passed}  |  Failed: ${failed}  |  Errors: ${errors}`);
  console.log("");

  // ── Print matrix grids ─────────────────────────────────────────
  printMatrixGrids();

  // ── Output JSON for artifact ───────────────────────────────────
  const jsonPath = resolve(__dirname, "..", "test-results.json");
  const { writeFileSync } = await import("fs");
  writeFileSync(jsonPath, JSON.stringify({ results, summary: { total: results.length, passed, failed, errors } }, null, 2));
  console.log(`\nResults written to: ${jsonPath}`);

  if (failed > 0 || errors > 0) {
    process.exit(1);
  }
}

function printMatrixGrids() {
  console.log("\n");
  console.log("=".repeat(100));
  console.log("  PERMISSION MATRIX — READ ACCESS");
  console.log("=".repeat(100));
  printMatrix("read");

  console.log("\n");
  console.log("=".repeat(100));
  console.log("  PERMISSION MATRIX — CREATE ACCESS");
  console.log("=".repeat(100));
  printMatrix("create");

  console.log("\n");
  console.log("=".repeat(100));
  console.log("  PERMISSION MATRIX — UPDATE ACCESS");
  console.log("=".repeat(100));
  printMatrix("update");

  console.log("\n");
  console.log("=".repeat(100));
  console.log("  PERMISSION MATRIX — DELETE ACCESS");
  console.log("=".repeat(100));
  printMatrix("delete");
}

function printMatrix(operation) {
  const collections = [
    "users", "arc_cards", "issues", "banned_users", "history",
    "questions", "administrative_staff", "it_admins", "it_admin",
    "app_settings", "_migrations",
  ];
  const roles = ["admin", "staff", "staff (own doc)", "staff (other doc)", "deactivated-staff", "unauth"];

  const colW = 25;
  const roleW = 12;

  // Header
  let header = "Collection".padEnd(colW);
  for (const role of roles) {
    const shortRole = role.replace("deactivated-", "deact-").replace("staff (own doc)", "staff-self").replace("staff (other doc)", "staff-other");
    header += shortRole.padEnd(roleW);
  }
  console.log(header);
  console.log("-".repeat(colW + roles.length * roleW));

  for (const coll of collections) {
    let row = coll.padEnd(colW);
    for (const role of roles) {
      const match = results.find(
        (r) => r.collection === coll && r.role === role && r.operation === operation
      );
      if (!match) {
        row += "—".padEnd(roleW);
      } else if (match.status === PASS) {
        const symbol = match.expected === "allow" ? "ALLOW" : "DENY";
        row += symbol.padEnd(roleW);
      } else if (match.status === FAIL) {
        row += "FAIL!".padEnd(roleW);
      } else {
        row += "ERR!".padEnd(roleW);
      }
    }
    console.log(row);
  }
}

main().catch((e) => {
  console.error("Test suite failed to run:", e);
  process.exit(2);
});
