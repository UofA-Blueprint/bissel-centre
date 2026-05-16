/* eslint-disable  @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { hashITIDNumber } from "@/utils/hashITIDNumber";
import { initAdmin } from "@/app/services/firebaseAdmin";
import admin from "firebase-admin";
import { checkAdmin } from "@/app/admin/actions";

const ADMIN_STAFF_COLLECTION = "administrative_staff";

export async function POST(request: NextRequest) {
  try {
    const { email, password, firstName, lastName, identificationNumber } =
      await request.json();

    // 1. Basic server-side validation
    if (
      !email ||
      !password ||
      !firstName ||
      !lastName ||
      !identificationNumber
    ) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
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
        { status: 403 }
      );
    }

    console.log("Verified IT Admin Identification Number successfully");

    const hashedID = hashITIDNumber(identificationNumber);

    console.log("Hashed IT Admin Identification Number successfully");

    // 3. Create the user in Firebase Auth
    const userRecord = await adminAuth.createUser({
      email,
      password,
      displayName: `${firstName} ${lastName}`,
    });

    console.log("Created user in Firebase Auth successfully");
    // 4. Create the user profile in Firestore
    await adminDb.collection(ADMIN_STAFF_COLLECTION).doc(userRecord.uid).set({
      firstName,
      lastName,
      email,
      createdBy: hashedID, // store the admin uid (hashed ID) who created this staff user
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log("Created user profile in Firestore successfully");

    return NextResponse.json({
      success: true,
      uid: userRecord.uid,
    });
  } catch (error: unknown) {
    console.error("Registration Error:", error);
    let errorMessage = "An unexpected error occurred.";
    let statusCode = 500;

    const err = error as { code?: string };
    if (err.code === "auth/email-already-exists") {
      errorMessage = "Email is already in use.";
      statusCode = 409; // Conflict
    } else if (err.code === "auth/invalid-password") {
      errorMessage = "Password must be at least 6 characters long.";
      statusCode = 400;
    }

    return NextResponse.json({ error: errorMessage }, { status: statusCode });
  }
}
