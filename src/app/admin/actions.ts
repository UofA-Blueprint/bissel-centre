/* eslint-disable @typescript-eslint/no-explicit-any */
"use server";

import { initAdmin } from "@/app/services/firebaseAdmin";
import { cookies } from "next/headers";
import { FieldPath, FieldValue } from "firebase-admin/firestore";
import { hashITIDNumber } from "@/utils/hashITIDNumber";
import { randomBytes } from "crypto";

export const handleITAdminLogin = async (IdentificationNumber: string) => {
  const admin = await initAdmin();
  try {
    const hashed_uid = hashITIDNumber(IdentificationNumber);
    const user = await admin.auth().getUser(hashed_uid);

    // REQUIRE admin custom claim
    if (user.customClaims?.admin !== true) {
      console.warn("Non-admin attempted admin login:", hashed_uid);
      return null;
    }

    const token = await admin.auth().createCustomToken(user.uid);
    return token;
  } catch (error) {
    console.error("handleITAdminLogin error:", error);
    return null;
  }
};

export async function getAdminSession(): Promise<
  null | import("firebase-admin").auth.DecodedIdToken
> {
  const cookie = await cookies();
  const sessionCookie = cookie.get("session")?.value;
  if (!sessionCookie) return null;

  const admin = await initAdmin();
  try {
    const decoded = await admin.auth().verifySessionCookie(sessionCookie, true);
    if (decoded.admin !== true) return null; // Optional: ensure admin claim
    return decoded;
  } catch (err) {
    console.error("Session verification failed:", err);
    return null;
  }
}

export const createAdmin = async (
  email: string,
  displayName: string
): Promise<{
  user: import("firebase-admin").auth.UserRecord | null;
  rawId: string | null;
}> => {
  const admin = await initAdmin();

  // helper: secure alphanumeric (A-Z0-9) generator, exact length
  const generateRawId = (length = 10) => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    const bytes = randomBytes(length);
    let out = "";
    for (let i = 0; i < length; i++) {
      out += chars[bytes[i] % chars.length];
    }
    return out;
  };

  try {
    const rawId = generateRawId();
    const uid = hashITIDNumber(rawId);

    const createReq: import("firebase-admin").auth.CreateRequest = {
      uid,
      email,
      displayName,
    };

    const user = await admin.auth().createUser(createReq);

    // set admin claim
    await admin.auth().setCustomUserClaims(uid, { admin: true });

    console.log("Created user");
    return { user, rawId };
  } catch (error: any) {
    console.error(
      "createAdmin error:",
      error?.code ?? "no-code",
      error?.message ?? error
    );
    throw error;
  }
};

export const checkAdmin = async (identificationNumber: string) => {
  const admin = await initAdmin();
  const hashedId = hashITIDNumber(identificationNumber);
  try {
    const user = await admin.auth().getUser(hashedId);
    return user.customClaims?.admin === true;
  } catch (error) {
    console.error("Error checking admin status:", error);
    return false;
  }
};

export const listUsers = async () => {
  const admin = await initAdmin();
  try {
    const listUsersResult = await admin.auth().listUsers();
    return listUsersResult.users.map((user) => ({
      uid: user.uid,
      email: user.email,
      displayName: user.displayName,
      customClaims: user.customClaims,
    }));
  } catch (error) {
    console.error("Error listing users:", error);
    return [];
  }
};

export const getAdministrativeStaff = async () => {
  const session = await getAdminSession();
  if (!session) {
    throw new Error("Unauthorized: IT admin session required");
  }

  const admin = await initAdmin();
  const snapshot = await admin.firestore().collection("administrative_staff").get();

  return snapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      createdAt: data.createdAt?.toDate?.() ?? null,
      createdBy: data.createdBy ?? "",
      email: data.email ?? "",
      firstName: data.firstName ?? "",
      secondName: data.secondName ?? data.lastName ?? "",
    };
  });
};

