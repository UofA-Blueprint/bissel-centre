import { NextRequest, NextResponse } from "next/server";
import { hashITIDNumber } from "../../../../utils/hashITIDNumber";
import { initAdmin } from "@/app/services/firebaseAdmin";
import admin from "firebase-admin";

const IT_ADMIN_COLLECTION = "it_admin";

export async function POST(request: NextRequest) {
  try {
    console.log("Starting admin verification...");

    let requestBody;
    try {
      requestBody = await request.json();
    } catch (parseError) {
      console.log("Failed to parse JSON:", parseError);
      return NextResponse.json(
        { error: "Invalid JSON in request body" },
        { status: 400 }
      );
    }

    const { identificationNumber } = requestBody || {};
    console.log("Identification number:", identificationNumber);

    if (!identificationNumber || typeof identificationNumber !== "string") {
      return NextResponse.json(
        { error: "Valid identification number is required" },
        { status: 400 }
      );
    }

    const hashedID = hashITIDNumber(identificationNumber);

    const app = await initAdmin();
    const adminDb = admin.firestore(app);

    const snapshot = await adminDb
      .collection(IT_ADMIN_COLLECTION)
      .where("hashedIdentificationNumber", "==", hashedID)
      .limit(1)
      .get();

    console.log("Query completed, snapshot empty:", snapshot.empty);

    if (!snapshot.empty) {
      return NextResponse.json({ success: true, hashedID });
    } else {
      return NextResponse.json(
        { error: "Identification number not found" },
        { status: 404 }
      );
    }
  } catch (error) {
    console.log(
      "Error occurred:",
      error instanceof Error ? error.message : "Unknown error"
    );

    return NextResponse.json(
      { error: "Failed to verify identification number. Please try again." },
      { status: 500 }
    );
  }
}
