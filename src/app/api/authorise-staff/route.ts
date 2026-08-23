import { NextRequest, NextResponse } from "next/server";
import { initAdmin } from "@/app/services/firebaseAdmin";
import { cookies } from "next/headers";
import admin from "firebase-admin";

export async function POST(request: NextRequest) {
  try {
    // Optional: inspect cookies for debugging
    const cookieStore = await cookies();

    // Expect Authorization: Bearer <ID_TOKEN>
    const authHeader = request.headers.get("authorization") || "";
    const [scheme, token] = authHeader.split(" ");

    if (scheme?.toLowerCase() !== "bearer" || !token) {
      return NextResponse.json(
        { error: "Missing or invalid Authorization header" },
        { status: 401 },
      );
    }

    const app = await initAdmin();

    // Verify the ID token to derive a trusted UID
    const decoded = await app.auth().verifyIdToken(token, true);
    const trustedUid = decoded.uid;

    const db = app.firestore();

    // Check if staff member exists in the administrative_staff collection
    const staffDocRef = db.collection("administrative_staff").doc(trustedUid);
    const staffDoc = await staffDocRef.get();

    if (!staffDoc.exists || staffDoc.data()?.isDeleted === true) {
      return NextResponse.json(
        { error: "Staff member is not active" },
        { status: 403 },
      );
    }

    const staffData = staffDoc.data();

    // On first successful login, activate onboarding if needed
    if (staffData?.onboardingStatus === "invited") {
      await staffDocRef.update({
        onboardingStatus: "active",
        accountStatus: "active",
        inviteAcceptedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      // Update local staffData for response
      staffData.onboardingStatus = "active";
      staffData.accountStatus = "active";
      staffData.inviteAcceptedAt = new Date(); // For client display only
    }

    return NextResponse.json({
      success: true,
      staff: {
        uid: staffDoc.id,
        email: staffData?.email,
        firstName: staffData?.firstName,
        lastName: staffData?.lastName || staffData?.secondName,
        role: staffData?.role || "staff",
        createdBy: staffData?.createdBy,
        onboardingStatus: staffData?.onboardingStatus,
        inviteAcceptedAt: staffData?.inviteAcceptedAt || null,
      },
    });
  } catch (error) {
    console.error("Staff authorization error:", error);
    // If token verification fails, respond with 401
    return NextResponse.json(
      { error: "Failed to authorize staff member" },
      { status: 401 },
    );
  }
}
