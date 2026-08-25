import "server-only";

import { FieldPath, Timestamp } from "firebase-admin/firestore";
import type { Firestore } from "firebase-admin/firestore";

export interface DashboardStat {
  icon: string;
  number: number;
  label: string;
}

export interface DashboardUser {
  id: string;
  firstName: string;
  secondName: string;
  picture?: string;
  genderIdentity: string;
  aliases: string[];
  dateOfBirth: string;
  address: string;
  postalCode: string;
  passesIssued: string[];
  banned: boolean;
  flagged?: boolean;
  flagReason?: string;
  banReason?: string;
  notes?: string;
  status?: "Active" | "Inactive";
  createdAt: Date | string;
  createdBy: string;
  updatedAt?: Date | string;
  email?: string;
  phoneNumber?: string;
  arcCardStatus: "Active" | "Unattributed" | "Expired" | "Unloaded" | undefined;
  lastIssued: string;
}

export interface DashboardSummary {
  viewer: {
    uid: string;
    email: string;
    name: string;
  };
  stats: DashboardStat[];
  users: DashboardUser[];
  nextCursor: string | null;
  total: number;
}

const DEFAULT_PAGE_SIZE = 60;
const MAX_PAGE_SIZE = 200;

const toDateOrNull = (value: unknown): Date | null => {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === "object" && value !== null && "toDate" in value) {
    const candidate = value as { toDate?: () => Date };
    const converted = candidate.toDate?.();
    if (converted instanceof Date && !Number.isNaN(converted.getTime())) {
      return converted;
    }
  }

  if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  return null;
};

const toDateString = (value: Date): string => {
  const mm = String(value.getMonth() + 1).padStart(2, "0");
  const dd = String(value.getDate()).padStart(2, "0");
  const yy = String(value.getFullYear()).slice(-2);
  return `${mm}/${dd}/${yy}`;
};

// Cursor: [createdAt seconds, createdAt nanos, doc id] — exact Timestamp
// precision so no doc is skipped or duplicated across pages.
function encodeUsersCursor(createdAt: Timestamp, id: string): string {
  return Buffer.from(
    JSON.stringify([createdAt.seconds, createdAt.nanoseconds, id]),
    "utf8",
  ).toString("base64url");
}

function decodeUsersCursor(raw: string | null): [Timestamp, string] | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(Buffer.from(raw, "base64url").toString("utf8"));
    if (
      Array.isArray(parsed) &&
      typeof parsed[0] === "number" &&
      typeof parsed[1] === "number" &&
      typeof parsed[2] === "string"
    ) {
      return [new Timestamp(parsed[0], parsed[1]), parsed[2]];
    }
  } catch {
    /* malformed — treat as first page */
  }
  return null;
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

