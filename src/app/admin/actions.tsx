"use server";

import { initAdmin } from "@/app/services/firebaseAdmin";
import { cookies } from "next/headers";
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

export async function getAdminSession(): Promise<null> {
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
  console.log("Admin initialized:", admin);
  const hashedId = hashITIDNumber(identificationNumber);
  try {
    const user = await admin.auth().getUser(hashedId);
    console.log("User data:", user);
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

export const deleteUser = async (uid: string) => {
  const admin = await initAdmin();
  try {
    await admin.auth().deleteUser(uid);
    return true;
  } catch (error) {
    console.error("Error deleting user:", error);
    return false;
  }
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
