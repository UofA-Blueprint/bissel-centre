import { cookies } from "next/headers";
import { initAdmin } from "@/app/services/firebaseAdmin";

export async function getStaffAccess(options?: {
  allowAdmin?: boolean;
  checkRevoked?: boolean;
}) {
  const sessionCookie = (await cookies()).get("session")?.value;

  if (!sessionCookie) {
    return { error: "Unauthorized", status: 401 as const };
  }

  try {
    const app = await initAdmin();
    const decodedClaims = await app
      .auth()
      .verifySessionCookie(sessionCookie, options?.checkRevoked ?? true);

    if (decodedClaims.admin === true) {
      if (!options?.allowAdmin) {
        return { error: "Staff access required", status: 403 as const };
      }
      return {
        app,
        db: app.firestore(),
        uid: decodedClaims.uid,
        isAdmin: true as const,
        email: decodedClaims.email || "",
        name: decodedClaims.name || "",
      };
    }

    const staffDoc = await app
      .firestore()
      .collection("administrative_staff")
      .doc(decodedClaims.uid)
      .get();

    if (!staffDoc.exists || staffDoc.data()?.isDeleted === true) {
      return { error: "Staff access required", status: 403 as const };
    }

    return {
      app,
      db: app.firestore(),
      uid: decodedClaims.uid,
      isAdmin: false as const,
      email: decodedClaims.email || "",
      name: decodedClaims.name || "",
    };
  } catch (error) {
    console.error("Staff authorization failed:", error);
    return { error: "Unauthorized", status: 401 as const };
  }
}
