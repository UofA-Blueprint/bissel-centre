import { NextRequest, NextResponse } from "next/server";
import { initAdmin } from "@/app/services/firebaseAdmin";

export async function POST(request: NextRequest) {
  try {
    const { uid } = await request.json();

    if (!uid) {
      return NextResponse.json({ error: "Missing UID" }, { status: 400 });
    }

    const admin = await initAdmin();
    const db = admin.firestore();

    // Check if staff member exists in the administrative_staff collection
    const staffDocRef = db.collection("administrative_staff").doc(uid);
    const staffDoc = await staffDocRef.get();

    if (!staffDoc.exists) {
      return NextResponse.json(
        { error: "Staff member not found in administrative staff" },
        { status: 403 }
      );
    }

    const staffData = staffDoc.data();

    return NextResponse.json({
      success: true,
      staff: {
        uid: staffDoc.id,
        email: staffData?.email,
        firstName: staffData?.firstName,
        lastName: staffData?.lastName || staffData?.secondName,
        role: staffData?.role || "staff",
        createdBy: staffData?.createdBy,
      },
    });
  } catch (error) {
    console.error("Staff authorization error:", error);
    return NextResponse.json(
      { error: "Failed to authorize staff member" },
      { status: 500 }
    );
  }
}
