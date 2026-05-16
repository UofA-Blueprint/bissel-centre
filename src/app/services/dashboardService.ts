import "server-only";

import { initAdmin } from "@/app/services/firebaseAdmin";

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
  stats: DashboardStat[];
  users: DashboardUser[];
}

interface IssueRecord {
  userId?: string;
  createdAt?: unknown;
  returnedAt?: unknown;
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

export async function getDashboardSummary(): Promise<DashboardSummary> {
  const app = await initAdmin();
  const db = app.firestore();

  const [usersSnapshot, arcCardsSnapshot, bannedSnapshot, issuesSnapshot] =
    await Promise.all([
      db.collection("users").get(),
      db.collection("arc_cards").get(),
      db.collection("banned_users").get(),
      db.collection("issues").get(),
    ]);

  const now = new Date();
  const activeIssueByUserId = new Set<string>();
  const latestIssueDateByUserId = new Map<string, Date>();

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
    }

    const returnedAt = toDateOrNull(issue.returnedAt);
    if (createdAt <= now && !returnedAt) {
      activeIssueByUserId.add(issue.userId);
    }
  }

  const users: DashboardUser[] = usersSnapshot.docs.map((doc) => {
    const data = doc.data();
    const latestIssueDate = latestIssueDateByUserId.get(doc.id);
    const hasActiveIssue = activeIssueByUserId.has(doc.id);

    return {
      id: doc.id,
      ...(data as Omit<DashboardUser, "id" | "arcCardStatus" | "lastIssued">),
      createdAt: toDateOrNull(data.createdAt)?.toISOString() ?? data.createdAt,
      updatedAt: toDateOrNull(data.updatedAt)?.toISOString() ?? data.updatedAt,
      arcCardStatus: hasActiveIssue ? "Active" : undefined,
      lastIssued: latestIssueDate ? toDateString(latestIssueDate) : "N/A",
    };
  });

  const availableCards = arcCardsSnapshot.size;
  const activeCards = arcCardsSnapshot.docs.filter(
    (doc) => doc.data().status === "Active",
  ).length;
  const expiredCards = arcCardsSnapshot.docs.filter(
    (doc) => doc.data().status === "Expired",
  ).length;

  const stats: DashboardStat[] = [
    { icon: "/card.svg", number: availableCards, label: "Available Cards" },
    { icon: "/checkmark.svg", number: activeCards, label: "Active Cards" },
    { icon: "/caution.svg", number: expiredCards, label: "Expired Cards" },
    {
      icon: "/flag.svg",
      number: bannedSnapshot.size,
      label: "Flagged Users",
    },
  ];

  return {
    stats,
    users,
  };
}
