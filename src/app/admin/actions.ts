/* eslint-disable @typescript-eslint/no-explicit-any */
"use server";

import { initAdmin } from "@/app/services/firebaseAdmin";
import { cookies } from "next/headers";
import { FieldValue } from "firebase-admin/firestore";
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
