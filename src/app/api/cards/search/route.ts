import { NextRequest, NextResponse } from "next/server";
import { initAdmin } from "@/app/services/firebaseAdmin";
import { cookies } from "next/headers";

const MIN_QUERY_LENGTH = 3;
const MAX_RESULTS = 7;

export async function GET(request: NextRequest) {
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
    await app.auth().verifySessionCookie(sessionCookie, true);

    const queryValue =
      request.nextUrl.searchParams.get("query")?.replace(/\D/g, "") ?? "";

    if (queryValue.length < MIN_QUERY_LENGTH) {
      return NextResponse.json({ cards: [] });
    }

    const db = app.firestore();
    const cardsSnapshot = await db
      .collection("arc_cards")
      .where("currentUserId", "==", null)
      .orderBy("arcCardNumber")
      .startAt(queryValue)
      .endAt(`${queryValue}\uf8ff`)
      .limit(MAX_RESULTS)
      .get();

    const cards = cardsSnapshot.docs
      .map((doc) => String(doc.data().arcCardNumber || "").trim())
      .filter((cardNumber) => cardNumber.length > 0);

    return NextResponse.json({ cards });
  } catch (error) {
    console.error("Error searching arc cards:", error);
    return NextResponse.json(
      { error: "Failed to search ARC cards" },
      { status: 500 },
    );
  }
}
