"use server";

import { NextRequest, NextResponse } from "next/server";
import { initAdmin } from "@/app/services/firebaseAdmin";
import admin from "firebase-admin";
import { ArcCard, ArcCardInput } from "@/app/(app)/cards/types";
import { cookies } from "next/headers";
import {
  getMonthlyUnloadSchedule,
  updateMonthlyUnloadSchedule,
} from "@/app/services/cardExpiryService";
import { foldName } from "@/utils/nameSearch.mjs";
import { loadSearchIndex } from "@/app/services/searchIndexService";

const EDMONTON_TIMEZONE = "America/Edmonton";

function formatEdmontonDate(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: EDMONTON_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  if (!year || !month || !day) return "";
  return `${year}-${month}-${day}`;
}

function normalizeDateOnlyInput(value: unknown): string {
  const raw = String(value || "").trim();
  if (!raw) return "";

  const isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  }

  const slashParts = raw.split("/");
  if (slashParts.length === 3) {
    const first = Number(slashParts[0]);
    const second = Number(slashParts[1]);
    const year = Number(slashParts[2]);
    if (
      Number.isFinite(first) &&
      Number.isFinite(second) &&
      Number.isFinite(year)
    ) {
      const month = first > 12 ? second : first;
      const day = first > 12 ? first : second;
      if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
        return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      }
    }
  }

  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) {
    return formatEdmontonDate(parsed);
  }

  return raw;
}

async function verifyStaffAccess(options?: {
  allowAdmin?: boolean;
  checkRevoked?: boolean;
}) {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("session")?.value;

  if (!sessionCookie) {
    return {
      error: NextResponse.json({ error: "Unauthorized - No session found" }, { status: 401 }),
    };
  }

  const app = await initAdmin();
  // Writes verify with revocation; hot read paths may skip it (SCALE-05).
  const decodedClaims = await app
    .auth()
    .verifySessionCookie(sessionCookie, options?.checkRevoked ?? true);

  const db = app.firestore();

  // IT Admins are allowed for read endpoints in "view as" mode; write endpoints
  // omit the flag and continue to reject.
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

  const staffDoc = await db.collection("administrative_staff").doc(decodedClaims.uid).get();

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
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
}

async function fetchUserNamesByIds(
  db: admin.firestore.Firestore,
  userIds: Iterable<string>,
): Promise<Map<string, string>> {
  const ids = Array.from(new Set(Array.from(userIds).filter(Boolean)));
  const result = new Map<string, string>();
  if (ids.length === 0) return result;

  // Firestore "in" queries accept up to 30 values; chunk accordingly.
  const idChunks = chunk(ids, 30);
  await Promise.all(
    idChunks.map(async (idsPart) => {
      const snap = await db
        .collection("users")
        .where(admin.firestore.FieldPath.documentId(), "in", idsPart)
        .select("firstName", "secondName")
        .get();

      for (const doc of snap.docs) {
        const data = doc.data() as { firstName?: string; secondName?: string };
        result.set(
          doc.id,
          `${data.firstName || ""} ${data.secondName || ""}`.trim(),
        );
      }
    }),
  );

  return result;
}

// ── Pagination helpers ───────────────────────────────────────────

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 200;
const SEARCH_RESULT_CAP = 50;

function encodeCursor(arcCardNumber: string, id: string): string {
  return Buffer.from(JSON.stringify([arcCardNumber, id]), "utf8").toString(
    "base64url",
  );
}

function decodeCursor(raw: string | null): [string, string] | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(Buffer.from(raw, "base64url").toString("utf8"));
    if (
      Array.isArray(parsed) &&
      typeof parsed[0] === "string" &&
      typeof parsed[1] === "string"
    ) {
      return [parsed[0], parsed[1]];
    }
  } catch {
    /* malformed cursor — treat as first page */
  }
  return null;
}

