import { NextRequest, NextResponse } from "next/server";
import { initAdmin } from "@/app/services/firebaseAdmin";
import { getFirestore } from "firebase-admin/firestore";
import { cookies } from "next/headers";
import { encryptPhone } from "@/utils/phoneEncryption";

export async function POST(request: NextRequest) {
  try {
    // Verify user session
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("session")?.value;

    if (!sessionCookie) {
      return NextResponse.json(
        { error: "Unauthorized - No session found" },
        { status: 401 },
      );
    }

    const admin = await initAdmin();
    const decodedClaims = await admin
      .auth()
      .verifySessionCookie(sessionCookie, true);
    const createdByUid = decodedClaims.uid;

    const body = await request.json();
    const { personalDetails, additionalInfo, photoUpload } = body;

    // Validate required fields
    if (!personalDetails) {
      return NextResponse.json(
        { error: "Personal details are required" },
        { status: 400 },
      );
    }

    // Validate photo is provided
    if (!photoUpload?.imageUrl) {
      return NextResponse.json(
        { error: "Recipient photo is required" },
        { status: 400 },
      );
    }

    // Validate required personal details fields
    const requiredFields = ["firstName", "lastName"];
    for (const field of requiredFields) {
      if (!personalDetails[field]) {
        return NextResponse.json(
          { error: `${field} is required` },
          { status: 400 },
        );
      }
    }

    const db = getFirestore();

    // Encrypt phone number before storing
    const encryptedPhone = encryptPhone(personalDetails.phone || null);

    // Prepare flattened user data matching schema
    const userData = {
      // Required schema fields
      firstName: personalDetails.firstName,
      secondName: personalDetails.lastName,
      picture: photoUpload.imageUrl, // Base64 encoded image
      genderIdentity: personalDetails.gender || null,
      aliases: personalDetails.alias ? [personalDetails.alias] : [],
      dateOfBirth: personalDetails.dob || null,
      arcCardNumber: additionalInfo?.arcCardDigits || null,
      address: personalDetails.address || null,
      postalCode: personalDetails.postalCode || null,
      passesIssued: [],
      banned: false,
      banReason: null,
      notes: additionalInfo?.notes || null,
      createdAt: new Date().toISOString(),
      createdBy: createdByUid,
      updatedAt: new Date().toISOString(),

      // Additional fields from form (not in core schema but preserving data)
      phone: encryptedPhone, // Encrypted phone number
      email: personalDetails.email || null,
      journey: additionalInfo?.journey || null,
      mostCommonReason: additionalInfo?.mostCommonReason || null,
      secondMostCommonReason: additionalInfo?.secondMostCommonReason || null,
      housingOption: additionalInfo?.housingOption || null,
    };

    // Store user in Firestore
    const userRef = await db.collection("users").add(userData);

    return NextResponse.json(
      {
        success: true,
        message: "Recipient registered successfully",
        userId: userRef.id,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Error registering recipient:", error);

    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(
      { error: "Failed to register recipient" },
      { status: 500 },
    );
  }
}
