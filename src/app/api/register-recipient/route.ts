import { NextRequest, NextResponse } from "next/server";
import { initAdmin } from "@/app/services/firebaseAdmin";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { cookies } from "next/headers";
import { encryptPhone } from "@/utils/phoneEncryption";
import admin from "firebase-admin";
import sharp from "sharp";

const MAX_PICTURE_FIELD_BYTES = 1_000_000; // Firestore field value must stay < ~1,048,487 bytes.
// Thumbnails live on the user doc and ship with every list response — keep
// them small so list payloads stay bounded.
const MAX_THUMBNAIL_FIELD_BYTES = 20_000;
const EDMONTON_TIMEZONE = "America/Edmonton";

function getUtf8ByteSize(value: string): number {
  return Buffer.byteLength(value, "utf8");
}

const THUMB_MAX_DIMENSION = 96;
const THUMB_QUALITY = 75;

// Server-side image validation: the declared data-URL mimetype must be
// JPEG/PNG and must match the file's magic bytes — the client is not trusted.
function decodeImageDataUrl(
  dataUrl: string,
): { buffer: Buffer; mime: "image/jpeg" | "image/png" } | null {
  const match = dataUrl.match(/^data:image\/(jpeg|png);base64,([A-Za-z0-9+/=]+)$/);
  if (!match) return null;

  const declared = `image/${match[1]}` as "image/jpeg" | "image/png";
  let buffer: Buffer;
  try {
    buffer = Buffer.from(match[2], "base64");
  } catch {
    return null;
  }
  if (buffer.length < 8) return null;

  const isJpeg =
    buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  const isPng =
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47;

  if (declared === "image/jpeg" && !isJpeg) return null;
  if (declared === "image/png" && !isPng) return null;

  return { buffer, mime: declared };
}

// The thumbnail stored on the user doc is regenerated here from the uploaded
// image, so a tampered client can never store a thumb that doesn't match.
async function makeAuthoritativeThumb(buffer: Buffer): Promise<string> {
  const out = await sharp(buffer)
    .resize(THUMB_MAX_DIMENSION, THUMB_MAX_DIMENSION, { fit: "inside" })
    // JPEG has no alpha — flatten transparent PNGs onto white, not black.
    .flatten({ background: "#ffffff" })
    .jpeg({ quality: THUMB_QUALITY })
    .toBuffer();
  return `data:image/jpeg;base64,${out.toString("base64")}`;
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

    // IT admins are in read-only "view as" mode on staff pages; they cannot
    // create recipients even by bypassing the UI.
    if (decodedClaims.admin === true) {
      return NextResponse.json(
        { error: "Forbidden - Staff access only" },
        { status: 403 },
      );
    }

    const staffDoc = await adminApp
      .firestore()
      .collection("administrative_staff")
      .doc(decodedClaims.uid)
      .get();

    if (!staffDoc.exists || staffDoc.data()?.isDeleted === true) {
      return NextResponse.json(
        { error: "Forbidden - Staff access only" },
        { status: 403 },
      );
    }

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

    // Validate the image server-side (declared mimetype + magic bytes), then
    // regenerate the thumbnail here — the client-sent thumbnail is ignored.
    const decoded = decodeImageDataUrl(photoUpload.imageUrl);
    if (!decoded) {
      return NextResponse.json(
        { error: "Recipient photo must be a valid JPEG or PNG image." },
        { status: 400 },
      );
    }

    let thumbnail: string | null = null;
    try {
      thumbnail = await makeAuthoritativeThumb(decoded.buffer);
    } catch {
      return NextResponse.json(
        { error: "Recipient photo could not be processed. Please upload a different image." },
        { status: 400 },
      );
    }
    if (getUtf8ByteSize(thumbnail) > MAX_THUMBNAIL_FIELD_BYTES) {
      thumbnail = null;
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
      // Full-res base64 lives in user_photos/{uid}; the user doc only carries
      // the small thumbnail so list queries stay bounded.
      photoThumb: thumbnail,
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
    const photoRef = db.collection("user_photos").doc(userRef.id);
    const photoData = {
      picture: photoUpload.imageUrl, // Full-res base64, served via /api/users/[id]/photo
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    if (!arcCardDigits){
      const batch = db.batch();
      batch.set(userRef, userData);
      batch.set(photoRef, photoData);
      await batch.commit();
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

          tx.set(photoRef, photoData)

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
