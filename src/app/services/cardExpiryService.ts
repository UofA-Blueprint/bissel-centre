import "server-only";

import admin from "firebase-admin";
import { Firestore, Timestamp } from "firebase-admin/firestore";

type ArcCardDoc = {
  status?: string;
  currentUserId?: string | null;
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

  // Track overdue holders by card so we only expire the card that is
  // currently assigned to that same user (prevents stale issue drift).
  const overdueUserIdsByCard = new Map<string, Set<string>>();
  const overdueIssueRefsByCardAndUser = new Map<
    string,
    admin.firestore.DocumentReference[]
  >();
  for (const issueDoc of overdueIssuesSnapshot.docs) {
    const issue = issueDoc.data() as { cardId?: string; userId?: string };
    const cardId = String(issue.cardId || "").trim();
    const userId = String(issue.userId || "").trim();
    if (!cardId || !userId) continue;
    if (!overdueUserIdsByCard.has(cardId)) {
      overdueUserIdsByCard.set(cardId, new Set<string>());
    }
    overdueUserIdsByCard.get(cardId)!.add(userId);

    const key = `${cardId}::${userId}`;
    const refs = overdueIssueRefsByCardAndUser.get(key) ?? [];
    refs.push(issueDoc.ref);
    overdueIssueRefsByCardAndUser.set(key, refs);
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
  let detachedCardCount = 0;
  let closedIssueCount = 0;
  let reconciledInconsistentCount = 0;
  let batch = db.batch();
  let opsInBatch = 0;
  const processedCardUserKeys = new Set<string>();
  const maybeCommitBatch = async () => {
    if (opsInBatch >= 400) {
      await batch.commit();
      batch = db.batch();
      opsInBatch = 0;
    }
  };

  for (const cardSnap of cardSnapshots) {
    if (!cardSnap.exists) continue;

    const card = cardSnap.data() as ArcCardDoc;

    // Extra safety: only expire if the card's current holder matches an
    // overdue open issue holder for this same card.
    const currentUserId = String(card.currentUserId || "").trim();
    if (!currentUserId) continue;
    const overdueUserIds = overdueUserIdsByCard.get(cardSnap.id);
    if (!overdueUserIds?.has(currentUserId)) continue;

    const issueKey = `${cardSnap.id}::${currentUserId}`;
    const matchingIssueRefs = overdueIssueRefsByCardAndUser.get(issueKey) ?? [];
    if (matchingIssueRefs.length === 0) continue;
    processedCardUserKeys.add(issueKey);

    const cardUpdate: {
      currentUserId: null;
      updatedAt: admin.firestore.FieldValue;
      status?: string;
    } = {
      currentUserId: null,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    // For true active assignments that are overdue, mark status Expired.
    // For already non-active statuses, keep the manual status and only detach.
    if (card.status === "Active") {
      cardUpdate.status = "Expired";
      updatedCardCount += 1;
    }

    batch.update(cardSnap.ref, {
      ...cardUpdate,
    });
    opsInBatch += 1;
    await maybeCommitBatch();

    // Keep user mirror fields in sync when auto-expiring/detaching.
    const userRef = db.collection("users").doc(currentUserId);
    batch.set(
      userRef,
      {
        arcCardNumber: admin.firestore.FieldValue.delete(),
        passesIssued: admin.firestore.FieldValue.arrayUnion(cardSnap.id),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
    opsInBatch += 1;
    await maybeCommitBatch();

    for (const issueRef of matchingIssueRefs) {
      batch.update(issueRef, {
        returnedAt: admin.firestore.FieldValue.serverTimestamp(),
        closedCardStatus: "Expired",
      });
      opsInBatch += 1;
      closedIssueCount += 1;
      await maybeCommitBatch();
    }

    detachedCardCount += 1;
  }

  // Self-heal pass for already-bad states from prior drift:
  // any non-Active card that still has a current holder must be detached.
  const assignedCardsSnapshot = await db
    .collection("arc_cards")
    .where("currentUserId", "!=", null)
    .get();

  for (const cardDoc of assignedCardsSnapshot.docs) {
    const data = cardDoc.data() as ArcCardDoc;
    const currentUserId = String(data.currentUserId || "").trim();
    if (!currentUserId) continue;
    if (data.status === "Active") continue;

    const cardUserKey = `${cardDoc.id}::${currentUserId}`;
    if (processedCardUserKeys.has(cardUserKey)) continue;
    processedCardUserKeys.add(cardUserKey);

    batch.update(cardDoc.ref, {
      currentUserId: null,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    opsInBatch += 1;
    await maybeCommitBatch();

    const userRef = db.collection("users").doc(currentUserId);
    batch.set(
      userRef,
      {
        arcCardNumber: admin.firestore.FieldValue.delete(),
        passesIssued: admin.firestore.FieldValue.arrayUnion(cardDoc.id),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
    opsInBatch += 1;
    await maybeCommitBatch();

    const openIssueSnap = await db
      .collection("issues")
      .where("cardId", "==", cardDoc.id)
      .where("userId", "==", currentUserId)
      .where("returnedAt", "==", null)
      .get();

    for (const issueDoc of openIssueSnap.docs) {
      batch.update(issueDoc.ref, {
        returnedAt: admin.firestore.FieldValue.serverTimestamp(),
        closedCardStatus: data.status || "Unattributed",
      });
      opsInBatch += 1;
      closedIssueCount += 1;
      await maybeCommitBatch();
    }

    detachedCardCount += 1;
    reconciledInconsistentCount += 1;
  }

  if (opsInBatch > 0) {
    await batch.commit();
  }

  return {
    overdueIssueCount: overdueIssuesSnapshot.size,
    uniqueCardCount: cardIds.length,
    updatedCardCount,
    detachedCardCount,
    closedIssueCount,
    reconciledInconsistentCount,
  };
}