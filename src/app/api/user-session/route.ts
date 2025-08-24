import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { initAdmin } from "@/app/services/firebaseAdmin";

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("session")?.value;

    if (!sessionCookie) {
      return NextResponse.json({ error: "No session found" }, { status: 401 });
    }

    const admin = await initAdmin();
    const decodedClaims = await admin.auth().verifySessionCookie(sessionCookie, true);

    // Get user details from Firebase Auth
    const userRecord = await admin.auth().getUser(decodedClaims.uid);

    const userData = {
      uid: userRecord.uid,
      email: userRecord.email || "",
      name: userRecord.displayName || "",
      photoURL: userRecord.photoURL || "",
      admin: decodedClaims.admin || false,
    };

    return NextResponse.json(userData);
  } catch (error) {
    console.error("Error fetching user session:", error);
    return NextResponse.json(
      { error: "Failed to fetch user session" },
      { status: 401 }
    );
  }
}