export const deleteAdministrativeStaff = async (id: string) => {
  const session = await getAdminSession();
  if (!session) {
    throw new Error("Unauthorized: IT admin session required");
  }

  const admin = await initAdmin();
  const db = admin.firestore();

  // Remove the user from Firebase Authentication first.
  // If the auth user does not exist, we still continue deleting the staff record.
  try {
    await admin.auth().deleteUser(id);
  } catch (error: any) {
    if (error?.code !== "auth/user-not-found") {
      throw error;
    }
  }

  await db.collection("administrative_staff").doc(id).delete();

  return { success: true };
}

export interface UpdateAdministrativeStaffInput {
  firstName?: string;
  lastName?: string;
  email?: string;
}

export const updateAdministrativeStaff = async (
  id: string,
  input: UpdateAdministrativeStaffInput
): Promise<{ success: true }> => {
  const session = await getAdminSession();
  if (!session) {
    throw new Error("Unauthorized: IT admin session required");
  }

  const firstName = input.firstName?.trim();
  const lastName = input.lastName?.trim();
  const email = input.email?.trim().toLowerCase();

  if (firstName !== undefined && firstName.length === 0) {
    throw new Error("First name cannot be empty");
  }
  if (lastName !== undefined && lastName.length === 0) {
    throw new Error("Last name cannot be empty");
  }
  if (email !== undefined && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("Invalid email address");
  }

  const admin = await initAdmin();
  const db = admin.firestore();
  const staffRef = db.collection("administrative_staff").doc(id);

  const snapshot = await staffRef.get();
  if (!snapshot.exists) {
    throw new Error("Administrative staff not found");
  }
  const current = snapshot.data() ?? {};

  const nextFirstName = firstName ?? current.firstName ?? "";
  const nextLastName = lastName ?? current.lastName ?? current.secondName ?? "";

  const firestorePatch: Record<string, unknown> = {
    updatedAt: FieldValue.serverTimestamp(),
  };
  if (firstName !== undefined) firestorePatch.firstName = firstName;
  if (lastName !== undefined) firestorePatch.lastName = lastName;
  if (email !== undefined) firestorePatch.email = email;

  const authPatch: { email?: string; displayName?: string } = {};
  if (email !== undefined) authPatch.email = email;
  if (firstName !== undefined || lastName !== undefined) {
    authPatch.displayName = `${nextFirstName} ${nextLastName}`.trim();
  }

  if (Object.keys(authPatch).length > 0) {
    try {
      await admin.auth().updateUser(id, authPatch);
    } catch (error: any) {
      if (error?.code === "auth/email-already-exists") {
        throw new Error("Email is already in use by another account");
      }
      if (error?.code === "auth/user-not-found") {
        throw new Error(
          "Auth account missing for this staff record — email/name changes cannot be applied"
        );
      }
      throw error;
    }
  }

  await staffRef.update(firestorePatch);
  return { success: true };
};

export interface AdministrativeStaffSummary {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  displayName: string;
  onboardingStatus: string;
  createdAt: string | null;
  inviteAcceptedAt: string | null;
  photoURL: string;
  authEmailVerified: boolean;
  counts: {
    recipientsRegistered: number;
    cardsIssued: number;
    bansPlaced: number;
    auditEntries: number;
  };
}

