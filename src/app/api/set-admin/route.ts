import { NextRequest, NextResponse } from "next/server";
import { initAdmin } from "@/app/services/firebaseAdmin";

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    console.log(`Setting admin privileges for: ${email}`);

    const admin = await initAdmin();

    // Get user by email
    const userRecord = await admin.auth().getUserByEmail(email);
    console.log(`Found user: ${userRecord.uid}`);

    // Set admin custom claim
    await admin.auth().setCustomUserClaims(userRecord.uid, { admin: true });

    console.log(`✅ Successfully set admin privileges for ${email}`);

    // Verify the change
    const updatedUser = await admin.auth().getUser(userRecord.uid);
    const isAdmin = updatedUser.customClaims?.admin === true;

    return NextResponse.json({
      success: true,
      message: `Admin privileges set for ${email}`,
      isAdmin,
      uid: userRecord.uid,
    });
  } catch (error) {
    console.error("❌ Error setting admin privileges:", error);
    return NextResponse.json(
      {
        error: "Failed to set admin privileges",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
