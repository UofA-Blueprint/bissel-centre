import { NextRequest, NextResponse } from "next/server";
import { getStaffAccess } from "@/app/api/_lib/staffAccess";

// GET /api/users/[id]/photo — full-resolution photo, loaded lazily as real
// image bytes (Content-Type from the stored data URL). List endpoints only
// ship the small photoThumb; storage in Firestore remains base64.
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const access = await getStaffAccess({
      allowAdmin: true,
      checkRevoked: false,
    });
    if ("error" in access) {
      return NextResponse.json(
        { error: access.error },
        { status: access.status },
      );
    }
    // Hot read path — revocation check skipped (SCALE-05).

    const { id } = await params;
    if (!id) {
      return NextResponse.json(
        { error: "User id is required" },
        { status: 400 },
      );
    }

    const db = access.db;
    const photoDoc = await db.collection("user_photos").doc(id).get();
    let picture = photoDoc.exists ? String(photoDoc.data()?.picture || "") : "";

    // Legacy fallback: users registered before the photo split still carry
    // the full base64 on the user doc.
    if (!picture) {
      const userDoc = await db.collection("users").doc(id).get();
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
    // Raster types only — legacy data predates write-time validation, and
    // serving e.g. image/svg+xml from this origin would be a stored-XSS vector.
    const match = picture.match(
      /^data:(image\/(?:jpeg|png|webp|avif|gif));base64,([A-Za-z0-9+/=]+)$/,
    );
    if (!match) {
      return NextResponse.json(
        { error: "Stored photo is not a supported image format" },
        { status: 415 },
      );
    }

    const body = Buffer.from(match[2], "base64");
    return new Response(new Uint8Array(body), {
      headers: {
        "Content-Type": match[1],
        "Content-Length": String(body.length),
        "Cache-Control": "private, max-age=3600",
        // Belt and braces: never sniff, never script, even if a crafted
        // polyglot image slips through.
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; sandbox",
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