export const getAdministrativeStaffSummary = async (
  id: string
): Promise<AdministrativeStaffSummary> => {
  const session = await getAdminSession();
  if (!session) {
    throw new Error("Unauthorized: IT admin session required");
  }

  const admin = await initAdmin();
  const db = admin.firestore();

  const staffRef = db.collection("administrative_staff").doc(id);
  const snapshot = await staffRef.get();
  if (!snapshot.exists) {
    throw new Error("Administrative staff not found");
  }
  const data = snapshot.data() ?? {};

  const [
    recipientsSnap,
    issuesSnap,
    bansSnap,
    auditSnap,
    authRecord,
  ] = await Promise.all([
    db.collection("users").where("createdBy", "==", id).count().get(),
    db.collection("issues").where("issuedBy", "==", id).count().get(),
    db.collection("banned_users").where("bannedBy", "==", id).count().get(),
    db.collection("history").where("modifiedBy", "==", id).count().get(),
    admin.auth().getUser(id).catch(() => null),
  ]);

  const firstName = (data.firstName ?? "") as string;
  const lastName = (data.lastName ?? data.secondName ?? "") as string;

  return {
    id: snapshot.id,
    firstName,
    lastName,
    email: (data.email ?? authRecord?.email ?? "") as string,
    displayName:
      authRecord?.displayName ?? `${firstName} ${lastName}`.trim(),
    onboardingStatus: (data.onboardingStatus ?? "unknown") as string,
    createdAt: data.createdAt?.toDate?.().toISOString() ?? null,
    inviteAcceptedAt:
      data.inviteAcceptedAt?.toDate?.().toISOString() ?? null,
    photoURL: authRecord?.photoURL ?? "",
    authEmailVerified: authRecord?.emailVerified ?? false,
    counts: {
      recipientsRegistered: recipientsSnap.data().count,
      cardsIssued: issuesSnap.data().count,
      bansPlaced: bansSnap.data().count,
      auditEntries: auditSnap.data().count,
    },
  };
};


export interface StaffRecipientRow {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  createdAt: string | null;
  banned: boolean;
}

export interface StaffIssueRow {
  id: string;
  cardId: string;
  cardNumber: string;
  department: string;
  userId: string;
  userName: string;
  issueDate: string;
  returnedAt: string | null;
  expiresAt: string | null;
  cardStatus: string;
}

export interface StaffAuditRow {
  id: string;
  date: string | null;
  event: string;
  notes: string;
  userId: string;
  userName: string;
  reason: string | null;
}

export interface StaffBanRow {
  id: string;
  userId: string;
  userName: string;
  banReason: string;
  bannedAt: string | null;
  notes: string;
}

const MODAL_LIST_LIMIT = 100;

async function requireAdminSession() {
  const session = await getAdminSession();
  if (!session) {
    throw new Error("Unauthorized: IT admin session required");
  }
  return session;
}

function timestampToIso(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "string") return value;
  const asAny = value as any;
  if (typeof asAny?.toDate === "function") {
    try {
      return asAny.toDate().toISOString();
    } catch {
      return null;
    }
  }
  return null;
}

async function buildUserNameMap(
  db: FirebaseFirestore.Firestore,
  userIds: string[],
): Promise<Map<string, string>> {
  const nameById = new Map<string, string>();
  const unique = Array.from(new Set(userIds.filter((id) => id && id.length > 0)));
  // Batch in-clause is limited to 30 for admin SDK. Chunk the input.
  const CHUNK = 30;
  for (let i = 0; i < unique.length; i += CHUNK) {
    const chunk = unique.slice(i, i + CHUNK);
    if (chunk.length === 0) continue;
    const snap = await db
      .collection("users")
      .where(FieldPath.documentId(), "in", chunk)
      .get();
    for (const doc of snap.docs) {
      const d = doc.data();
      const name = `${d.firstName ?? ""} ${d.secondName ?? d.lastName ?? ""}`.trim();
      nameById.set(doc.id, name || "(unnamed)");
    }
  }
  return nameById;
}

export const getStaffRecipients = async (
  staffUid: string,
): Promise<StaffRecipientRow[]> => {
  await requireAdminSession();
  const admin = await initAdmin();
  const db = admin.firestore();

  const snap = await db
    .collection("users")
    .where("createdBy", "==", staffUid)
    .limit(MODAL_LIST_LIMIT)
    .get();

  return snap.docs.map((doc) => {
    const d = doc.data();
    return {
      id: doc.id,
      firstName: (d.firstName ?? "") as string,
      lastName: (d.secondName ?? d.lastName ?? "") as string,
      email: (d.email ?? "") as string,
      createdAt: timestampToIso(d.createdAt),
      banned: Boolean(d.banned),
    };
  });
};

