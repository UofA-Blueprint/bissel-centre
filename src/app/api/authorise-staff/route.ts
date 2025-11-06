import { NextRequest, NextResponse } from "next/server";
import { initAdmin } from "@/app/services/firebaseAdmin";
import { cookies } from "next/headers";

export async function POST(request: NextRequest) {
  try {
    // Optional: inspect cookies for debugging
    const cookieStore = await cookies();
    console.log("Cookies:", cookieStore.getAll());

    // Expect Authorization: Bearer <ID_TOKEN>
    const authHeader = request.headers.get("authorization") || "";
    const [scheme, token] = authHeader.split(" ");

    if (scheme?.toLowerCase() !== "bearer" || !token) {
      return NextResponse.json(
        { error: "Missing or invalid Authorization header" },
        { status: 401 }
      );
    }

    const admin = await initAdmin();

    // Verify the ID token to derive a trusted UID
    const decoded = await admin.auth().verifyIdToken(token, true);
    const trustedUid = decoded.uid;

    const db = admin.firestore();

    // Check if staff member exists in the administrative_staff collection
    const staffDocRef = db.collection("administrative_staff").doc(trustedUid);
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
    // If token verification fails, respond with 401
    return NextResponse.json(
      { error: "Failed to authorize staff member" },
      { status: 401 }
    );
  }
}
