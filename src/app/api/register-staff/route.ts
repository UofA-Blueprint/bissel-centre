import { NextRequest, NextResponse } from "next/server";
import { hashITIDNumber } from "@/utils/hashITIDNumber";
import { initAdmin } from "@/app/services/firebaseAdmin";
import admin from "firebase-admin";

const IT_ADMIN_COLLECTION = "it_admin";
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

    // 2. Verify the IT Admin Identification Number
    const hashedID = hashITIDNumber(identificationNumber);
    const snapshot = await adminDb
      .collection(IT_ADMIN_COLLECTION)
      .where("hashedIdentificationNumber", "==", hashedID)
      .limit(1)
      .get();

    if (snapshot.empty) {
      return NextResponse.json(
        { error: "Invalid identification number" },
        { status: 403 }
      );
    }
    const itAdminDoc = snapshot.docs[0];

    // 3. Create the user in Firebase Auth
    const userRecord = await adminAuth.createUser({
      email,
      password,
      displayName: `${firstName} ${lastName}`,
    });

    // 4. Create the user profile in Firestore
    await adminDb.collection(ADMIN_STAFF_COLLECTION).doc(userRecord.uid).set({
      firstName,
      lastName,
      email,
      createdBy: itAdminDoc.id, // Store the Firestore document ID of the IT admin
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return NextResponse.json({
      success: true,
      uid: userRecord.uid,
    });
  } catch (error: any) {
    console.error("Registration Error:", error);
    let errorMessage = "An unexpected error occurred.";
    let statusCode = 500;

    if (error.code === "auth/email-already-exists") {
      errorMessage = "Email is already in use.";
      statusCode = 409; // Conflict
    } else if (error.code === "auth/invalid-password") {
      errorMessage = "Password must be at least 6 characters long.";
      statusCode = 400;
    }

    return NextResponse.json({ error: errorMessage }, { status: statusCode });
  }
}
