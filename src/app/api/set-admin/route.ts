import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { initAdmin } from "@/app/services/firebaseAdmin";

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("session")?.value;

    if (!sessionCookie) {
      return NextResponse.json(
        { error: "Unauthorized: missing session" },
        { status: 401 }
      );
    }

    const admin = await initAdmin();

    let decodedClaims: import("firebase-admin").auth.DecodedIdToken;
    try {
      decodedClaims = await admin.auth().verifySessionCookie(sessionCookie, true);
    } catch {
      return NextResponse.json(
        { error: "Unauthorized: invalid session" },
        { status: 401 }
      );
    }

    if ((decodedClaims.admin as boolean | undefined) !== true) {
      return NextResponse.json(
        { error: "Forbidden: IT admin access required" },
        { status: 403 }
      );
    }

    const { email } = await request.json();
    const normalizedEmail =
      typeof email === "string" ? email.trim().toLowerCase() : "";

    if (!normalizedEmail) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    // Get user by email
    const userRecord = await admin.auth().getUserByEmail(normalizedEmail);

    // Preserve existing claims while setting admin
    await admin.auth().setCustomUserClaims(userRecord.uid, {
      ...(userRecord.customClaims ?? {}),
      admin: true,
    });

    return NextResponse.json({
      success: true,
      message: `Admin privileges set for ${normalizedEmail}`,
      uid: userRecord.uid,
    });
  } catch (error) {
    console.error("Error setting admin privileges:", error);
    return NextResponse.json(
      {
        error: "Failed to set admin privileges",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
