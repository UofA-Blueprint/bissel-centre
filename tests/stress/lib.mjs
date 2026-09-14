/**
 * Shared utilities for stress tests.
 *
 * Provides Admin SDK init, session-cookie minting, HTTP helpers,
 * and synthetic data generators.
 */

import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import crypto from "crypto";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, "..", "..", ".env.local") });

// ── Admin SDK singleton ──────────────────────────────────────────

let _app;
export function getAdmin() {
  if (!_app) {
    if (getApps().length) {
      _app = getApps()[0];
    } else {
      _app = initializeApp({
        credential: cert({
          projectId: process.env.FIREBASE_PROJECT_ID || "bissel-centre",
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: (process.env.FIREBASE_PRIVATE_KEY || "").replace(/\\n/g, "\n"),
        }),
      });
    }
  }
  return { auth: getAuth(_app), db: getFirestore(_app) };
}

// ── Constants ────────────────────────────────────────────────────

export const STRESS_PREFIX = "__stress_";
export const DEPARTMENTS = [
  "Mental Health", "Emergency", "Case MCT", "Newcomer Volunteer",
  "Reception", "Housing", "FE/Comm Bridge", "FASS", "Child Care",
  "Employment", "Comp Eng Dept", "Transit Dept", "HELP Program",
];

// ── Synthetic data generators ────────────────────────────────────

/**
 * Generate a fake base64 "photo" string of approximately `bytes` size.
 * Real user docs average 110-120 KB — most of that is the photo field.
 */
export function generateFakePhoto(bytes = 110_000) {
  const raw = crypto.randomBytes(Math.ceil(bytes * 0.75));
  return `data:image/jpeg;base64,${raw.toString("base64")}`;
}

const FIRST_NAMES = ["Alex","Jordan","Taylor","Morgan","Casey","Riley","Quinn","Avery","Cameron","Dakota","Emery","Finley","Harper","Jamie","Kendall","Logan","Peyton","Reese","Sage","Skyler"];
const LAST_NAMES = ["Smith","Johnson","Brown","Williams","Jones","Garcia","Miller","Davis","Wilson","Anderson","Thomas","Jackson","White","Harris","Martin","Thompson","Moore","Young","Allen","King"];

export function randomPick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// New photo schema: the user doc carries only a small photoThumb; the
// full-res base64 lives in a user_photos/{uid} doc (see generateUserPhoto).
export function generateUser(staffUid, index) {
  return {
    firstName: randomPick(FIRST_NAMES),
    secondName: randomPick(LAST_NAMES),
    photoThumb: generateFakePhoto(3_000),
    genderIdentity: randomPick(["male", "female", "non-binary", "prefer not to say"]),
    aliases: [],
    dateOfBirth: `${1960 + Math.floor(Math.random() * 45)}-${String(Math.floor(Math.random()*12)+1).padStart(2,"0")}-${String(Math.floor(Math.random()*28)+1).padStart(2,"0")}`,
    arcCardNumber: "",
    address: `${100 + index} Test Street`,
    postalCode: "T5J 0K1",
    passesIssued: [],
    banned: false,
    banReason: "",
    notes: "",
    status: "Active",
    email: `${STRESS_PREFIX}user${index}@test.local`,
    phone: null,
    createdAt: FieldValue.serverTimestamp(),
    createdBy: staffUid,
    updatedAt: FieldValue.serverTimestamp(),
  };
}

export function generateUserPhoto(bytes = 110_000) {
  return {
    picture: generateFakePhoto(bytes),
    migratedAt: new Date(),
  };
}

export function generateCard(index) {
  return {
    currentUserId: null,
    allocationDate: "2025-01-01",
    department: randomPick(DEPARTMENTS),
    arcCardNumber: String(9000000 + index),
    securityCode: crypto.randomBytes(3).toString("hex").toUpperCase(),
    status: "Unattributed",
    notes: "",
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };
}

// ── Session cookie helper ────────────────────────────────────────

/**
 * Create a staff auth user + Firestore doc, then mint a session cookie
 * that can be used against the running Next.js app.
 */
export async function createStaffSession() {
  const { auth, db } = getAdmin();
  const uid = `${STRESS_PREFIX}staff_session`;

  try { await auth.deleteUser(uid); } catch {}
  await auth.createUser({ uid, email: `${STRESS_PREFIX}session@test.local` });

  await db.collection("administrative_staff").doc(uid).set({
    email: `${STRESS_PREFIX}session@test.local`,
    firstName: "Stress",
    lastName: "Tester",
    isDeleted: false,
    onboardingStatus: "active",
    createdBy: "stress-test",
    createdAt: FieldValue.serverTimestamp(),
  });

  const customToken = await auth.createCustomToken(uid);

  // Sign in via REST to get an ID token
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: customToken, returnSecureToken: true }),
    },
  );
  const data = await res.json();
  if (!data.idToken) throw new Error("Failed to get ID token: " + JSON.stringify(data));

  return { uid, idToken: data.idToken };
}

/**
 * Exchange an ID token for a session cookie via the app's session-login route.
 */
export async function getSessionCookie(baseUrl, idToken) {
  const res = await fetch(`${baseUrl}/api/session-login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken }),
    redirect: "manual",
  });

  const setCookie = res.headers.get("set-cookie") || "";
  const match = setCookie.match(/session=([^;]+)/);
  if (match) return match[1];

  const body = await res.json().catch(() => null);
  if (body?.error) throw new Error(`session-login failed: ${body.error}`);
  throw new Error("No session cookie in response");
}

// ── HTTP measurement helper ──────────────────────────────────────

export async function measureEndpoint(url, cookie) {
  const start = performance.now();
  const res = await fetch(url, {
    headers: { Cookie: `session=${cookie}` },
  });
  const elapsed = performance.now() - start;
  const text = await res.text();
  return {
    status: res.status,
    bytes: Buffer.byteLength(text, "utf8"),
    ms: Math.round(elapsed),
    ok: res.ok,
    body: text,
  };
}

// ── Batch write helper ───────────────────────────────────────────

/**
 * Write docs in Firestore batches of `batchSize`.
 * `items` is an array of { ref, data } objects.
 */
export async function batchWrite(items, batchSize = 400) {
  const { db } = getAdmin();
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = db.batch();
    const chunk = items.slice(i, i + batchSize);
    for (const { ref, data } of chunk) {
      batch.set(ref, data);
    }
    await batch.commit();
  }
}

// ── Formatting ───────────────────────────────────────────────────

export function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function formatMs(ms) {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}