export const getStaffIssues = async (
  staffUid: string,
): Promise<StaffIssueRow[]> => {
  await requireAdminSession();
  const admin = await initAdmin();
  const db = admin.firestore();

  const issuesSnap = await db
    .collection("issues")
    .where("issuedBy", "==", staffUid)
    .limit(MODAL_LIST_LIMIT)
    .get();

  const cardIds = Array.from(
    new Set(
      issuesSnap.docs
        .map((doc) => (doc.data().cardId ?? "") as string)
        .filter((id) => id.length > 0),
    ),
  );

  const cardsById = new Map<
    string,
    { cardNumber: string; department: string; status: string }
  >();
  const CHUNK = 30;
  for (let i = 0; i < cardIds.length; i += CHUNK) {
    const chunk = cardIds.slice(i, i + CHUNK);
    if (chunk.length === 0) continue;
    const cardSnap = await db
      .collection("arc_cards")
      .where(FieldPath.documentId(), "in", chunk)
      .get();
    for (const doc of cardSnap.docs) {
      const d = doc.data();
      cardsById.set(doc.id, {
        cardNumber: (d.arcCardNumber ?? "") as string,
        department: (d.department ?? "") as string,
        status: (d.status ?? "Unloaded") as string,
      });
    }
  }

  const userIds = issuesSnap.docs.map(
    (doc) => (doc.data().userId ?? "") as string,
  );
  const nameById = await buildUserNameMap(db, userIds);

  return issuesSnap.docs.map((doc) => {
    const d = doc.data();
    const cardId = (d.cardId ?? "") as string;
    const userId = (d.userId ?? "") as string;
    const cardInfo = cardsById.get(cardId);
    return {
      id: doc.id,
      cardId,
      cardNumber: cardInfo?.cardNumber ?? "",
      department: cardInfo?.department ?? "",
      cardStatus: cardInfo?.status ?? "Unknown",
      userId,
      userName: nameById.get(userId) ?? "",
      issueDate: (d.issueDate ?? "") as string,
      returnedAt: timestampToIso(d.returnedAt),
      expiresAt: timestampToIso(d.expiresAt),
    };
  });
};

export const getStaffAuditEntries = async (
  staffUid: string,
): Promise<StaffAuditRow[]> => {
  await requireAdminSession();
  const admin = await initAdmin();
  const db = admin.firestore();

  const snap = await db
    .collection("history")
    .where("modifiedBy", "==", staffUid)
    .limit(MODAL_LIST_LIMIT)
    .get();

  const userIds = snap.docs.map((doc) => (doc.data().userId ?? "") as string);
  const nameById = await buildUserNameMap(db, userIds);

  return snap.docs.map((doc) => {
    const d = doc.data();
    const userId = (d.userId ?? "") as string;
    return {
      id: doc.id,
      date: timestampToIso(d.date),
      event: (d.event ?? "") as string,
      notes: (d.notes ?? "") as string,
      userId,
      userName: nameById.get(userId) ?? "",
      reason: d.reason ? String(d.reason) : null,
    };
  });
};

export const getStaffBans = async (
  staffUid: string,
): Promise<StaffBanRow[]> => {
  await requireAdminSession();
  const admin = await initAdmin();
  const db = admin.firestore();

  const snap = await db
    .collection("banned_users")
    .where("bannedBy", "==", staffUid)
    .limit(MODAL_LIST_LIMIT)
    .get();

  const userIds = snap.docs.map((doc) => (doc.data().userId ?? "") as string);
  const nameById = await buildUserNameMap(db, userIds);

  return snap.docs.map((doc) => {
    const d = doc.data();
    const userId = (d.userId ?? "") as string;
    return {
      id: doc.id,
      userId,
      userName: nameById.get(userId) ?? "",
      banReason: (d.banReason ?? "") as string,
      bannedAt: timestampToIso(d.bannedAt),
      notes: (d.notes ?? "") as string,
    };
  });
};

export const setUserAsAdmin = async (email: string) => {
  const admin = await initAdmin();
  try {
    // Find user by email
    const userRecord = await admin.auth().getUserByEmail(email);

    // Set admin custom claim
    await admin.auth().setCustomUserClaims(userRecord.uid, { admin: true });

    console.log(`User ${email} has been set as admin`);
    return true;
  } catch (error) {
    console.error("Error setting user as admin:", error);
    return false;
  }
};
