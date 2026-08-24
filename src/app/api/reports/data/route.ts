import { NextRequest, NextResponse } from "next/server";
import { initAdmin } from "@/app/services/firebaseAdmin";
import { FieldPath } from "firebase-admin/firestore";
import { cookies } from "next/headers";
import { decryptPhoneSafe } from "@/utils/phoneEncryption";
import type {
  UserReportRow,
  CardHistoryEntry,
  ActivityEntry,
  ReportCardRow,
} from "@/app/(app)/reports/types";

// One page of users per request; the client walks pages. Joins are bounded
// in-queries per page — no full-collection scans anywhere on this route.
export const maxDuration = 60;

const DEFAULT_PAGE_SIZE = 200;
const MAX_PAGE_SIZE = 500;

async function verifyStaffAccess(options?: { allowAdmin?: boolean }) {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("session")?.value;

  if (!sessionCookie) {
    return {
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  const app = await initAdmin();
  // Hot read path — revocation check skipped (SCALE-05).
  const decodedClaims = await app
    .auth()
    .verifySessionCookie(sessionCookie);

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

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

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

const CARD_FIELDS = [
  "arcCardNumber",
  "securityCode",
  "department",
  "status",
  "allocationDate",
  "currentUserId",
  "userId",
  "passRecipient",
  "issueDates",
  "notes",
  "createdAt",
  "updatedAt",
] as const;

export async function GET(request: NextRequest) {
  try {
    const access = await verifyStaffAccess({ allowAdmin: true });
    if ("error" in access) return access.error;
    const { db } = access;

    const sp = request.nextUrl.searchParams;
    const limitParam = Number.parseInt(sp.get("limit") ?? "", 10);
    const pageSize = Number.isFinite(limitParam)
      ? Math.min(MAX_PAGE_SIZE, Math.max(1, limitParam))
      : DEFAULT_PAGE_SIZE;
    const cursorId = sp.get("cursor");

    // ── One page of users (photos never selected) ────────────────
    let usersQuery = db
      .collection("users")
      .select(
        "firstName",
        "secondName",
        "email",
        "phoneNumber",
        "phone",
        "status",
        "banned",
        "banReason",
        "genderIdentity",
        "dateOfBirth",
        "address",
        "postalCode",
        "notes",
        "createdAt",
        "passesIssued",
      )
      .orderBy(FieldPath.documentId())
      .limit(pageSize + 1);
    if (cursorId) usersQuery = usersQuery.startAfter(cursorId);

    const [usersSnapshot, migrationDoc] = await Promise.all([
      usersQuery.get(),
      db.collection("_migrations").doc("issues_v1").get(),
    ]);
    const isMigrated = migrationDoc.exists;
    const hasMore = usersSnapshot.size > pageSize;
    const pageDocs = usersSnapshot.docs.slice(0, pageSize);
    const pageUserIds = pageDocs.map((d) => d.id);
    const nextCursor =
      hasMore && pageDocs.length > 0 ? pageDocs[pageDocs.length - 1].id : null;

    // ── Per-page joins: banned, history, issues by userId ────────
    const bannedDocs: FirebaseFirestore.QueryDocumentSnapshot[] = [];
    const historyDocs: FirebaseFirestore.QueryDocumentSnapshot[] = [];
    const issueDocs: FirebaseFirestore.QueryDocumentSnapshot[] = [];
    await Promise.all(
      chunk(pageUserIds, 30).flatMap((part) => {
        if (part.length === 0) return [];
        return [
          db
            .collection("banned_users")
            .where("userId", "in", part)
            .select("userId", "banReason", "bannedAt", "bannedBy")
            .get()
            .then((s) => bannedDocs.push(...s.docs)),
          db
            .collection("history")
            .where("userId", "in", part)
            .select("userId", "date", "event", "notes", "modifiedBy", "reason")
            .get()
            .then((s) => historyDocs.push(...s.docs)),
          db
            .collection("issues")
            .where("userId", "in", part)
            .select("cardId", "userId", "issueDate")
            .get()
            .then((s) => issueDocs.push(...s.docs)),
        ];
      }),
    );

    // ── Cards relevant to this page: current holders + passesIssued
    //    references + cards named by this page's issues ────────────
    const cardDocById = new Map<
      string,
      FirebaseFirestore.QueryDocumentSnapshot
    >();
    const referencedCardIds = new Set<string>();
    for (const doc of pageDocs) {
      const passes = doc.data().passesIssued;
      if (Array.isArray(passes)) {
        for (const value of passes) {
          const id = normalizeId(value);
          if (id) referencedCardIds.add(id);
        }
      }
    }
    for (const doc of issueDocs) {
      const id = normalizeId(doc.data().cardId);
      if (id) referencedCardIds.add(id);
    }

    await Promise.all([
      ...chunk(pageUserIds, 30).map(async (part) => {
        if (part.length === 0) return;
        const snap = await db
          .collection("arc_cards")
          .where("currentUserId", "in", part)
          .select(...CARD_FIELDS)
          .get();
        for (const doc of snap.docs) cardDocById.set(doc.id, doc);
      }),
      ...chunk(Array.from(referencedCardIds), 30).map(async (part) => {
        if (part.length === 0) return;
        const snap = await db
          .collection("arc_cards")
          .where(FieldPath.documentId(), "in", part)
          .select(...CARD_FIELDS)
          .get();
        for (const doc of snap.docs) cardDocById.set(doc.id, doc);
      }),
    ]);
    const cardDocs = Array.from(cardDocById.values());

    // ── Build lookup maps (page-scoped) ──────────────────────────
    const userNameById = new Map<string, string>();
    const passesIssuedByUser = new Map<string, string[]>();
    for (const userDoc of pageDocs) {
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

    const bannedMap = new Map<
      string,
      { reason: string; bannedAt: string | null; bannedBy: string }
    >();
    for (const doc of bannedDocs) {
      const d = doc.data();
      const bannedAt = toIsoString(d.bannedAt) || null;
      bannedMap.set(d.userId, {
        reason: d.banReason || "",
        bannedAt,
        bannedBy: d.bannedBy || "",
      });
    }

    const historyMap = new Map<string, ActivityEntry[]>();
    for (const doc of historyDocs) {
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
    for (const entries of historyMap.values()) {
      entries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }

    const cardDocsById = new Map<string, FirebaseFirestore.DocumentData>();
    for (const cardDoc of cardDocs) {
      cardDocsById.set(cardDoc.id, cardDoc.data());
    }

    const issueDatesByCard = new Map<string, string[]>();
    const userCardIssueDates = new Map<string, string[]>();
    for (const issueDoc of issueDocs) {
      const d = issueDoc.data() as {
        cardId?: unknown;
        userId?: unknown;
        issueDate?: string;
      };
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

    // ── Per-user card history ────────────────────────────────────
    const cardsByUser = new Map<string, CardHistoryEntry[]>();
    const userCardEntries = new Map<string, Map<string, CardHistoryEntry>>();
    const ensureUserCardEntry = (
      userId: string,
      cardId: string,
    ): CardHistoryEntry => {
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

    if (isMigrated) {
      for (const [userCardKey, dates] of userCardIssueDates.entries()) {
        const splitAt = userCardKey.indexOf("::");
        const userId = userCardKey.slice(0, splitAt);
        const cardId = userCardKey.slice(splitAt + 2);
        const entry = ensureUserCardEntry(userId, cardId);
        entry.issueDates.push(...dates);
      }
    }

    for (const cardDoc of cardDocs) {
      const d = cardDoc.data() as { currentUserId?: unknown; userId?: unknown };
      const holderId = normalizeId(d.currentUserId) || normalizeId(d.userId);
      if (!holderId || !userNameById.has(holderId)) continue;
      ensureUserCardEntry(holderId, cardDoc.id);
    }

    for (const [userId, passCardIds] of passesIssuedByUser.entries()) {
      for (const cardId of passCardIds) {
        if (!cardDocsById.has(cardId)) continue;
        ensureUserCardEntry(userId, cardId);
      }
    }

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

    // ── Page-relevant card export rows ───────────────────────────
    const pageCards: ReportCardRow[] = [];
    for (const cardDoc of cardDocs) {
      const d = cardDoc.data();
      const issueDates = [
        ...(issueDatesByCard.get(cardDoc.id) || []),
        ...(Array.isArray(d.issueDates) ? d.issueDates : []),
      ]
        .filter((date) => typeof date === "string" && date.length > 0)
        .sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
      const currentUserId =
        normalizeId(d.currentUserId) || normalizeId(d.userId) || null;
      pageCards.push({
        cardId: cardDoc.id,
        cardNumber: d.arcCardNumber || "",
        securityCode: d.securityCode || "",
        department: d.department || "",
        status: d.status || "Unloaded",
        allocationDate: d.allocationDate || "",
        currentUserId,
        currentUserName: currentUserId
          ? userNameById.get(currentUserId) || ""
          : "",
        issueDates,
        notes: d.notes || "",
        createdAt: toIsoString(d.createdAt),
        updatedAt: toIsoString(d.updatedAt),
      });
    }

    const currentCardByUser = new Map<
      string,
      { cardNumber: string; department: string }
    >();
    for (const card of pageCards) {
      if (!card.currentUserId) continue;
      const existing = currentCardByUser.get(card.currentUserId);
      if (!existing || card.status === "Active") {
        currentCardByUser.set(card.currentUserId, {
          cardNumber: card.cardNumber,
          department: card.department,
        });
      }
    }

    // ── User rows ────────────────────────────────────────────────
    const rows: UserReportRow[] = [];
    for (const doc of pageDocs) {
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
        // users.phone holds AES-GCM ciphertext (see encryptPhone in
        // register-recipient) — decrypt for display; on any failure
        // (bad ciphertext OR missing key) this yields "", never the
        // raw ciphertext and never a 500.
        phoneNumber: d.phoneNumber || decryptPhoneSafe(d.phone ?? null) || "",
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

    return NextResponse.json({ users: rows, cards: pageCards, nextCursor });
  } catch (error) {
    console.error("Reports data error:", error);
    return NextResponse.json(
      { error: "Failed to fetch report data" },
      { status: 500 }
    );
  }
}
