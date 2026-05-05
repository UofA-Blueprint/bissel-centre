import { NextRequest, NextResponse } from "next/server";
import { initAdmin } from "@/app/services/firebaseAdmin";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
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
    const { personalDetails, additionalInfo, photoUpload } = body as {
      personalDetails?: {
        firstName?: string;
        lastName?: string;
        alias?: string;
        gender?: string;
        phone?: string;
        email?: string;
        dob?: string;
        address?: string;
        postalCode?: string;
      };
      additionalInfo?: {
        journey?: string;
        mostCommonReason?: string;
        secondMostCommonReason?: string;
        housingOption?: string;
        arcCardDigits?: string;
        arcCardDurationMonths?: string;
        notes?: string;
      };
      photoUpload?: {
        imageUrl?: string;
      };
    };

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
    const requiredFields = ["firstName", "lastName"] as const;
    for (const field of requiredFields) {
      if (!personalDetails[field]) {
        return NextResponse.json(
          { error: `${field} is required` },
          { status: 400 },
        );
      }
    }

    const db = getFirestore();
    const arcCardDigits = String(additionalInfo?.arcCardDigits || "")
      .replace(/\D/g, "")
      .trim();
    const arcCardDurationMonths = Number(additionalInfo?.arcCardDurationMonths);

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
      address: personalDetails.address || null,
      postalCode: personalDetails.postalCode || null,
      passesIssued: [],
      banned: false,
      banReason: null,
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

    const userRef = db.collection("users").doc();
    const batch = db.batch();
    batch.set(userRef, userData);

    if (arcCardDigits) {
      if (
        !Number.isInteger(arcCardDurationMonths) ||
        arcCardDurationMonths < 1 ||
        arcCardDurationMonths > 12
      ) {
        return NextResponse.json(
          { error: "ARC card issue duration must be between 1 and 12 months" },
          { status: 400 },
        );
      }

      const cardSnapshot = await db
        .collection("arc_cards")
        .where("arcCardNumber", "==", arcCardDigits)
        .where("currentUserId", "==", null)
        .limit(1)
        .get();

      if (cardSnapshot.empty) {
        return NextResponse.json(
          { error: "Selected ARC card is not available" },
          { status: 400 },
        );
      }

      const cardDoc = cardSnapshot.docs[0];
      const issueTimestamp = Timestamp.now();
      const issueDate = issueTimestamp.toDate();
      const issueDateString = `${issueDate.getMonth() + 1}/${issueDate.getDate()}/${issueDate.getFullYear()}`;
      const expiresAtDate = new Date(issueTimestamp.toDate());
      expiresAtDate.setMonth(expiresAtDate.getMonth() + arcCardDurationMonths);

      const issueRef = db.collection("issues").doc();

      batch.update(cardDoc.ref, {
        currentUserId: userRef.id,
      });

      batch.set(issueRef, {
        cardId: cardDoc.id,
        createdAt: issueTimestamp,
        issueDate: issueDateString,
        issuedBy: createdByUid,
        notes: additionalInfo?.notes || "",
        returnedAt: null,
        expiresAt: Timestamp.fromDate(expiresAtDate),
        userId: userRef.id,
      });
    }

    await batch.commit();

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
