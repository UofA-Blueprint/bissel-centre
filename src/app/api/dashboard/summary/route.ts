import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { initAdmin } from "@/app/services/firebaseAdmin";
import { getDashboardSummaryForViewer } from "@/app/services/dashboardService";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("session")?.value;

    if (!sessionCookie) {
      return NextResponse.json(
        { error: "Unauthorized - No session found" },
        { status: 401 },
      );
    }

    const app = await initAdmin();
    const decodedClaims = await app
      .auth()
      .verifySessionCookie(sessionCookie, true);

    const isAdmin = decodedClaims.admin === true;

    if (!isAdmin) {
      const staffDoc = await app
        .firestore()
        .collection("administrative_staff")
        .doc(decodedClaims.uid)
        .get();

      if (!staffDoc.exists || staffDoc.data()?.isDeleted === true) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    const summary = await getDashboardSummaryForViewer({
      uid: decodedClaims.uid,
      email: decodedClaims.email || "",
      name: decodedClaims.name || "",
    }, app.firestore());
    return NextResponse.json(summary);
  } catch (error) {
    console.error("Error fetching dashboard summary:", error);
    return NextResponse.json(
      { error: "Failed to fetch dashboard summary" },
      { status: 500 },
    );
  }
}