// Enrich a PAGE of card docs: issues + holder names joined with bounded
// `in` queries (never full scans).
async function buildCardRows(
  db: admin.firestore.Firestore,
  cardDocs: admin.firestore.QueryDocumentSnapshot[],
  isMigrated: boolean,
): Promise<ArcCard[]> {
  const cardIds = cardDocs.map((d) => d.id);

  const issuesByCard = new Map<
    string,
    Array<{ userId: string; issueDate: string; issuedBy?: string }>
  >();
  await Promise.all(
    chunk(cardIds, 30).map(async (part) => {
      if (part.length === 0) return;
      const snap = await db
        .collection("issues")
        .where("cardId", "in", part)
        .select("cardId", "userId", "issueDate", "issuedBy")
        .get();
      for (const doc of snap.docs) {
        const d = doc.data();
        const cardId = String(d.cardId ?? "");
        if (!cardId) continue;
        if (!issuesByCard.has(cardId)) issuesByCard.set(cardId, []);
        issuesByCard.get(cardId)!.push({
          userId: String(d.userId ?? ""),
          issueDate: String(d.issueDate ?? ""),
          issuedBy: typeof d.issuedBy === "string" ? d.issuedBy : undefined,
        });
      }
    }),
  );

  const userIds = new Set<string>();
  for (const doc of cardDocs) {
    const data = doc.data();
    const holderId = data.currentUserId || data.userId;
    if (holderId && !data.passRecipient) userIds.add(holderId);
  }
  for (const issues of issuesByCard.values()) {
    for (const issue of issues) if (issue.userId) userIds.add(issue.userId);
  }
  const userNames = await fetchUserNamesByIds(db, userIds);

  return cardDocs.map((doc) => {
    const data = doc.data();
    const cardIssues = issuesByCard.get(doc.id) ?? [];

    const issueDates = isMigrated
      ? cardIssues
          .map((i) => i.issueDate)
          .filter(Boolean)
          .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())
      : ((data.issueDates as string[] | undefined) ?? []);

    const issuedByAny = Array.from(
      new Set(
        cardIssues
          .map((i) => i.issuedBy)
          .filter((v): v is string => typeof v === "string" && v.length > 0),
      ),
    );

    const holderId = data.currentUserId || data.userId;
    let passRecipient = (data.passRecipient as string | undefined) || "";
    if (holderId && !passRecipient) {
      passRecipient = userNames.get(holderId) || "";
    }

    return {
      id: doc.id,
      currentUserId: data.currentUserId || data.userId || null,
      allocationDate: data.allocationDate || "",
      status: data.status || "Unloaded",
      department: data.department || "Emergency",
      arcCardNumber: data.arcCardNumber || "",
      securityCode: data.securityCode || "",
      passRecipient,
      issueDates,
      issuedByAny,
      notes: data.notes || "",
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    } as ArcCard;
  });
}

