import { NextRequest, NextResponse } from "next/server";
import { hashITIDNumber } from "@/utils/hashITIDNumber";
import { initAdmin } from "@/app/services/firebaseAdmin";
import admin from "firebase-admin";
import { checkAdmin } from "@/app/admin/actions";

const ADMIN_STAFF_COLLECTION = "administrative_staff";

function generateTemporaryPassword(): string {
  // Server-generated secret ensures invited users cannot log in until they reset.
  return `${crypto.randomUUID()}A1!`;
}

async function sendPasswordSetupEmail(email: string): Promise<void> {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;

  if (!apiKey) {
    throw new Error("Missing Firebase Web API key.");
  }

  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${apiKey}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        requestType: "PASSWORD_RESET",
        email,
      }),
    },
  );

  if (!response.ok) {
    const errorPayload = await response.json().catch(() => null);
    const firebaseMessage = errorPayload?.error?.message;
    throw new Error(
      firebaseMessage
        ? `Firebase email dispatch failed: ${firebaseMessage}`
        : "Firebase email dispatch failed.",
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { email, firstName, lastName, identificationNumber } =
      await request.json();

    // 1. Basic server-side validation
    if (!email || !firstName || !lastName || !identificationNumber) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    const app = await initAdmin();
    const adminDb = admin.firestore(app);
    const adminAuth = admin.auth(app);

    console.log("Initialized admin database and authentication successfully");

    // 2. Verify the IT Admin Identification Number using checkAdmin()
    const isAdmin = await checkAdmin(identificationNumber);
    if (!isAdmin) {
      return NextResponse.json(
        { error: "Invalid identification number or not authorized" },
        { status: 403 },
      );
    }

    console.log("Verified IT Admin Identification Number successfully");

    const hashedID = hashITIDNumber(identificationNumber);
    const temporaryPassword = generateTemporaryPassword();

    console.log("Hashed IT Admin Identification Number successfully");

    // 3. Create the user in Firebase Auth
    const userRecord = await adminAuth.createUser({
      email,
      password: temporaryPassword,
      displayName: `${firstName} ${lastName}`,
    });

    console.log("Created user in Firebase Auth successfully");
    // 4. Create the user profile in Firestore with onboarding fields
    await adminDb.collection(ADMIN_STAFF_COLLECTION).doc(userRecord.uid).set({
      firstName,
      lastName,
      email,
      createdBy: hashedID, // store the admin uid (hashed ID) who created this staff user
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      onboardingStatus: "invited",
      inviteSentAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log(
      "Created user profile in Firestore with onboarding fields successfully",
    );

    // 5. Trigger Firebase password reset email delivery for onboarding
    try {
      await sendPasswordSetupEmail(email);
      console.log(`Password setup email sent for onboarding: ${email}`);
    } catch (resetError) {
      console.error(
        "Failed to send password setup email for onboarding:",
        resetError,
      );
      // Continue, but inform the client
      return NextResponse.json(
        {
          success: false,
          uid: userRecord.uid,
          warning:
            "User created, but failed to send password setup email. Please try resending.",
        },
        { status: 201 },
      );
    }

    return NextResponse.json({
      success: true,
      uid: userRecord.uid,
    });
  } catch (error: unknown) {
    console.error("Registration Error:", error);
    let errorMessage = "An unexpected error occurred.";
    let statusCode = 500;

    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "auth/email-already-exists"
    ) {
      errorMessage = "Email is already in use.";
      statusCode = 409; // Conflict
    } else if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "auth/invalid-password"
    ) {
      errorMessage = "Password must be at least 6 characters long.";
      statusCode = 400;
    }

    return NextResponse.json({ error: errorMessage }, { status: statusCode });
  }
}
