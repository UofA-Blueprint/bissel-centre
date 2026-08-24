import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { initAdmin } from "@/app/services/firebaseAdmin";

// GET /api/users/[id]/photo — full-resolution photo, loaded lazily as real
// image bytes (Content-Type from the stored data URL). List endpoints only
// ship the small photoThumb; storage in Firestore remains base64.
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
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

    if (decodedClaims.admin !== true) {
      const staffDoc = await app
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
    }

    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "User id is required" }, { status: 400 });
    }

    const db = app.firestore();
    const photoDoc = await db.collection("user_photos").doc(id).get();
    let picture = photoDoc.exists
      ? String(photoDoc.data()?.picture || "")
      : "";

    // Legacy fallback: users registered before the photo split still carry
    // the full base64 on the user doc.
    if (!picture) {
      const userDoc = await db
        .collection("users")
        .doc(id)
        .get();
      picture = userDoc.exists ? String(userDoc.data()?.picture || "") : "";
    }

    if (!picture) {
      return NextResponse.json({ error: "No photo found" }, { status: 404 });
    }

    // Legacy seed data stores a plain URL — send the browser there directly.
    if (/^https?:\/\//.test(picture)) {
      return NextResponse.redirect(picture, 302);
    }

    // Stored value is a base64 data URL; decode and serve real image bytes so
    // <img src="/api/users/{id}/photo"> works with native browser caching
    // (~25% smaller transfer than base64-in-JSON).
    const match = picture.match(/^data:(image\/[a-z+.-]+);base64,([A-Za-z0-9+/=]+)$/);
    if (!match) {
      return NextResponse.json({ error: "Stored photo is invalid" }, { status: 500 });
    }

    const body = Buffer.from(match[2], "base64");
    return new Response(new Uint8Array(body), {
      headers: {
        "Content-Type": match[1],
        "Content-Length": String(body.length),
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (error) {
    console.error("Error fetching user photo:", error);
    return NextResponse.json(
      { error: "Failed to fetch user photo" },
      { status: 500 },
    );
  }
}
