import { NextRequest, NextResponse } from "next/server";
import { initAdmin } from "@/app/services/firebaseAdmin";
import { expireOverdueArcCards } from "@/app/services/cardExpiryService";

// The sweep is bounded per batch but a 10k-card month is ~25 sequential
// commits — give it headroom well past the default timeout.
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  try {
    // 1) Security: only allow authorized cron calls in production
    const cronSecret = process.env.CRON_SECRET;
    const authHeader = request.headers.get("authorization");

    if (process.env.NODE_ENV === "production") {
      if (!cronSecret) {
        return NextResponse.json(
          { error: "CRON_SECRET is not configured" },
          { status: 500 },
        );
      }

      if (authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json(
          { error: "Unauthorized cron request" },
          { status: 401 },
        );
      }
    }

    // 2) Connect to Firestore Admin SDK
    const app = await initAdmin();
    const db = app.firestore();

    // 3) Run monthly unload sync logic (?dryRun=1 reports without writing)
    const dryRun = request.nextUrl.searchParams.get("dryRun") === "1";
    const result = await expireOverdueArcCards(db, { dryRun });

    // 4) Return useful debug info
    return NextResponse.json({
      success: true,
      ranAt: new Date().toISOString(),
      ...result,
    });
  } catch (error) {
    console.error("Expire cards cron failed:", error);
    return NextResponse.json(
      { error: "Failed to run monthly ARC card unload" },
      { status: 500 },
    );
  }
}