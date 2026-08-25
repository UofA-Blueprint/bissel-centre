import { NextRequest, NextResponse } from "next/server";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { encryptPhone } from "@/utils/phoneEncryption";
import admin from "firebase-admin";
import { upsertSearchIndexEntry } from "@/app/services/searchIndexService";
import { getStaffAccess } from "@/app/api/_lib/staffAccess";
import { processRecipientPhoto } from "@/app/services/recipientPhotoService";

const EDMONTON_TIMEZONE = "America/Edmonton";

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
    const access = await getStaffAccess();
    if ("error" in access) {
      return NextResponse.json(
        { error: access.error },
        { status: access.status },
      );
    }
    const createdByUid = access.uid;

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
        thumbnail?: string;
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
    let processedPhoto;
    try {
      processedPhoto = await processRecipientPhoto(photoUpload.imageUrl);
    } catch (error) {
      return NextResponse.json(
        {
          error:
            error instanceof Error ? error.message : "Invalid recipient photo.",
        },
        { status: 400 },
      );
    }

    const requiredFields = ["firstName", "lastName", "email"] as const;
    for (const field of requiredFields) {
      if (!personalDetails[field]) {
        return NextResponse.json(
          { error: `${field} is required` },
          { status: 400 },
        );
      }
    }

    const db = getFirestore(access.app);
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
      // Full-res base64 lives in user_photos/{uid}; the user doc only carries
      // the small thumbnail so list queries stay bounded.
      photoThumb: processedPhoto.photoThumb,
      genderIdentity: personalDetails.gender || null,
      aliases: personalDetails.alias ? [personalDetails.alias] : [],
      dateOfBirth: personalDetails.dob || null,
      address: personalDetails.address || null,
      postalCode: personalDetails.postalCode || null,
      passesIssued: [],
      banned: false,
      flagged: false,
      banReason: null,
      flagReason: null,
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
    const photoRef = db.collection("user_photos").doc(userRef.id);
    const photoData = {
      // Canonical re-encode of the validated bytes — never the client's raw
      // string, so lenient-decoder quirks (mid-stream padding etc.) can't be
      // stored. Served via /api/users/[id]/photo.
      picture: processedPhoto.picture,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    if (!arcCardDigits) {
      const batch = db.batch();
      batch.set(userRef, userData);
      batch.set(photoRef, photoData);
      upsertSearchIndexEntry(batch, db, userRef.id, userData);
      await batch.commit();
    } else {
      try {
        await db.runTransaction(async (tx) => {
          const cardQuery = db
            .collection("arc_cards")
            .where("arcCardNumber", "==", arcCardDigits)
            .limit(1);

          const cardSnapshot = await tx.get(cardQuery);

          if (cardSnapshot.empty) {
            throw new Error("Selected ARC Card does not exist");
          }

          const cardDoc = cardSnapshot.docs[0];
          const cardData = cardDoc.data() as {
            currentUserId?: string | null;
            status?: string;
          };

          // Rule 1: card must not already be assigned
          if (cardData.currentUserId) {
            throw new Error("Selected ARC Card is already assigned");
          }

          if (cardData.status !== "Unattributed") {
            throw new Error(
              "Selected ARC Card must be Unattributed before assignment",
            );
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
          });

          tx.set(photoRef, photoData);

          upsertSearchIndexEntry(tx, db, userRef.id, userData);

          // Rule 3: once assigned, card becomes Active
          tx.update(cardDoc.ref, {
            currentUserId: userRef.id,
            status: "Active",
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });

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
        const message =
          err instanceof Error ? err.message : "Failed to assign ARC card";
        return NextResponse.json({ error: message }, { status: 400 });
      }
    }

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