// GET /api/cards — cursor-paginated card list.
//
// Query params: limit (≤200), cursor (opaque), statuses (csv),
// departments (csv), q (card-number prefix OR recipient name via the
// name-search index). Cost is O(page size), never O(collection).
export async function GET(request: NextRequest) {
  try {
    const access = await verifyStaffAccess({
      allowAdmin: true,
      checkRevoked: false,
    });
    if ("error" in access) {
      return access.error;
    }
    const { db } = access;

    const sp = request.nextUrl.searchParams;
    const limitParam = Number.parseInt(sp.get("limit") ?? "", 10);
    const pageSize = Number.isFinite(limitParam)
      ? Math.min(MAX_PAGE_SIZE, Math.max(1, limitParam))
      : DEFAULT_PAGE_SIZE;
    const cursor = decodeCursor(sp.get("cursor"));
    const statuses = (sp.get("statuses") ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 10);
    const departments = (sp.get("departments") ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 30);
    const q = (sp.get("q") ?? "").trim();

    const [migrationDoc, monthlyUnloadSchedule, totalAllAgg] =
      await Promise.all([
        db.collection("_migrations").doc("issues_v1").get(),
        getMonthlyUnloadSchedule(db),
        db.collection("arc_cards").count().get(),
      ]);
    const isMigrated = migrationDoc.exists;
    const totalAll = totalAllAgg.data().count;

    // ── Search mode: card-number prefix + recipient-name index ───
    if (q) {
      const found = new Map<string, admin.firestore.QueryDocumentSnapshot>();

      const qDigits = q.replace(/\D/g, "");
      if (qDigits.length >= 3) {
        const snap = await db
          .collection("arc_cards")
          .orderBy("arcCardNumber")
          .startAt(qDigits)
          .endAt(`${qDigits}`)
          .limit(SEARCH_RESULT_CAP)
          .get();
        for (const doc of snap.docs) found.set(doc.id, doc);
      }

      const qFolded = foldName(q);
      if (qFolded.length >= 2 && !/^\d+$/.test(qFolded)) {
        const rows = await loadSearchIndex(db);
        const matchIds = rows
          .filter((r) => r.s.some((s) => s.startsWith(qFolded)))
          .slice(0, 30)
          .map((r) => r.id);
        if (matchIds.length > 0) {
          const snap = await db
            .collection("arc_cards")
            .where("currentUserId", "in", matchIds)
            .get();
          for (const doc of snap.docs) {
            if (!found.has(doc.id)) found.set(doc.id, doc);
          }
        }
      }

      let docs = Array.from(found.values());
      if (statuses.length) {
        docs = docs.filter((d) =>
          statuses.includes(String(d.data().status ?? "")),
        );
      }
      if (departments.length) {
        docs = docs.filter((d) =>
          departments.includes(String(d.data().department ?? "")),
        );
      }
      docs.sort((a, b) =>
        String(a.data().arcCardNumber ?? "").localeCompare(
          String(b.data().arcCardNumber ?? ""),
        ),
      );
      docs = docs.slice(0, SEARCH_RESULT_CAP);

      const cards = await buildCardRows(db, docs, isMigrated);
      return NextResponse.json({
        cards,
        nextCursor: null,
        total: cards.length,
        totalAll,
        monthlyUnloadSchedule,
        searchMode: true,
      });
    }

    // ── List mode: cursor pagination with optional filters ───────
    // Firestore allows only one `in` clause per query; with BOTH filter
    // dimensions active, status goes into the query and department is
    // applied in-memory inside a bounded page-fill loop.
    const inMemoryDept = statuses.length > 0 && departments.length > 0;
    const buildQuery = () => {
      let ref: admin.firestore.Query = db.collection("arc_cards");
      if (statuses.length) ref = ref.where("status", "in", statuses);
      else if (departments.length)
        ref = ref.where("department", "in", departments);
      return ref;
    };

    let total: number | null = null;
    if (!inMemoryDept) {
      total =
        statuses.length || departments.length
          ? (await buildQuery().count().get()).data().count
          : totalAll;
    }

    const matched: admin.firestore.QueryDocumentSnapshot[] = [];
    let hasMore = false;

    if (!inMemoryDept) {
      let qref = buildQuery()
        .orderBy("arcCardNumber")
        .orderBy(admin.firestore.FieldPath.documentId())
        .limit(pageSize + 1);
      if (cursor) qref = qref.startAfter(cursor[0], cursor[1]);
      const snap = await qref.get();
      hasMore = snap.size > pageSize;
      matched.push(...snap.docs.slice(0, pageSize));
    } else {
      let after: [string, string] | null = cursor;
      let exhausted = false;
      const batchSize = Math.min(MAX_PAGE_SIZE, pageSize * 2);
      for (
        let round = 0;
        round < 5 && matched.length < pageSize && !exhausted;
        round++
      ) {
        let qref = buildQuery()
          .orderBy("arcCardNumber")
          .orderBy(admin.firestore.FieldPath.documentId())
          .limit(batchSize);
        if (after) qref = qref.startAfter(after[0], after[1]);
        const snap = await qref.get();
        if (snap.empty) {
          exhausted = true;
          break;
        }
        for (const doc of snap.docs) {
          if (matched.length >= pageSize) break;
          if (!departments.includes(String(doc.data().department ?? ""))) {
            continue;
          }
          matched.push(doc);
        }
        const last = snap.docs[snap.docs.length - 1];
        after = [String(last.data().arcCardNumber ?? ""), last.id];
        if (snap.size < batchSize) exhausted = true;
      }
      hasMore = matched.length >= pageSize;
    }

    const cards = await buildCardRows(db, matched, isMigrated);
    const lastMatched = matched[matched.length - 1];
    const nextCursor =
      hasMore && lastMatched
        ? encodeCursor(
            String(lastMatched.data().arcCardNumber ?? ""),
            lastMatched.id,
          )
        : null;

    return NextResponse.json({
      cards,
      nextCursor,
      total,
      totalAll,
      monthlyUnloadSchedule,
    });
  } catch (error) {
    console.error("Error fetching cards:", error);
    return NextResponse.json(
      { error: "Failed to fetch cards" },
      { status: 500 }
    );
  }
}

