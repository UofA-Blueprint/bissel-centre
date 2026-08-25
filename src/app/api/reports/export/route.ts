import { NextRequest, NextResponse } from "next/server";
import { initAdmin } from "@/app/services/firebaseAdmin";
import { FieldPath } from "firebase-admin/firestore";
import { cookies } from "next/headers";
import * as XLSX from "xlsx";
import type { ExportRequest, ExportRow } from "@/app/(app)/reports/types";
import { sanitizeCell } from "@/utils/spreadsheet";

// Full-collection export; give it room until pagination lands (P2).
export const maxDuration = 120;

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

// Batch name lookup — replaces the former one-await-per-user N+1 that made
// exports scale with the number of holders (minutes at scale).
async function fetchUserNames(
  db: FirebaseFirestore.Firestore,
  userIds: Iterable<string>,
): Promise<Map<string, string>> {
  const names = new Map<string, string>();
  const ids = Array.from(new Set(Array.from(userIds).filter(Boolean)));
  await Promise.all(
    chunk(ids, 30).map(async (part) => {
      if (part.length === 0) return;
      const snap = await db
        .collection("users")
        .where(FieldPath.documentId(), "in", part)
        .select("firstName", "secondName")
        .get();
      for (const doc of snap.docs) {
        const d = doc.data();
        names.set(
          doc.id,
          `${d?.firstName || ""} ${d?.secondName || ""}`.trim(),
        );
      }
    }),
  );
  return names;
}

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

  const db = app.firestore();

  // IT admins are allowed to export in "view as" mode — same read scope they
  // already have on the reports page.
  if (decodedClaims.admin === true) {
    return { app, db };
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

  return { app, db };
}

// Handles both "2024-01-15" and "1/15/2024" formats stored in Firestore
function parseDate(dateStr: string): Date | null {
  if (!dateStr) return null;

  // ISO format: "2024-01-15"
  const iso = new Date(dateStr);
  if (!isNaN(iso.getTime()) && dateStr.includes("-")) return iso;

  // US format: "1/15/2024" or "01/15/2024"
  const parts = dateStr.split("/");
  if (parts.length === 3) {
    const [month, day, year] = parts;
    const d = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    if (!isNaN(d.getTime())) return d;
  }

  return null;
}

export async function POST(request: NextRequest) {
  try {
    const access = await verifyStaffAccess();
    if ("error" in access) return access.error;
    const { db } = access;

    const body: ExportRequest = await request.json();

    if (!body.startDate || !body.endDate) {
      return NextResponse.json(
        { error: "startDate and endDate are required" },
        { status: 400 }
      );
    }

    const rangeStart = new Date(body.startDate);
    const rangeEnd = new Date(body.endDate);
    rangeEnd.setHours(23, 59, 59, 999); // include the full end day

    if (isNaN(rangeStart.getTime()) || isNaN(rangeEnd.getTime())) {
      return NextResponse.json(
        { error: "Invalid date format. Use ISO dates, e.g. 2024-01-01" },
        { status: 400 }
      );
    }

    // Fetch cards (reuses same migration-aware logic as GET /api/cards)
    const cardsSnapshot = await db.collection("arc_cards").get();
    const migrationDoc = await db
      .collection("_migrations")
      .doc("issues_v1")
      .get();
    const isMigrated = migrationDoc.exists;

    // Build raw card list with pass recipient + issue dates
    interface RawCard {
      allocationDate: string;
      status: string;
      department: string;
      arcCardNumber: string;
      securityCode: string;
      passRecipient: string;
      issueDates: string[];
      notes: string;
    }

    const allCards: RawCard[] = [];

    if (isMigrated) {
      const issuesSnapshot = await db.collection("issues").get();
      const issuesByCard = new Map<
        string,
        Array<{ userId: string; issueDate: string }>
      >();
      for (const doc of issuesSnapshot.docs) {
        const d = doc.data();
        if (!issuesByCard.has(d.cardId)) issuesByCard.set(d.cardId, []);
        issuesByCard.get(d.cardId)!.push({
          userId: d.userId,
          issueDate: d.issueDate,
        });
      }

      const userIds = new Set<string>();
      for (const doc of cardsSnapshot.docs) {
        const d = doc.data();
        if (d.currentUserId) userIds.add(d.currentUserId);
      }
      for (const issues of issuesByCard.values()) {
        for (const i of issues) if (i.userId) userIds.add(i.userId);
      }

      const userNames = await fetchUserNames(db, userIds);

      for (const doc of cardsSnapshot.docs) {
        const d = doc.data();
        const cardIssues = issuesByCard.get(doc.id) || [];
        allCards.push({
          allocationDate: d.allocationDate || "",
          status: d.status || "Unloaded",
          department: d.department || "",
          arcCardNumber: d.arcCardNumber || "",
          securityCode: d.securityCode || "",
          passRecipient: d.currentUserId
            ? userNames.get(d.currentUserId) || ""
            : "",
          issueDates: cardIssues
            .map((i) => i.issueDate)
            .sort(
              (a, b) => new Date(b).getTime() - new Date(a).getTime()
            ),
          notes: d.notes || "",
        });
      }
    } else {
      const legacyHolderIds = cardsSnapshot.docs
        .map((doc) => doc.data())
        .filter((d) => d.userId && !d.passRecipient)
        .map((d) => String(d.userId));
      const legacyNames = await fetchUserNames(db, legacyHolderIds);

      for (const doc of cardsSnapshot.docs) {
        const d = doc.data();
        let passRecipient = d.passRecipient || "";
        if (d.userId && !passRecipient) {
          passRecipient = legacyNames.get(String(d.userId)) || "";
        }
        allCards.push({
          allocationDate: d.allocationDate || "",
          status: d.status || "Unloaded",
          department: d.department || "",
          arcCardNumber: d.arcCardNumber || "",
          securityCode: d.securityCode || "",
          passRecipient,
          issueDates: d.issueDates || [],
          notes: d.notes || "",
        });
      }
    }

    // Filter by date range
    let filtered = allCards.filter((card) => {
      const d = parseDate(card.allocationDate);
      if (!d) return false;
      return d >= rangeStart && d <= rangeEnd;
    });

    // Apply optional status filter
    if (body.filters?.statuses?.length) {
      const allowed = new Set<string>(body.filters.statuses);
      filtered = filtered.filter((c) => allowed.has(c.status));
    }

    // Apply optional department filter
    if (body.filters?.departments?.length) {
      const allowed = new Set<string>(body.filters.departments);
      filtered = filtered.filter((c) => allowed.has(c.department));
    }

    // Build xlsx rows
    const rows: ExportRow[] = filtered.map((c) => ({
      "Allocation Date": sanitizeCell(c.allocationDate),
      Status: sanitizeCell(c.status),
      Department: sanitizeCell(c.department),
      "ARC Card Number": sanitizeCell(c.arcCardNumber),
      "Security Code": sanitizeCell(c.securityCode),
      "Pass Recipient": sanitizeCell(c.passRecipient),
      "Issue Dates": sanitizeCell(c.issueDates.join(", ")),
      Notes: sanitizeCell(c.notes),
    }));

    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(workbook, worksheet, "ARC Cards");
    const buffer = XLSX.write(workbook, {
      type: "buffer",
      bookType: "xlsx",
    });

    return new Response(buffer, {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="arc-cards-export-${body.startDate}-to-${body.endDate}.xlsx"`,
      },
    });
  } catch (error) {
    console.error("Export error:", error);
    return NextResponse.json(
      { error: "Failed to generate export" },
      { status: 500 }
    );
  }
}
