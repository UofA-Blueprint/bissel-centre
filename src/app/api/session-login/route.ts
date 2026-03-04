import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { initAdmin } from "@/app/services/firebaseAdmin";

export async function POST(req: NextRequest) {
  const { idToken } = await req.json();

  if (!idToken) {
    return NextResponse.json({ error: "Missing ID token" }, { status: 400 });
  }

  const admin = await initAdmin();
  const expiresIn = 60 * 60 * 24 * 5 * 1000; // 5 days

  let decodedToken: { uid: string; admin?: boolean };
  try {
    decodedToken = await admin.auth().verifyIdToken(idToken, true);
  } catch (error) {
    console.error("ID token verification failed:", error);
    return NextResponse.json({ error: "Invalid ID token" }, { status: 401 });
  }

  // Staff login endpoint should not create IT admin sessions.
  if (decodedToken.admin === true) {
    return NextResponse.json(
      { error: "IT admins must use the admin login flow" },
      { status: 403 }
    );
  }

  // Ensure the user exists in administrative_staff.
  const staffDoc = await admin
    .firestore()
    .collection("administrative_staff")
    .doc(decodedToken.uid)
    .get();

  if (!staffDoc.exists) {
    return NextResponse.json(
      { error: "Staff member not found in administrative staff" },
      { status: 403 }
    );
  }

  try {
    const sessionCookie = await admin.auth().createSessionCookie(idToken, {
      expiresIn,
    });

    const cookieStore = await cookies();
    cookieStore.set({
      name: "session",
      value: sessionCookie,
      maxAge: expiresIn / 1000,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Session login error:", error);
    return NextResponse.json(
      { error: "Failed to create session" },
      { status: 401 }
    );
  }
}
