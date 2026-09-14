import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { initAdmin } from "@/app/services/firebaseAdmin";

export async function POST() {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("session")?.value;

    // Revoke the underlying Firebase refresh tokens so the session cannot be
    // reused after logout. Deleting the cookie only clears the client's copy;
    // without revocation a cookie captured before logout stays valid for its
    // full 5-day lifetime on any path that verifies it (and write paths verify
    // with checkRevoked, so this is what actually terminates the session).
    // Best-effort: a revocation failure must never block clearing the cookie.
    if (sessionCookie) {
      try {
        const admin = await initAdmin();
        const decoded = await admin.auth().verifySessionCookie(sessionCookie);
        await admin.auth().revokeRefreshTokens(decoded.uid);
      } catch (revokeError) {
        console.error("Session revocation on logout failed:", revokeError);
      }
    }

    cookieStore.delete("session");

    return NextResponse.json({
      success: true,
      message: "Logged out successfully",
    });
  } catch (error) {
    console.error("Logout error:", error);
    return NextResponse.json({ error: "Failed to logout" }, { status: 500 });
  }
}
