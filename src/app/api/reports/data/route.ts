import { NextRequest, NextResponse } from "next/server";
import { initAdmin } from "@/app/services/firebaseAdmin";
import { FieldPath, Timestamp } from "firebase-admin/firestore";
import { cookies } from "next/headers";
import { decryptPhoneSafe } from "@/utils/phoneEncryption";
import { foldName } from "@/utils/nameSearch.mjs";
import { loadSearchIndex } from "@/app/services/searchIndexService";
import type {
  UserReportRow,
  CardHistoryEntry,
  ActivityEntry,
  ReportCardRow,
} from "@/app/(app)/reports/types";

// Layered server-side filtering with STRICTLY BOUNDED work per request:
//  - filter dimensions that live in other collections (cards, issues,
//    history, banned_users, the name index) each produce a capped user-id
//    set; sets are intersected
//  - the user stream applies remaining predicates in-memory under a scan
//    budget; pages may come back short (partial: true) with a cursor that
//    resumes the scan — so no request can ever run unbounded
//  - there is deliberately NO total count; pagination is cursor-only
export const maxDuration = 60;

const DEFAULT_PAGE_SIZE = 300;
const MAX_PAGE_SIZE = 500;
const SCAN_BUDGET = 900; // max primary docs examined per request
const LAYER_CAP = 1500; // max docs read per id-set layer
const SEARCH_ID_CAP = 500;

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
  const decodedClaims = await app.auth().verifySessionCookie(sessionCookie);

  const db = app.firestore();

  if (decodedClaims.admin === true) {
    if (options?.allowAdmin) {
      return { app, db, role: "admin" as const };
    }
    return {
      error: NextResponse.json(
        { error: "Forbidden - Staff access only" },
        { status: 403 },
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
        { status: 403 },
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

const toDateOrNull = (value: unknown): Date | null => {
  if (!value) return null;
  if (value instanceof Date)
    return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === "object" && value !== null && "toDate" in value) {
    const d = (value as { toDate?: () => Date }).toDate?.();
    if (d instanceof Date && !Number.isNaN(d.getTime())) return d;
  }
  if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
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

const parseDayStart = (value: string | null): Date | null => {
  if (!value) return null;
  const d = new Date(`${value}T00:00:00-06:00`);
  return Number.isNaN(d.getTime()) ? null : d;
};
const parseDayEnd = (value: string | null): Date | null => {
  if (!value) return null;
  const d = new Date(`${value}T23:59:59.999-06:00`);
  return Number.isNaN(d.getTime()) ? null : d;
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

const USER_FIELDS = [
  "firstName",
  "secondName",
  "email",
  "phoneNumber",
  "phone",
  "status",
  "banned",
  "flagged",
  "flagReason",
  "banReason",
  "genderIdentity",
  "dateOfBirth",
  "address",
  "postalCode",
  "notes",
  "createdAt",
  "passesIssued",
] as const;

type Filters = {
  search: string;
  flag: "all" | "flagged" | "banned" | "not_flagged";
  statuses: string[];
  currentCard: "all" | "has_current" | "no_current";
  createdFrom: Date | null;
  createdTo: Date | null;
  cardStatuses: string[];
  cardDepartments: string[];
  issuedFrom: string | null;
  issuedTo: string | null;
  events: string[];
  activityFrom: Date | null;
  activityTo: Date | null;
  flaggedFrom: Date | null;
  flaggedTo: Date | null;
  modifiedBy: string | null;
  bannedBy: string | null;
  issuedBy: string | null;
  userId: string | null;
};

function parseFilters(sp: URLSearchParams): Filters {
  const csv = (key: string, cap: number) =>
    (sp.get(key) ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, cap);
  const flag = sp.get("flag");
  const currentCard = sp.get("currentCard");
  return {
    search: (sp.get("search") ?? "").trim(),
    flag:
      flag === "flagged" || flag === "banned" || flag === "not_flagged"
        ? flag
        : "all",
    statuses: csv("statuses", 2),
    currentCard:
      currentCard === "has_current" || currentCard === "no_current"
        ? currentCard
        : "all",
    createdFrom: parseDayStart(sp.get("createdFrom")),
    createdTo: parseDayEnd(sp.get("createdTo")),
    cardStatuses: csv("cardStatuses", 10),
    cardDepartments: csv("cardDepartments", 30),
    issuedFrom: sp.get("issuedFrom"),
    issuedTo: sp.get("issuedTo"),
    events: csv("events", 10),
    activityFrom: parseDayStart(sp.get("activityFrom")),
    activityTo: parseDayEnd(sp.get("activityTo")),
    flaggedFrom: parseDayStart(sp.get("flaggedFrom")),
    flaggedTo: parseDayEnd(sp.get("flaggedTo")),
    modifiedBy: sp.get("modifiedBy"),
    bannedBy: sp.get("bannedBy"),
    issuedBy: sp.get("issuedBy"),
    userId: sp.get("userId"),
  };
}

// ── Id-set layers (each capped; truncation is reported, never silent) ──

async function idsFromCardFilters(
  db: FirebaseFirestore.Firestore,
  f: Filters,
  truncated: string[],
): Promise<Set<string> | null> {
  if (f.cardStatuses.length === 0 && f.cardDepartments.length === 0) {
    return null;
  }
  // One `in` per query: statuses compile; departments post-filter in memory
  // when both dimensions are active.
  let q: FirebaseFirestore.Query = db.collection("arc_cards");
  if (f.cardStatuses.length) q = q.where("status", "in", f.cardStatuses);
  else q = q.where("department", "in", f.cardDepartments);
  const snap = await q
    .select("currentUserId", "userId", "department")
    .limit(LAYER_CAP)
    .get();
  if (snap.size >= LAYER_CAP) truncated.push("cards");

  const ids = new Set<string>();
  const cardIds: string[] = [];
  for (const doc of snap.docs) {
    const d = doc.data();
    if (
      f.cardStatuses.length &&
      f.cardDepartments.length &&
      !f.cardDepartments.includes(String(d.department ?? ""))
    ) {
      continue;
    }
    cardIds.push(doc.id);
    const holder = normalizeId(d.currentUserId) || normalizeId(d.userId);
    if (holder) ids.add(holder);
  }
  // Past holders via issues (cardId → userId). Skipped past ~900 cards to
  // keep the request bounded — reported, never silent.
  if (cardIds.length > 900) {
    truncated.push("cardHistoryHolders");
  } else {
    await Promise.all(
      chunk(cardIds, 30).map(async (part) => {
        if (part.length === 0) return;
        const s = await db
          .collection("issues")
          .where("cardId", "in", part)
          .select("userId")
          .get();
        for (const doc of s.docs) {
          const uid = normalizeId(doc.data().userId);
          if (uid) ids.add(uid);
        }
      }),
    );
  }
  return ids;
}

async function idsFromSimpleLayer(
  db: FirebaseFirestore.Firestore,
  build: (q: FirebaseFirestore.Query) => FirebaseFirestore.Query,
  collection: string,
  userIdField: string,
  truncated: string[],
  label: string,
): Promise<Set<string>> {
  const snap = await build(db.collection(collection))
    .select(userIdField)
    .limit(LAYER_CAP)
    .get();
  if (snap.size >= LAYER_CAP) truncated.push(label);
  const ids = new Set<string>();
  for (const doc of snap.docs) {
    const uid = normalizeId(doc.data()[userIdField]);
    if (uid) ids.add(uid);
  }
  return ids;
}

async function idsFromSearch(
  db: FirebaseFirestore.Firestore,
  query: string,
  truncated: string[],
): Promise<Set<string> | null> {
  const folded = foldName(query);
  if (folded.length < 2) return null;
  const rows = await loadSearchIndex(db);
  const matched = rows.filter((r) => r.s.some((s) => s.startsWith(folded)));
  if (matched.length > SEARCH_ID_CAP) truncated.push("search");
  return new Set(matched.slice(0, SEARCH_ID_CAP).map((r) => r.id));
}

function intersect(sets: Array<Set<string>>): Set<string> {
  if (sets.length === 0) return new Set();
  let out = sets[0];
  for (const s of sets.slice(1)) {
    out = new Set(Array.from(out).filter((id) => s.has(id)));
  }
  return out;
}

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
    const f = parseFilters(sp);
    const truncated: string[] = [];

    // ── Layer A: id sets from foreign-collection filter dimensions ──
    const sets: Array<Set<string>> = [];
    const cardSet = await idsFromCardFilters(db, f, truncated);
    if (cardSet) sets.push(cardSet);
    if (f.issuedFrom || f.issuedTo) {
      sets.push(
        await idsFromSimpleLayer(
          db,
          (q) => {
            let out = q;
            if (f.issuedFrom) out = out.where("issueDate", ">=", f.issuedFrom);
            if (f.issuedTo) out = out.where("issueDate", "<=", f.issuedTo);
            return out;
          },
          "issues",
          "userId",
          truncated,
          "issueDates",
        ),
      );
    }
    if (f.events.length) {
      sets.push(
        await idsFromSimpleLayer(
          db,
          (q) => q.where("event", "in", f.events),
          "history",
          "userId",
          truncated,
          "events",
        ),
      );
    }
    if (f.activityFrom || f.activityTo) {
      sets.push(
        await idsFromSimpleLayer(
          db,
          (q) => {
            let out = q;
            if (f.activityFrom) {
              out = out.where("date", ">=", Timestamp.fromDate(f.activityFrom));
            }
            if (f.activityTo) {
              out = out.where("date", "<=", Timestamp.fromDate(f.activityTo));
            }
            return out;
          },
          "history",
          "userId",
          truncated,
          "activityDates",
        ),
      );
    }
    if (f.modifiedBy) {
      sets.push(
        await idsFromSimpleLayer(
          db,
          (q) => q.where("modifiedBy", "==", f.modifiedBy),
          "history",
          "userId",
          truncated,
          "modifiedBy",
        ),
      );
    }
    if (f.bannedBy) {
      sets.push(
        await idsFromSimpleLayer(
          db,
          (q) => q.where("bannedBy", "==", f.bannedBy),
          "banned_users",
          "userId",
          truncated,
          "bannedBy",
        ),
      );
    }
    if (f.issuedBy) {
      sets.push(
        await idsFromSimpleLayer(
          db,
          (q) => q.where("issuedBy", "==", f.issuedBy),
          "issues",
          "userId",
          truncated,
          "issuedBy",
        ),
      );
    }
    if (f.flaggedFrom || f.flaggedTo) {
      sets.push(
        await idsFromSimpleLayer(
          db,
          (q) => {
            let out = q;
            if (f.flaggedFrom) {
              out = out.where(
                "bannedAt",
                ">=",
                Timestamp.fromDate(f.flaggedFrom),
              );
            }
            if (f.flaggedTo) {
              out = out.where(
                "bannedAt",
                "<=",
                Timestamp.fromDate(f.flaggedTo),
              );
            }
            return out;
          },
          "banned_users",
          "userId",
          truncated,
          "flaggedDates",
        ),
      );
    }
    const searchSet = await idsFromSearch(db, f.search, truncated);
    if (searchSet) sets.push(searchSet);
    if (f.userId) sets.push(new Set([f.userId]));

    const restrictedIds =
      sets.length > 0
        ? Array.from(intersect(sets)).sort((a, b) => (a < b ? -1 : 1))
        : null;

    // ── Layer B: user stream with in-memory predicates + scan budget ──
    const userPredicate = (
      doc: FirebaseFirestore.QueryDocumentSnapshot,
    ): boolean => {
      const d = doc.data();
      if (f.flag === "flagged" && d.flagged !== true) return false;
      if (f.flag === "banned" && d.banned !== true) return false;
      if (
        f.flag === "not_flagged" &&
        (d.flagged === true || d.banned === true)
      ) {
        return false;
      }
      if (f.statuses.length) {
        const s = d.status === "Inactive" ? "Inactive" : "Active";
        if (!f.statuses.includes(s)) return false;
      }
      if (f.createdFrom || f.createdTo) {
        const created = toDateOrNull(d.createdAt);
        if (!created) return false;
        if (f.createdFrom && created < f.createdFrom) return false;
        if (f.createdTo && created > f.createdTo) return false;
      }
      return true;
    };

    // has/no current card resolved per candidate chunk with one bounded
    // cards query — no denormalized field involved.
    const applyCurrentCardFilter = async (
      candidates: FirebaseFirestore.QueryDocumentSnapshot[],
    ): Promise<FirebaseFirestore.QueryDocumentSnapshot[]> => {
      if (f.currentCard === "all" || candidates.length === 0) return candidates;
      const holders = new Set<string>();
      await Promise.all(
        chunk(
          candidates.map((c) => c.id),
          30,
        ).flatMap((part) => [
          db
            .collection("arc_cards")
            .where("currentUserId", "in", part)
            .select("currentUserId")
            .get()
            .then((snap) => {
              for (const doc of snap.docs) {
                const uid = normalizeId(doc.data().currentUserId);
                if (uid) holders.add(uid);
              }
            }),
          // Legacy holder field (see the join above).
          db
            .collection("arc_cards")
            .where("userId", "in", part)
            .select("userId")
            .get()
            .then((snap) => {
              for (const doc of snap.docs) {
                const uid = normalizeId(doc.data().userId);
                if (uid) holders.add(uid);
              }
            }),
        ]),
      );
      return candidates.filter((c) =>
        f.currentCard === "has_current"
          ? holders.has(c.id)
          : !holders.has(c.id),
      );
    };

    const pageDocs: FirebaseFirestore.QueryDocumentSnapshot[] = [];
    let nextCursor: string | null = null;
    let scanBudget = SCAN_BUDGET;

    if (restrictedIds !== null) {
      let idx = 0;
      if (cursorId) {
        while (idx < restrictedIds.length && restrictedIds[idx] <= cursorId) {
          idx++;
        }
      }
      while (
        idx < restrictedIds.length &&
        pageDocs.length < pageSize &&
        scanBudget > 0
      ) {
        const batchIds = restrictedIds.slice(idx, idx + 30);
        idx += batchIds.length;
        scanBudget -= batchIds.length;
        const snap = await db
          .collection("users")
          .where(FieldPath.documentId(), "in", batchIds)
          .select(...USER_FIELDS)
          .get();
        const ordered = snap.docs.sort((a, b) => (a.id < b.id ? -1 : 1));
        const accepted = await applyCurrentCardFilter(
          ordered.filter(userPredicate),
        );
        pageDocs.push(...accepted);
      }
      if (idx < restrictedIds.length) {
        nextCursor = restrictedIds[idx - 1];
      }
    } else {
      let after: string | null = cursorId;
      let exhausted = false;
      while (pageDocs.length < pageSize && scanBudget > 0 && !exhausted) {
        const batchSize = Math.min(150, scanBudget);
        let q = db
          .collection("users")
          .select(...USER_FIELDS)
          .orderBy(FieldPath.documentId())
          .limit(batchSize);
        // Positive account-state filters can ride automatic single-field
        // indexes. The combined "not flagged or banned" case remains a
        // bounded server-side predicate for compatibility with legacy docs.
        if (f.flag === "flagged" || f.flag === "banned") {
          q = db
            .collection("users")
            .where(f.flag === "flagged" ? "flagged" : "banned", "==", true)
            .select(...USER_FIELDS)
            .orderBy(FieldPath.documentId())
            .limit(batchSize);
        }
        if (after) q = q.startAfter(after);
        const snap = await q.get();
        if (snap.empty) {
          exhausted = true;
          break;
        }
        scanBudget -= snap.size;
        after = snap.docs[snap.docs.length - 1].id;
        const accepted = await applyCurrentCardFilter(
          snap.docs.filter(userPredicate),
        );
        pageDocs.push(...accepted);
        if (snap.size < batchSize) exhausted = true;
      }
      nextCursor = exhausted ? null : after;
    }

    const partial = pageDocs.length < pageSize && nextCursor !== null;
    const pageUserIds = pageDocs.map((d) => d.id);

    // ── Per-page joins (unchanged from the pagination rework) ────
    const bannedDocs: FirebaseFirestore.QueryDocumentSnapshot[] = [];
    const historyDocs: FirebaseFirestore.QueryDocumentSnapshot[] = [];
    const issueDocs: FirebaseFirestore.QueryDocumentSnapshot[] = [];
    const [migrationDoc] = await Promise.all([
      db.collection("_migrations").doc("issues_v1").get(),
      ...chunk(pageUserIds, 30).flatMap((part) => {
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
    ]);
    const isMigrated = migrationDoc.exists;

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
      // Legacy pre-migration cards name their holder in `userId` instead of
      // `currentUserId` — join those too or their holders show empty history.
      ...chunk(pageUserIds, 30).map(async (part) => {
        if (part.length === 0) return;
        const snap = await db
          .collection("arc_cards")
          .where("userId", "in", part)
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

    const userNameById = new Map<string, string>();
    const passesIssuedByUser = new Map<string, string[]>();
    for (const userDoc of pageDocs) {
      const d = userDoc.data();
      userNameById.set(
        userDoc.id,
        `${d.firstName || ""} ${d.secondName || ""}`.trim(),
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
      entries.sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
      );
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
              ? userNameById.get(cardDoc?.currentUserId || cardDoc?.userId) ||
                ""
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
            (a, b) => new Date(b).getTime() - new Date(a).getTime(),
          ),
        })),
      );
    }

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
        flagged: d.flagged === true,
        flagReason: d.flagReason || "",
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

    return NextResponse.json({
      users: rows,
      cards: pageCards,
      nextCursor,
      partial,
      truncated,
    });
  } catch (error) {
    console.error("Reports data error:", error);
    return NextResponse.json(
      { error: "Failed to fetch report data" },
      { status: 500 },
    );
  }
}