// Cursor-paged dashboard summary. Stats come from count() aggregates; the
// user list is one page (newest first) with card/issue state joined via
// bounded `in` queries — cost is O(page size), never O(collection).
export async function getDashboardSummaryForViewer(
  viewer: {
    uid: string;
    email: string;
    name: string;
  },
  db: Firestore,
  page?: { limit?: number; cursor?: string | null },
): Promise<DashboardSummary> {
  const pageSize = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, page?.limit ?? DEFAULT_PAGE_SIZE),
  );
  const cursor = decodeUsersCursor(page?.cursor ?? null);

  let usersQuery = db
    .collection("users")
    // photoThumb (small base64) is the only image data lists ever ship; the
    // full-res base64 lives in user_photos and loads lazily per recipient.
    .select(
      "firstName",
      "secondName",
      "photoThumb",
      "aliases",
      "banned",
      "flagged",
      "flagReason",
      "banReason",
      "status",
      "email",
      "createdAt",
      "updatedAt",
      "createdBy",
      "dateOfBirth",
    )
    .orderBy("createdAt", "desc")
    // Tiebreak direction must match the primary sort or Firestore demands a
    // composite index; desc/desc rides the automatic single-field index.
    .orderBy(FieldPath.documentId(), "desc")
    .limit(pageSize + 1);
  if (cursor) usersQuery = usersQuery.startAfter(cursor[0], cursor[1]);

  const [
    usersSnapshot,
    totalUsersAgg,
    totalCardsAgg,
    activeCardsAgg,
    expiredCardsAgg,
    flaggedUsersAgg,
    bannedUsersAgg,
  ] = await Promise.all([
    usersQuery.get(),
    db.collection("users").count().get(),
    db.collection("arc_cards").count().get(),
    db.collection("arc_cards").where("status", "==", "Active").count().get(),
    db.collection("arc_cards").where("status", "==", "Expired").count().get(),
    db.collection("users").where("flagged", "==", true).count().get(),
    db.collection("banned_users").count().get(),
  ]);

  const hasMore = usersSnapshot.size > pageSize;
  const pageDocs = usersSnapshot.docs.slice(0, pageSize);
  const pageUserIds = pageDocs.map((d) => d.id);

  // ── Per-page joins ─────────────────────────────────────────────
  const activeCardByUserId = new Map<string, "Active">();
  const unloadedAssignedCardByUserId = new Map<string, "Unloaded">();
  const latestIssueDateByUserId = new Map<string, Date>();
  const latestIssueCardIdByUserId = new Map<string, string>();
  const latestIssueReturnedAtByUserId = new Map<string, unknown>();
  const latestIssueClosedStatusByUserId = new Map<string, string | undefined>();

  await Promise.all(
    chunk(pageUserIds, 30).flatMap((part) => {
      if (part.length === 0) return [];
      return [
        db
          .collection("arc_cards")
          .where("currentUserId", "in", part)
          .select("status", "currentUserId")
          .get()
          .then((snap) => {
            for (const doc of snap.docs) {
              const d = doc.data() as {
                status?: string;
                currentUserId?: string | null;
              };
              if (!d.currentUserId) continue;
              if (d.status === "Active") {
                activeCardByUserId.set(d.currentUserId, "Active");
              } else if (d.status === "Unloaded") {
                unloadedAssignedCardByUserId.set(d.currentUserId, "Unloaded");
              }
            }
          }),
        db
          .collection("issues")
          .where("userId", "in", part)
          .select(
            "userId",
            "cardId",
            "createdAt",
            "returnedAt",
            "closedCardStatus",
          )
          .get()
          .then((snap) => {
            for (const doc of snap.docs) {
              const issue = doc.data() as {
                userId?: string;
                cardId?: string;
                createdAt?: unknown;
                returnedAt?: unknown;
                closedCardStatus?: string;
              };
              if (!issue.userId) continue;
              const createdAt = toDateOrNull(issue.createdAt);
              if (!createdAt) continue;
              const existing = latestIssueDateByUserId.get(issue.userId);
              if (!existing || createdAt > existing) {
                latestIssueDateByUserId.set(issue.userId, createdAt);
                if (issue.cardId) {
                  latestIssueCardIdByUserId.set(issue.userId, issue.cardId);
                }
                latestIssueReturnedAtByUserId.set(
                  issue.userId,
                  issue.returnedAt,
                );
                latestIssueClosedStatusByUserId.set(
                  issue.userId,
                  issue.closedCardStatus,
                );
              }
            }
          }),
      ];
    }),
  );

  // Status of the cards referenced by latest issues (bounded by page size).
  const cardStatusByCardId = new Map<string, string>();
  const latestCardIds = Array.from(new Set(latestIssueCardIdByUserId.values()));
  await Promise.all(
    chunk(latestCardIds, 30).map(async (part) => {
      if (part.length === 0) return;
      const snap = await db
        .collection("arc_cards")
        .where(FieldPath.documentId(), "in", part)
        .select("status")
        .get();
      for (const doc of snap.docs) {
        cardStatusByCardId.set(doc.id, String(doc.data().status ?? ""));
      }
    }),
  );

  const users: DashboardUser[] = pageDocs.map((doc) => {
    const data = doc.data();
    const latestIssueDate = latestIssueDateByUserId.get(doc.id);
    const latestIssueCardId = latestIssueCardIdByUserId.get(doc.id);
    const latestIssueCardStatus = latestIssueCardId
      ? cardStatusByCardId.get(latestIssueCardId)
      : undefined;
    const latestIssueReturnedAt = latestIssueReturnedAtByUserId.get(doc.id);
    const latestIssueClosedStatus = latestIssueClosedStatusByUserId.get(doc.id);
    const hasActiveCard = activeCardByUserId.has(doc.id);
    const hasUnloadedAssignedCard = unloadedAssignedCardByUserId.has(doc.id);
    const userAccountStatus =
      data.status === "Inactive" ? "Inactive" : "Active";
    let cardStatusForDashboard: DashboardUser["arcCardStatus"] = undefined;
    if (hasActiveCard) {
      cardStatusForDashboard = "Active";
    } else if (hasUnloadedAssignedCard) {
      cardStatusForDashboard = "Unloaded";
    } else if (latestIssueReturnedAt && latestIssueClosedStatus === "Expired") {
      cardStatusForDashboard = "Expired";
    } else if (!latestIssueReturnedAt && latestIssueCardStatus === "Expired") {
      cardStatusForDashboard = "Expired";
    }

    return {
      id: doc.id,
      ...(data as Omit<DashboardUser, "id" | "arcCardStatus" | "lastIssued">),
      // Keep the response field name the UI already renders.
      picture: (data.photoThumb as string | undefined) ?? "",
      status: userAccountStatus,
      createdAt: toDateOrNull(data.createdAt)?.toISOString() ?? data.createdAt,
      updatedAt: toDateOrNull(data.updatedAt)?.toISOString() ?? data.updatedAt,
      arcCardStatus: cardStatusForDashboard,
      lastIssued: latestIssueDate ? toDateString(latestIssueDate) : "N/A",
    };
  });

  const lastDoc = pageDocs[pageDocs.length - 1];
  const lastCreatedAt = lastDoc
    ? (lastDoc.data().createdAt as Timestamp | undefined)
    : undefined;
  const nextCursor =
    hasMore && lastDoc && lastCreatedAt instanceof Timestamp
      ? encodeUsersCursor(lastCreatedAt, lastDoc.id)
      : null;

  const stats: DashboardStat[] = [
    {
      icon: "/card.svg",
      number: totalCardsAgg.data().count,
      label: "Available Cards",
    },
    {
      icon: "/checkmark.svg",
      number: activeCardsAgg.data().count,
      label: "Active Cards",
    },
    {
      icon: "/caution.svg",
      number: expiredCardsAgg.data().count,
      label: "Expired Cards",
    },
    {
      icon: "/flag.svg",
      number: flaggedUsersAgg.data().count,
      label: "Flagged Users",
    },
    {
      icon: "/flag.svg",
      number: bannedUsersAgg.data().count,
      label: "Banned Users",
    },
  ];

  return {
    viewer,
    stats,
    users,
    nextCursor,
    total: totalUsersAgg.data().count,
  };
}
