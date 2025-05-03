"use server";

import { initAdmin } from "@/app/services/firebaseAdmin";
import { cookies } from 'next/headers';

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
    const user = await admin.auth().createUser({
        email: 'itadmin@gmail.com',
        password: 'secret',
        displayName: 'Steve Jobs',
        uid: 'ABC123',
      });

        
    const userData = user;
    console.log(userData);

    console.log("Attempting to make user admin")
    const res = await admin.auth().setCustomUserClaims('ABC123', { admin: true });
    console.log(res);
}
