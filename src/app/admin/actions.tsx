"use server";

import { initAdmin } from "@/app/services/firebaseAdmin";
import { cookies } from 'next/headers';
import { hashITIDNumber } from "../../../utils/hashITIDNumber";

export const handleITAdminLogin = async (IdentificationNumber: string) => {
    // IdentificatioNumbe is same as the UID of the firebase user
    const admin = await initAdmin()
    try {
        const user = await admin.auth().getUser(IdentificationNumber);
        const token = await admin.auth().createCustomToken(user.uid);
        return token;
    } catch (error) {
        return null;
    }
    
}

export async function getAdminSession(): Promise<null> {
    const cookie = await cookies();
    const sessionCookie = cookie.get('session')?.value;
    if (!sessionCookie) return null;
  
    const admin = await initAdmin();
    try {
      const decoded = await admin.auth().verifySessionCookie(sessionCookie, true);
      if (decoded.admin !== true) return null; // Optional: ensure admin claim
      return decoded;
    } catch (err) {
      console.error('Session verification failed:', err);
      return null;
    }
  }

export const createAdmin = async () => {
    console.log("Creating admin")
    const admin = await initAdmin()

    const hashed_uid = hashITIDNumber('ABC123'); // Example IT ID number, replace with actual logic
    const user = await admin.auth().createUser({
        email: 'ABC123@bissel.com', // an identifier
        password: 'secret',
        displayName: 'Steve Jobs',
        uid: hashed_uid
      });

        
    const userData = user;
    console.log(userData);

    console.log("Attempting to make user admin")
    const res = await admin.auth().setCustomUserClaims(hashed_uid, { admin: true });
    console.log(res);
}

export const checkAdmin = async (identificationNumber: string) => {
    const admin = await initAdmin();
    try {
        const user = await admin.auth().getUser(identificationNumber);
        console.log("User data:", user);
        return user.customClaims?.admin === true;
    } catch (error) {
        console.error("Error checking admin status:", error);
        return false;
    }
}

export const listUsers = async () => {
    const admin = await initAdmin();
    try {
        const listUsersResult = await admin.auth().listUsers();
        return listUsersResult.users.map(user => ({
            uid: user.uid,
            email: user.email,
            displayName: user.displayName,
            customClaims: user.customClaims
        }));
    } catch (error) {
        console.error("Error listing users:", error);
        return [];
    }
}

export const deleteUser = async (uid: string) => {
    const admin = await initAdmin();
    try {
        await admin.auth().deleteUser(uid);
        return true;
    } catch (error) {
        console.error("Error deleting user:", error);
        return false;
    }
}