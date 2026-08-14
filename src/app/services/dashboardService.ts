import "server-only";

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
  }
  stats: DashboardStat[];
  users: DashboardUser[];
}

interface IssueRecord {
  userId?: string;
  cardId?: string;
  createdAt?: unknown;
  returnedAt?: unknown;
  closedCardStatus?: string;
}

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

export async function getDashboardSummaryForViewer(viewer: {
  uid: string;
  email: string;
  name: string;
}, db: Firestore): Promise<DashboardSummary> {
  const [
  usersSnapshot,
  issuesSnapshot,
  cardsSnapshot,
  totalCardsAgg,
  activeCardsAgg,
  expiredCardsAgg,
  bannedUsersAgg,] = await Promise.all([
  db
    .collection("users")
    .select(
      "firstName",
      "secondName",
      "picture",
      "aliases",
      "banned",
      "status",
      "email",
      "createdAt",
      "updatedAt",
    )
    .get(),
  db
    .collection("issues")
    .select("userId", "cardId", "createdAt", "returnedAt", "closedCardStatus")
    .get(),
  db.collection("arc_cards").select("status", "currentUserId").get(),
  db.collection("arc_cards").count().get(),
  db.collection("arc_cards").where("status", "==", "Active").count().get(),
  db.collection("arc_cards").where("status", "==", "Expired").count().get(),
  db.collection("banned_users").count().get(),
]);

  const latestIssueDateByUserId = new Map<string, Date>();
  const latestIssueCardIdByUserId = new Map<string, string>();
  const latestIssueReturnedAtByUserId = new Map<string, unknown>();
  const latestIssueClosedStatusByUserId = new Map<string, string | undefined>();
  const activeCardByUserId = new Map<string, "Active">();
  const unloadedAssignedCardByUserId = new Map<string, "Unloaded">();
  const cardStatusByCardId = new Map<string, string>();

  for (const cardDoc of cardsSnapshot.docs) {
    const cardData = cardDoc.data() as { status?: string; currentUserId?: string | null };
    const status = cardData.status ?? "";
    cardStatusByCardId.set(cardDoc.id, status);
    if (status === "Active" && cardData.currentUserId) {
      activeCardByUserId.set(cardData.currentUserId, "Active");
    } else if (status === "Unloaded" && cardData.currentUserId) {
      unloadedAssignedCardByUserId.set(cardData.currentUserId, "Unloaded");
    }
  }

  for (const issueDoc of issuesSnapshot.docs) {
    const issue = issueDoc.data() as IssueRecord;
    if (!issue.userId) {
      continue;
    }

    const createdAt = toDateOrNull(issue.createdAt);
  
    if (!createdAt) {
      continue;
    }

    const existingLatest = latestIssueDateByUserId.get(issue.userId);
    if (!existingLatest || createdAt > existingLatest) {
      latestIssueDateByUserId.set(issue.userId, createdAt);
      if (issue.cardId) {
        latestIssueCardIdByUserId.set(issue.userId, issue.cardId);
      }
      latestIssueReturnedAtByUserId.set(issue.userId, issue.returnedAt);
      latestIssueClosedStatusByUserId.set(
        issue.userId,
        issue.closedCardStatus,
      );
    }

  }

  const users: DashboardUser[] = usersSnapshot.docs.map((doc) => {
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
    const userAccountStatus = data.status === "Inactive" ? "Inactive" : "Active";
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
      status: userAccountStatus,
      createdAt: toDateOrNull(data.createdAt)?.toISOString() ?? data.createdAt,
      updatedAt: toDateOrNull(data.updatedAt)?.toISOString() ?? data.updatedAt,
      arcCardStatus: cardStatusForDashboard,
      lastIssued: latestIssueDate ? toDateString(latestIssueDate) : "N/A",
    };
  });

  const availableCards = totalCardsAgg.data().count;
  const activeCards = activeCardsAgg.data().count;
  const expiredCards = expiredCardsAgg.data().count;

  const stats: DashboardStat[] = [
    { icon: "/card.svg", number: availableCards, label: "Available Cards" },
    { icon: "/checkmark.svg", number: activeCards, label: "Active Cards" },
    { icon: "/caution.svg", number: expiredCards, label: "Expired Cards" },
    {
      icon: "/flag.svg",
      number: bannedUsersAgg.data().count,
      label: "Flagged Users",
    },
  ];

  return {
    viewer,
    stats,
    users,
  };
}