// POST /api/cards - Create new card(s): capped, batched, duplicate-guarded.
const MAX_CARDS_PER_REQUEST = 200; // well under Firestore's 500-op batch cap

export async function POST(request: NextRequest) {
  try {
    const access = await verifyStaffAccess();
    if ("error" in access) {
      return access.error;
    }
    const { db } = access;

    const body = await request.json();
    const cardsToCreate: ArcCardInput[] = Array.isArray(body.cards)
      ? body.cards
      : [body];

    if (cardsToCreate.length === 0) {
      return NextResponse.json({ error: "No cards provided" }, { status: 400 });
    }
    if (cardsToCreate.length > MAX_CARDS_PER_REQUEST) {
      return NextResponse.json(
        { error: `At most ${MAX_CARDS_PER_REQUEST} cards per request` },
        { status: 400 },
      );
    }

    const numbers = cardsToCreate.map((c) =>
      String(c.arcCardNumber ?? "").trim(),
    );
    if (numbers.some((n) => n.length === 0)) {
      return NextResponse.json(
        { error: "Every card needs a card number" },
        { status: 400 },
      );
    }
    const dupInRequest = Array.from(
      new Set(numbers.filter((n, i) => numbers.indexOf(n) !== i)),
    );
    if (dupInRequest.length > 0) {
      return NextResponse.json(
        { error: `Duplicate card number(s) in request: ${dupInRequest.join(", ")}` },
        { status: 409 },
      );
    }

    // Duplicate guard against existing cards (bounded in-queries). A race
    // between two simultaneous requests with the same number can still slip
    // through this check-then-write; acceptable for a small staff team.
    const existing: string[] = [];
    await Promise.all(
      chunk(numbers, 30).map(async (part) => {
        const snap = await db
          .collection("arc_cards")
          .where("arcCardNumber", "in", part)
          .select("arcCardNumber")
          .get();
        for (const doc of snap.docs) {
          existing.push(String(doc.data().arcCardNumber ?? ""));
        }
      }),
    );
    if (existing.length > 0) {
      return NextResponse.json(
        { error: `Card number(s) already exist: ${Array.from(new Set(existing)).join(", ")}` },
        { status: 409 },
      );
    }

    // One atomic batch — no partial creations on failure.
    const batch = db.batch();
    const createdCards: ArcCard[] = [];
    for (const cardInput of cardsToCreate) {
      const status =
        cardInput.status && cardInput.status.trim() !== ""
          ? cardInput.status
          : "Unloaded";

      const newCard = {
        currentUserId: cardInput.currentUserId || null,
        allocationDate: normalizeDateOnlyInput(cardInput.allocationDate),
        status,
        department: cardInput.department,
        arcCardNumber: String(cardInput.arcCardNumber).trim(),
        securityCode: cardInput.securityCode,
        notes: cardInput.notes || "",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      const docRef = db.collection("arc_cards").doc();
      batch.set(docRef, newCard);

      createdCards.push({
        id: docRef.id,
        ...newCard,
        passRecipient: "",
        issueDates: [],
        createdAt: undefined,
        updatedAt: undefined,
      } as unknown as ArcCard);
    }
    await batch.commit();

    return NextResponse.json({ cards: createdCards }, { status: 201 });
  } catch (error) {
    console.error("Error creating card(s):", error);
    return NextResponse.json(
      { error: "Failed to create card(s)" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest){
  try{
    const access = await verifyStaffAccess();
    if ("error" in access){
      return access.error;
    }
    const {db} = access;

    const body = (await request.json()) as {
      action?: "UPDATE_STATUS" | "FORCE_UNASSIGN" | "UPDATE_MONTHLY_UNLOAD_SCHEDULE";
      id?: string;
      status?: string;
      confirmDangerous?: boolean;
      dayOfMonth?: number;
      time24?: string;
      enabled?: boolean;
    }

    const {
      action = "UPDATE_STATUS",
      id,
      status,
      confirmDangerous = false,
      dayOfMonth,
      time24,
      enabled,
    } = body;

    if (action === "UPDATE_MONTHLY_UNLOAD_SCHEDULE") {
      if (!Number.isInteger(dayOfMonth) || typeof time24 !== "string") {
        return NextResponse.json(
          { error: "dayOfMonth and time24 are required for schedule updates" },
          { status: 400 },
        );
      }
      try {
        const validatedDayOfMonth = Number(dayOfMonth);
        const schedule = await updateMonthlyUnloadSchedule(db, {
          dayOfMonth: validatedDayOfMonth,
          time24,
          enabled,
        });
        return NextResponse.json({ success: true, monthlyUnloadSchedule: schedule });
      } catch (error) {
        return NextResponse.json(
          { error: error instanceof Error ? error.message : "Invalid schedule" },
          { status: 400 },
        );
      }
    }

    if (!id) {
      return NextResponse.json(
        { error: "Card id is required" },
        { status: 400 },
      );
    }

    if (action === "FORCE_UNASSIGN") {
      const cardRef = db.collection("arc_cards").doc(id);
      const cardSnap = await cardRef.get();
      if (!cardSnap.exists) {
        return NextResponse.json({ error: "Card not found" }, { status: 404 });
      }
      const cardData = cardSnap.data() as {
        currentUserId?: string | null;
        status?: string;
      };
      const currentUserId = cardData.currentUserId ?? null;
      if (!currentUserId) {
        return NextResponse.json({ success: true, alreadyUnassigned: true });
      }
      if (!confirmDangerous) {
        return NextResponse.json(
          {
            error: "Dangerous force unassign",
            requiresConfirmation: true,
            warning:
              "This will unassign the recipient from the card and set the card to Unattributed.",
            reasons: [
              "Active assignment history will be closed for this card/user.",
              "The user will no longer have this as their current ARC card.",
            ],
          },
          { status: 409 },
        );
      }

      await db.runTransaction(async (tx) => {
        const freshCardSnap = await tx.get(cardRef);
        if (!freshCardSnap.exists) {
          throw new Error("Card not found");
        }
        const freshCardData = freshCardSnap.data() as { currentUserId?: string | null };
        const holderId = freshCardData.currentUserId ?? null;
        if (!holderId) return;

        const userRef = db.collection("users").doc(holderId);
        const userSnap = await tx.get(userRef);
        const openIssueQuery = db
          .collection("issues")
          .where("cardId", "==", cardRef.id)
          .where("userId", "==", holderId)
          .where("returnedAt", "==", null)
          .limit(1);
        const openIssueSnap = await tx.get(openIssueQuery);

        if (userSnap.exists) {
          tx.update(userRef, {
            arcCardNumber: admin.firestore.FieldValue.delete(),
            passesIssued: admin.firestore.FieldValue.arrayUnion(cardRef.id),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        }
        if (!openIssueSnap.empty) {
          tx.update(openIssueSnap.docs[0].ref, {
            returnedAt: admin.firestore.FieldValue.serverTimestamp(),
            closedCardStatus: "Unattributed",
          });
        }
        tx.update(cardRef, {
          status: "Unattributed",
          currentUserId: null,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      });

      return NextResponse.json({ success: true });
    }

    if (!id || !status){
      return NextResponse.json(
        { error: "Card id and status are required" },
        { status: 400 },
      );
    }

    const allowedStatuses = new Set([
      "Active",
      "Unattributed",
      "Expired",
      "Unloaded",
      "Cancelled",
    ]);

    if (!allowedStatuses.has(status)) {
      return NextResponse.json({ error: "Invalid card status" }, { status: 400 });
    }

    const cardRef = db.collection("arc_cards").doc(id);
    const cardSnap = await cardRef.get();
    if (!cardSnap.exists) {
      return NextResponse.json({ error: "Card not found" }, { status: 404 });
    }
    const cardData = cardSnap.data() as {
      currentUserId?: string | null;
      status?: string;
    };
    const hasHolder = Boolean(cardData.currentUserId);
    const nextStatus = status;
    const reasons: string[] = [];
    if (nextStatus === "Active" && !hasHolder) {
      reasons.push("Setting Active without an assigned recipient.");
    }
    if (nextStatus === "Unattributed" && hasHolder) {
      reasons.push("Setting Unattributed while card is still assigned to a recipient.");
    }
    if (
      (nextStatus === "Unloaded" || nextStatus === "Cancelled") &&
      hasHolder
    ) {
      reasons.push(`Setting ${nextStatus} while card is still assigned.`);
    }
    const isDangerous = reasons.length > 0;
    if (isDangerous && !confirmDangerous) {
      return NextResponse.json(
        {
          error: "Dangerous status change",
          requiresConfirmation: true,
          warning:
            "This status change can create card assignment inconsistencies.",
          reasons,
        },
        { status: 409 },
      );
    }
    await db.runTransaction(async (tx) => {
      const freshCardSnap = await tx.get(cardRef);
      if (!freshCardSnap.exists) {
        throw new Error("Card not found");
      }
    
      const freshCardData = freshCardSnap.data() as {
        currentUserId?: string | null;
      };
    
      const currentUserId = freshCardData.currentUserId ?? null;
    
      const cardUpdates: {
        status: string;
        updatedAt: admin.firestore.FieldValue;
        currentUserId?: null;
      } = {
        status: nextStatus,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };
    
      // Keep card/user mirror fields in sync:
      // any transition away from Active should detach the current holder.
      if (nextStatus !== "Active" && currentUserId) {
        const userRef = db.collection("users").doc(currentUserId);
        const userSnap = await tx.get(userRef);

        // Close any open issue for this card/user so dashboard history-based
        // views no longer treat it as currently active.
        const openIssueQuery = db
          .collection("issues")
          .where("cardId", "==", cardRef.id)
          .where("userId", "==", currentUserId)
          .where("returnedAt", "==", null)
          .limit(1);
        const openIssueSnap = await tx.get(openIssueQuery);

        // All reads above; writes below.
        if (userSnap.exists) {
          tx.update(userRef, {
            arcCardNumber: admin.firestore.FieldValue.delete(),
            passesIssued: admin.firestore.FieldValue.arrayUnion(cardRef.id),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        }

        if (!openIssueSnap.empty) {
          tx.update(openIssueSnap.docs[0].ref, {
            returnedAt: admin.firestore.FieldValue.serverTimestamp(),
            closedCardStatus: nextStatus,
          });
        }

        cardUpdates.currentUserId = null;
      }
    
      tx.update(cardRef, cardUpdates);
    });


  return NextResponse.json({ success: true });
  
  } catch (error) {
    console.error("Error updating card status:", error);
    return NextResponse.json(
      { error: "Failed to update card status" },
      { status: 500 },
    );
  }
}
