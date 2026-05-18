"use server";

import { NextResponse } from "next/server";
import { initAdmin } from "@/app/services/firebaseAdmin";
import { cookies } from "next/headers";

async function verifyStaffAccess() {
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

  if (decodedClaims.admin === true) {
    return {
      error: NextResponse.json(
        { error: "Forbidden - Staff access only" },
        { status: 403 }
      ),
    };
  }

  const db = app.firestore();
  const staffDoc = await db
    .collection("administrative_staff")
    .doc(decodedClaims.uid)
    .get();

  if (!staffDoc.exists) {
    return {
      error: NextResponse.json(
        { error: "Forbidden - Staff access only" },
        { status: 403 }
      ),
    };
  }

  return { app, db };
}

export interface UserReportRow {
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  status: "Active" | "Inactive" | "Unknown";
  banned: boolean;
  banReason: string;
  bannedAt: string | null;
  bannedBy: string;
  genderIdentity: string;
  dateOfBirth: string;
  address: string;
  postalCode: string;
  notes: string;
  createdAt: string;
  totalCardsIssued: number;
  cardHistory: CardHistoryEntry[];
  activityHistory: ActivityEntry[];
}

export interface CardHistoryEntry {
  cardNumber: string;
  department: string;
  status: string;
  allocationDate: string;
  securityCode: string;
  issueDates: string[];
}

export interface ActivityEntry {
  date: string;
  event: string;
  notes: string;
  modifiedBy: string;
  reason?: string;
}

export async function GET() {
  try {
    const access = await verifyStaffAccess();
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

    // Index banned users by userId
    const bannedMap = new Map<string, { reason: string; bannedAt: string; bannedBy: string }>();
    for (const doc of bannedSnapshot.docs) {
      const d = doc.data();
      const bannedAt = d.bannedAt?.toDate?.()
        ? d.bannedAt.toDate().toISOString()
        : d.bannedAt || null;
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
      const date = d.date?.toDate?.()
        ? d.date.toDate().toISOString()
        : d.date || "";
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

    // Build card data per user
    const cardsByUser = new Map<string, CardHistoryEntry[]>();

    if (isMigrated) {
      // Group issues by cardId
      const issuesByCard = new Map<string, string[]>();
      const cardToUser = new Map<string, string>();

      for (const doc of issuesSnapshot.docs) {
        const d = doc.data();
        if (!issuesByCard.has(d.cardId)) issuesByCard.set(d.cardId, []);
        issuesByCard.get(d.cardId)!.push(d.issueDate || "");
        if (d.userId) cardToUser.set(d.cardId, d.userId);
      }

      for (const doc of cardsSnapshot.docs) {
        const d = doc.data();
        const userId = d.currentUserId || cardToUser.get(doc.id);
        if (!userId) continue;

        if (!cardsByUser.has(userId)) cardsByUser.set(userId, []);
        const issueDates = (issuesByCard.get(doc.id) || [])
          .sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

        cardsByUser.get(userId)!.push({
          cardNumber: d.arcCardNumber || "",
          department: d.department || "",
          status: d.status || "Unloaded",
          allocationDate: d.allocationDate || "",
          securityCode: d.securityCode || "",
          issueDates,
        });
      }
    } else {
      for (const doc of cardsSnapshot.docs) {
        const d = doc.data();
        const userId = d.userId;
        if (!userId) continue;

        if (!cardsByUser.has(userId)) cardsByUser.set(userId, []);
        cardsByUser.get(userId)!.push({
          cardNumber: d.arcCardNumber || "",
          department: d.department || "",
          status: d.status || "Unloaded",
          allocationDate: d.allocationDate || "",
          securityCode: d.securityCode || "",
          issueDates: d.issueDates || [],
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

      const createdAt = d.createdAt?.toDate?.()
        ? d.createdAt.toDate().toISOString()
        : d.createdAt || "";

      rows.push({
        userId,
        firstName: d.firstName || "",
        lastName: d.secondName || "",
        email: d.email || "",
        phoneNumber: d.phoneNumber || "",
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
        totalCardsIssued: cards.length,
        cardHistory: cards,
        activityHistory: history,
      });
    }

    // Sort by last name, then first name
    rows.sort((a, b) => {
      const lastCmp = a.lastName.localeCompare(b.lastName);
      return lastCmp !== 0 ? lastCmp : a.firstName.localeCompare(b.firstName);
    });

    return NextResponse.json({ users: rows });
  } catch (error) {
    console.error("Reports data error:", error);
    return NextResponse.json(
      { error: "Failed to fetch report data" },
      { status: 500 }
    );
  }
}
