// Usage: node scripts/checkOrCreateAdmin.cjs
// Optional env: SERVICE_ACCOUNT_PATH, NEW_ADMIN_EMAIL, NEW_ADMIN_FIRST, NEW_ADMIN_LAST
// IMPORTANT: put IT_ID_HASH_PEPPER in your .env.local (or environment)

const admin = require("firebase-admin");
const { readFileSync } = require("fs");
const path = require("path");
const { randomBytes, createHash } = require("crypto");

// 0) Load .env.local so IT_ID_HASH_PEPPER is available to the script
require("dotenv").config({ path: path.join(process.cwd(), ".env.local") });

// 1) init firebase-admin from service account json
const serviceKeyPath =
  process.env.SERVICE_ACCOUNT_PATH ||
  path.join(process.cwd(), "serviceAccountKey.json");

const serviceJson = JSON.parse(readFileSync(serviceKeyPath, "utf-8"));

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceJson),
  });
}

// 2) helpers
function normalizeId(s) {
  return String(s).trim().toUpperCase();
}

function hashITIDNumber(inputRaw) {
  const pepper = process.env.IT_ID_HASH_PEPPER;
  if (!pepper) {
    throw new Error(
      "Missing IT_ID_HASH_PEPPER env. Add it to .env.local for this script."
    );
  }
  const normalized = normalizeId(inputRaw);
  return createHash("sha256").update(normalized + pepper).digest("hex");
}

function generateRawId(length = 10) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const bytes = randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) out += chars[bytes[i] % chars.length];
  return out;
}

async function listAllUsers() {
  const all = [];
  let nextPageToken = undefined;
  do {
    const res = await admin.auth().listUsers(1000, nextPageToken);
    all.push(...res.users);
    nextPageToken = res.pageToken;
  } while (nextPageToken);
  return all;
}

async function main() {
  const db = admin.firestore();

  // 3) check if any admin exists already
  const users = await listAllUsers();
  const admins = users.filter((u) => u.customClaims?.admin === true);

  if (admins.length > 0) {
    console.log("✅ IT Admins found:");
    admins.forEach((u) => {
      console.log(
        `- uid: ${u.uid} | email: ${u.email} | name: ${u.displayName || ""}`
      );
    });
    process.exit(0);
  }

  // 4) none found — create one
  const email = process.env.NEW_ADMIN_EMAIL || "admin@example.com";
  const firstName = process.env.NEW_ADMIN_FIRST || "First";
  const lastName = process.env.NEW_ADMIN_LAST || "Last";
  const displayName = `${firstName} ${lastName}`;

  const rawId = generateRawId(); // Human ID you hand to the admin
  const uid = hashITIDNumber(rawId); // ✅ matches app hashing

  // Create Auth user
  const user = await admin.auth().createUser({ uid, email, displayName });

  // Set admin claim
  await admin.auth().setCustomUserClaims(uid, { admin: true });

  // Write profile doc (optional but helpful)
  await db.collection("it_admins").doc(uid).set({
    uid,
    firstName,
    lastName,
    email,
    createdBy: "bootstrap",
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  console.log("\n✅ Created first IT Admin:");
  console.log("  email:", email);
  console.log("  uid:  ", uid);
  console.log("  rawId:", rawId, "  <-- give THIS to the admin for login");
  console.log(
    "\nKeep the rawId safe. This is the Identification Number used on the Admin Login screen."
  );
}

main().catch((err) => {
  console.error("❌ Script failed:", err);
  process.exit(1);
});

