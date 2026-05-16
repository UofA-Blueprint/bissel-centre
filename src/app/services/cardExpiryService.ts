import "server-only";

import admin from "firebase-admin";
import { Firestore, Timestamp } from "firebase-admin/firestore";

type ArcCardDoc = {
  status?: string;
};

export async function expireOverdueArcCards(db: Firestore) {
  const now = Timestamp.now();

  // Open issues that should already be expired.
  const overdueIssuesSnapshot = await db
    .collection("issues")
    .where("returnedAt", "==", null)
    .where("expiresAt", "<=", now)
    .get();

  if (overdueIssuesSnapshot.empty) {
    return {
      overdueIssueCount: 0,
      uniqueCardCount: 0,
      updatedCardCount: 0,
    };
  }

  // Get unique card ids from overdue issues.
  const cardIds = Array.from(
    new Set(
      overdueIssuesSnapshot.docs
        .map((doc) => String(doc.data().cardId || "").trim())
        .filter((id) => id.length > 0),
    ),
  );

  if (cardIds.length === 0) {
    return {
      overdueIssueCount: overdueIssuesSnapshot.size,
      uniqueCardCount: 0,
      updatedCardCount: 0,
    };
  }

  const cardRefs = cardIds.map((id) => db.collection("arc_cards").doc(id));
  const cardSnapshots = await db.getAll(...cardRefs);

  // Batch updates (chunked for Firestore limits).
  let updatedCardCount = 0;
  let batch = db.batch();
  let opsInBatch = 0;

  for (const cardSnap of cardSnapshots) {
    if (!cardSnap.exists) continue;

    const card = cardSnap.data() as ArcCardDoc;

    // Only auto-expire cards that are currently Active.
    // This avoids overwriting explicit manual statuses like Cancelled.
    if (card.status !== "Active") continue;

    batch.update(cardSnap.ref, {
      status: "Expired",
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    updatedCardCount += 1;
    opsInBatch += 1;

    if (opsInBatch >= 400) {
      await batch.commit();
      batch = db.batch();
      opsInBatch = 0;
    }
  }

  if (opsInBatch > 0) {
    await batch.commit();
  }

  return {
    overdueIssueCount: overdueIssuesSnapshot.size,
    uniqueCardCount: cardIds.length,
    updatedCardCount,
  };
}