"use server";

import { NextResponse } from "next/server";
import { initAdmin } from "@/app/services/firebaseAdmin";
import { cookies } from "next/headers";
import type {
  UserReportRow,
  CardHistoryEntry,
  ActivityEntry,
  ReportCardRow,
} from "@/app/(app)/reports/types";

async function verifyStaffAccess(options?: { allowAdmin?: boolean }) {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("session")?.value;

  if (!sessionCookie) {
    return {
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  const app = await initAdmin();
  const decodedClaims = await app
    .auth()
    .verifySessionCookie(sessionCookie, true);

  const db = app.firestore();

  if (decodedClaims.admin === true) {
    if (options?.allowAdmin) {
      return { app, db, role: "admin" as const };
    }
    return {
      error: NextResponse.json(
        { error: "Forbidden - Staff access only" },
        { status: 403 }
      ),
    };
  }

  const staffDoc = await db
    .collection("administrative_staff")
    .doc(decodedClaims.uid)
    .get();

  if (!staffDoc.exists || staffDoc.data()?.isDeleted === true) {
    return {
      error: NextResponse.json(
        { error: "Forbidden - Staff access only" },
        { status: 403 }
      ),
    };
  }

  return { app, db, role: "staff" as const };
}

export async function GET() {
  try {
    const access = await verifyStaffAccess({ allowAdmin: true });
    if ("error" in access) return access.error;
    const { db } = access;

    const [usersSnapshot, cardsSnapshot, issuesSnapshot, bannedSnapshot, historySnapshot, migrationDoc] =
      await Promise.all([
        db.collection("users").get(),
        db.collection("arc_cards").get(),
        db.collection("issues").get(),
        db.collection("banned_users").get(),
        db.collection("history").get(),
        db.collection("_migrations").doc("issues_v1").get(),
      ]);

    const isMigrated = migrationDoc.exists;

    const toIsoString = (value: unknown): string => {
      if (!value) return "";
      if (typeof value === "string") return value;
      if (value instanceof Date) return value.toISOString();
      if (typeof value === "object" && value !== null && "toDate" in value) {
        const candidate = value as { toDate?: () => Date };
        const date = candidate.toDate?.();
        if (date instanceof Date) return date.toISOString();
      }
      return String(value);
    };

    const normalizeId = (value: unknown): string => {
      if (!value) return "";
      if (typeof value === "string") return value.trim();
      if (typeof value === "object" && value !== null) {
        if ("id" in value && typeof (value as { id?: unknown }).id === "string") {
          return ((value as { id: string }).id || "").trim();
        }
      }
      return "";
    };

    // Index users for quick lookups
    const userNameById = new Map<string, string>();
    const passesIssuedByUser = new Map<string, string[]>();
    for (const userDoc of usersSnapshot.docs) {
      const d = userDoc.data();
      userNameById.set(
        userDoc.id,
        `${d.firstName || ""} ${d.secondName || ""}`.trim()
      );
      const passIds = Array.isArray(d.passesIssued)
        ? d.passesIssued
            .map((value: unknown) => normalizeId(value))
            .filter((id: string) => id.length > 0)
        : [];
      passesIssuedByUser.set(userDoc.id, passIds);
    }

    // Index banned users by userId
    const bannedMap = new Map<string, { reason: string; bannedAt: string | null; bannedBy: string }>();
    for (const doc of bannedSnapshot.docs) {
      const d = doc.data();
      const bannedAt = toIsoString(d.bannedAt) || null;
      bannedMap.set(d.userId, {
        reason: d.banReason || "",
        bannedAt,
        bannedBy: d.bannedBy || "",
      });
    }

    // Index history entries by userId
    const historyMap = new Map<string, ActivityEntry[]>();
    for (const doc of historySnapshot.docs) {
      const d = doc.data();
      if (!d.userId) continue;
      if (!historyMap.has(d.userId)) historyMap.set(d.userId, []);
      const date = toIsoString(d.date);
      historyMap.get(d.userId)!.push({
        date,
        event: d.event || "",
        notes: d.notes || "",
        modifiedBy: d.modifiedBy || "",
        reason: d.reason,
      });
    }

    // Sort history entries per user (newest first)
    for (const entries of historyMap.values()) {
      entries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }

    // Build card data per user and complete card list.
    const cardsByUser = new Map<string, CardHistoryEntry[]>();
    const allCards: ReportCardRow[] = [];

    const cardDocsById = new Map<string, FirebaseFirestore.DocumentData>();
    for (const cardDoc of cardsSnapshot.docs) {
      cardDocsById.set(cardDoc.id, cardDoc.data());
    }

    // Build history from both schemas (old + migrated) so we don't depend on
    // migration marker docs being present.
    const issueDatesByCard = new Map<string, string[]>();
    const userCardIssueDates = new Map<string, string[]>();

    for (const issueDoc of issuesSnapshot.docs) {
      const d = issueDoc.data() as { cardId?: unknown; userId?: unknown; issueDate?: string };
      const cardId = normalizeId(d.cardId);
      const userId = normalizeId(d.userId);
      if (!cardId) continue;
      const issueDate = d.issueDate || "";
      if (!issueDatesByCard.has(cardId)) issueDatesByCard.set(cardId, []);
      if (issueDate) issueDatesByCard.get(cardId)!.push(issueDate);
      if (userId) {
        const key = `${userId}::${cardId}`;
        if (!userCardIssueDates.has(key)) userCardIssueDates.set(key, []);
        if (issueDate) userCardIssueDates.get(key)!.push(issueDate);
      }
    }

    const userCardEntries = new Map<string, Map<string, CardHistoryEntry>>();
    const ensureUserCardEntry = (userId: string, cardId: string): CardHistoryEntry => {
      if (!userCardEntries.has(userId)) userCardEntries.set(userId, new Map());
      const perUser = userCardEntries.get(userId)!;
      if (!perUser.has(cardId)) {
        const cardDoc = cardDocsById.get(cardId);
        perUser.set(cardId, {
          cardId,
          cardNumber: cardDoc?.arcCardNumber || "",
          department: cardDoc?.department || "",
          status: cardDoc?.status || "Unloaded",
          allocationDate: cardDoc?.allocationDate || "",
          securityCode: cardDoc?.securityCode || "",
          notes: cardDoc?.notes || "",
          currentUserId: cardDoc?.currentUserId || cardDoc?.userId || null,
          currentUserName:
            cardDoc?.currentUserId || cardDoc?.userId
              ? userNameById.get(cardDoc?.currentUserId || cardDoc?.userId) || ""
              : "",
          createdAt: toIsoString(cardDoc?.createdAt),
          updatedAt: toIsoString(cardDoc?.updatedAt),
          issueDates: [],
        });
      }
      return perUser.get(cardId)!;
    };

    // Migrated issues linkage
    for (const [userCardKey, dates] of userCardIssueDates.entries()) {
      const splitAt = userCardKey.indexOf("::");
      const userId = userCardKey.slice(0, splitAt);
      const cardId = userCardKey.slice(splitAt + 2);
      const entry = ensureUserCardEntry(userId, cardId);
      entry.issueDates.push(...dates);
    }

    // Current holder linkage (old + new schema)
    for (const cardDoc of cardsSnapshot.docs) {
      const d = cardDoc.data() as { currentUserId?: unknown; userId?: unknown };
      const holderId = normalizeId(d.currentUserId) || normalizeId(d.userId);
      if (!holderId) continue;
      ensureUserCardEntry(holderId, cardDoc.id);
    }

    // Fallback linkage from passesIssued
    for (const [userId, passCardIds] of passesIssuedByUser.entries()) {
      for (const cardId of passCardIds) {
        if (!cardDocsById.has(cardId)) continue;
        ensureUserCardEntry(userId, cardId);
      }
    }

    // Materialize user card history
    for (const [userId, cardMap] of userCardEntries.entries()) {
      cardsByUser.set(
        userId,
        Array.from(cardMap.values()).map((entry) => ({
          ...entry,
          issueDates: [...entry.issueDates].sort(
            (a, b) => new Date(b).getTime() - new Date(a).getTime()
          ),
        }))
      );
    }

    // Build complete cards export rows (include old and new issueDates)
    for (const cardDoc of cardsSnapshot.docs) {
      const d = cardDoc.data();
      const issueDates = [
        ...(issueDatesByCard.get(cardDoc.id) || []),
        ...(Array.isArray(d.issueDates) ? d.issueDates : []),
      ]
        .filter((date) => typeof date === "string" && date.length > 0)
        .sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
      const currentUserId =
        normalizeId(d.currentUserId) || normalizeId(d.userId) || null;
      allCards.push({
        cardId: cardDoc.id,
        cardNumber: d.arcCardNumber || "",
        securityCode: d.securityCode || "",
        department: d.department || "",
        status: d.status || "Unloaded",
        allocationDate: d.allocationDate || "",
        currentUserId,
        currentUserName: currentUserId ? userNameById.get(currentUserId) || "" : "",
        issueDates,
        notes: d.notes || "",
        createdAt: toIsoString(d.createdAt),
        updatedAt: toIsoString(d.updatedAt),
      });
    }

    const currentCardByUser = new Map<string, { cardNumber: string; department: string }>();
    for (const card of allCards) {
      if (!card.currentUserId) continue;
      const existing = currentCardByUser.get(card.currentUserId);
      if (!existing || card.status === "Active") {
        currentCardByUser.set(card.currentUserId, {
          cardNumber: card.cardNumber,
          department: card.department,
        });
      }
    }

    // Build user rows
    const rows: UserReportRow[] = [];
    for (const doc of usersSnapshot.docs) {
      const d = doc.data();
      const userId = doc.id;
      const bannedInfo = bannedMap.get(userId);
      const cards = cardsByUser.get(userId) || [];
      const history = historyMap.get(userId) || [];

      const createdAt = toIsoString(d.createdAt);
      const passesIssued = Array.isArray(d.passesIssued)
        ? d.passesIssued.filter((value: unknown) => typeof value === "string")
        : [];
      const currentCard = currentCardByUser.get(userId);

      rows.push({
        userId,
        firstName: d.firstName || "",
        lastName: d.secondName || "",
        email: d.email || "",
        phoneNumber: d.phoneNumber || d.phone || "",
        status: d.status || (d.banned ? "Inactive" : "Active"),
        banned: d.banned || false,
        banReason: bannedInfo?.reason || d.banReason || "",
        bannedAt: bannedInfo?.bannedAt || null,
        bannedBy: bannedInfo?.bannedBy || "",
        genderIdentity: d.genderIdentity || "",
        dateOfBirth: d.dateOfBirth || "",
        address: d.address || "",
        postalCode: d.postalCode || "",
        notes: d.notes || "",
        createdAt,
        totalCardsIssued: passesIssued.length,
        currentArcCard: currentCard?.cardNumber || "",
        currentArcCardDepartment: currentCard?.department || "",
        cardHistory: cards,
        activityHistory: history,
      });
    }

    // Sort by last name, then first name
    rows.sort((a, b) => {
      const lastCmp = a.lastName.localeCompare(b.lastName);
      return lastCmp !== 0 ? lastCmp : a.firstName.localeCompare(b.firstName);
    });

    allCards.sort((a, b) => a.cardNumber.localeCompare(b.cardNumber));

    return NextResponse.json({ users: rows, cards: allCards });
  } catch (error) {
    console.error("Reports data error:", error);
    return NextResponse.json(
      { error: "Failed to fetch report data" },
      { status: 500 }
    );
  }
}
