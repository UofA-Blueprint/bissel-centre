import { NextRequest, NextResponse } from "next/server";
import { initAdmin } from "@/app/services/firebaseAdmin";
import { expireOverdueArcCards } from "@/app/services/cardExpiryService";

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

    // 3) Run expiry sync logic (you already created/are creating this service)
    const result = await expireOverdueArcCards(db);

    // 4) Return useful debug info
    return NextResponse.json({
      success: true,
      ranAt: new Date().toISOString(),
      ...result,
    });
  } catch (error) {
    console.error("Expire cards cron failed:", error);
    return NextResponse.json(
      { error: "Failed to expire overdue cards" },
      { status: 500 },
    );
  }
}