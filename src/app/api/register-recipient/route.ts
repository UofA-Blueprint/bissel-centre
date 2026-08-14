import { NextRequest, NextResponse } from "next/server";
import { initAdmin } from "@/app/services/firebaseAdmin";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { cookies } from "next/headers";
import { encryptPhone } from "@/utils/phoneEncryption";
import admin from "firebase-admin";

const MAX_PICTURE_FIELD_BYTES = 1_000_000; // Firestore field value must stay < ~1,048,487 bytes.
const EDMONTON_TIMEZONE = "America/Edmonton";

function getUtf8ByteSize(value: string): number {
  return Buffer.byteLength(value, "utf8");
}

function formatEdmontonDate(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: EDMONTON_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  if (!year || !month || !day) return "";
  return `${year}-${month}-${day}`;
}

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

    const adminApp = await initAdmin();
    const decodedClaims = await adminApp
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
    const pictureBytes = getUtf8ByteSize(photoUpload.imageUrl);
    if (pictureBytes > MAX_PICTURE_FIELD_BYTES) {
      return NextResponse.json(
        {
          error:
            "Recipient photo is too large. Please upload a smaller image.",
        },
        { status: 400 },
      );
    }

    // Validate required personal details fields
    const requiredFields = ["firstName", "lastName", "email"] as const;
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
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      createdBy: createdByUid,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),

      // Additional fields from form (not in core schema but preserving data)
      phone: encryptedPhone, // Encrypted phone number
      email: personalDetails.email || null,
      journey: additionalInfo?.journey || null,
      mostCommonReason: additionalInfo?.mostCommonReason || null,
      secondMostCommonReason: additionalInfo?.secondMostCommonReason || null,
      housingOption: additionalInfo?.housingOption || null,
    };

    const userRef = db.collection("users").doc();
    // const batch = db.batch();
    // batch.set(userRef, userData);

    if (!arcCardDigits){
      await userRef.set(userData)
    }else{
      try {
        await db.runTransaction(async(tx) => {
          const cardQuery = db
          .collection("arc_cards")
          .where("arcCardNumber", "==", arcCardDigits)
          .limit(1);

          const cardSnapshot = await tx.get(cardQuery);

          if (cardSnapshot.empty){
            throw new Error("Selected ARC Card does not exist")
          }

          const cardDoc = cardSnapshot.docs[0];
          const cardData = cardDoc.data() as {
            currentUserId?: string | null;
            status?: string
          }

          // Rule 1: card must not already be assigned
          if (cardData.currentUserId){
            throw new Error("Selected ARC Card is already assigned")
          }

          if (cardData.status !== "Unattributed"){
            throw new Error(
              "Selected ARC Card must be Unattributed before assignment"
            )
          }

  
          const issueTimestamp = Timestamp.now();
          const issueDate = issueTimestamp.toDate();
          const issueDateString = formatEdmontonDate(issueDate);

          // Defensive cleanup: older data may still contain stale open issues for
          // this same card. Close them before creating the new active issue.
          const staleOpenIssuesQuery = db
            .collection("issues")
            .where("cardId", "==", cardDoc.id)
            .where("returnedAt", "==", null);
          const staleOpenIssuesSnap = await tx.get(staleOpenIssuesQuery);

          const issueRef = db.collection("issues").doc();

          for (const staleIssueDoc of staleOpenIssuesSnap.docs) {
            tx.update(staleIssueDoc.ref, {
              returnedAt: issueTimestamp,
            });
          }

          tx.set(userRef, {
            ...userData,
            arcCardNumber: arcCardDigits,
            passesIssued: [cardDoc.id],
          })

          // Rule 3: once assigned, card becomes Active
          tx.update(cardDoc.ref,{
            currentUserId: userRef.id,
            status: "Active",
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          })

          tx.set(issueRef, {
            cardId: cardDoc.id,
            createdAt: issueTimestamp,
            issueDate: issueDateString,
            issuedBy: createdByUid,
            notes: additionalInfo?.notes || "",
            returnedAt: null,
            userId: userRef.id,
          });
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to assign ARC card";
        return NextResponse.json({ error: message }, { status: 400 });
      }}

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
