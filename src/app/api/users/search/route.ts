import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import Fuse from "fuse.js";
import admin from "firebase-admin";
import { initAdmin } from "@/app/services/firebaseAdmin";
import { foldName, tokensOf, phoneticCodes } from "@/utils/nameSearch.mjs";
import {
  loadSearchIndex,
  type SearchIndexRow,
} from "@/app/services/searchIndexService";

// GET /api/users/search?q=... — server-side recipient search.
//
// Three ranked tiers over the sharded search_index docs:
//   1. prefix on folded strings (incl. aliases + compound variants)
//   2. fuzzy (Fuse) on the same folded strings — language-agnostic, carries
//      names no phonetic algorithm has rules for
//   3. phonetic (Double Metaphone code equality) — helps translated/French
//      surnames; ranked last by design
// Results are hydrated from the top user docs (bounded reads).

const MIN_QUERY_LENGTH = 2;
const MAX_RESULTS = 10;
const INDEX_CACHE_TTL_MS = 30_000;

let indexCache: {
  at: number;
  rows: SearchIndexRow[];
  fuse: Fuse<SearchIndexRow>;
} | null = null;

async function getIndex(db: admin.firestore.Firestore) {
  const now = Date.now();
  if (indexCache && now - indexCache.at < INDEX_CACHE_TTL_MS) {
    return indexCache;
  }
  const rows = await loadSearchIndex(db);
  const fuse = new Fuse(rows, {
    keys: ["s"],
    threshold: 0.35,
    ignoreLocation: true,
    includeScore: true,
  });
  indexCache = { at: now, rows, fuse };
  return indexCache;
}

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("session")?.value;
    if (!sessionCookie) {
      return NextResponse.json(
        { error: "Unauthorized - No session found" },
        { status: 401 },
      );
    }

    const app = await initAdmin();
    // Hot read path — revocation check skipped (SCALE-05).
    const decodedClaims = await app.auth().verifySessionCookie(sessionCookie);

    if (decodedClaims.admin !== true) {
      const staffDoc = await app
        .firestore()
        .collection("administrative_staff")
        .doc(decodedClaims.uid)
        .get();
      if (!staffDoc.exists || staffDoc.data()?.isDeleted === true) {
        return NextResponse.json(
          { error: "Forbidden - Staff access only" },
          { status: 403 },
        );
      }
    }

    const qRaw = request.nextUrl.searchParams.get("q") ?? "";
    const qFolded = foldName(qRaw);
    if (qFolded.length < MIN_QUERY_LENGTH) {
      return NextResponse.json({ ids: [], results: [] });
    }
    const qJoined = tokensOf(qFolded).join("");
    const qCodes = phoneticCodes(qFolded);

    const db = app.firestore();
    const { rows, fuse } = await getIndex(db);

    // Tier 1: prefix
    const prefixMatches = rows
      .filter((r) =>
        r.s.some((s) => s.startsWith(qFolded) || s.startsWith(qJoined)),
      )
      .sort((a, b) => a.n.localeCompare(b.n));

    // Tier 2: fuzzy
    const fuzzyMatches = fuse.search(qFolded).map((hit) => hit.item);

    // Tier 3: phonetic
    const phoneticMatches =
      qCodes.length > 0
        ? rows
            .filter((r) => r.c.some((c) => qCodes.includes(c)))
            .sort((a, b) => a.n.localeCompare(b.n))
        : [];

    const seen = new Set<string>();
    const ranked: Array<{ row: SearchIndexRow; tier: 1 | 2 | 3 }> = [];
    for (const [tier, list] of [
      [1, prefixMatches],
      [2, fuzzyMatches],
      [3, phoneticMatches],
    ] as const) {
      for (const row of list) {
        if (seen.has(row.id)) continue;
        seen.add(row.id);
        ranked.push({ row, tier });
        if (ranked.length >= MAX_RESULTS) break;
      }
      if (ranked.length >= MAX_RESULTS) break;
    }

    // Hydrate display data for the shortlist (bounded: ≤ MAX_RESULTS reads).
    const ids = ranked.map((r) => r.row.id);
    const detailById = new Map<string, admin.firestore.DocumentData>();
    const cardStatusByUser = new Map<string, "Active" | "Unloaded">();
    if (ids.length > 0) {
      const [snap, cardSnap] = await Promise.all([
        db
          .collection("users")
          .where(admin.firestore.FieldPath.documentId(), "in", ids)
          .select(
            "firstName",
            "secondName",
            "aliases",
            "photoThumb",
            "dateOfBirth",
            "postalCode",
            "banned",
            "flagged",
            "flagReason",
            "banReason",
            "status",
          )
          .get(),
        db
          .collection("arc_cards")
          .where("currentUserId", "in", ids)
          .select("currentUserId", "status")
          .get(),
      ]);
      for (const doc of snap.docs) detailById.set(doc.id, doc.data());
      for (const doc of cardSnap.docs) {
        const d = doc.data() as {
          currentUserId?: string | null;
          status?: string;
        };
        if (!d.currentUserId) continue;
        if (d.status === "Active") {
          cardStatusByUser.set(d.currentUserId, "Active");
        } else if (
          d.status === "Unloaded" &&
          !cardStatusByUser.has(d.currentUserId)
        ) {
          cardStatusByUser.set(d.currentUserId, "Unloaded");
        }
      }
    }

    const results = ranked.map(({ row, tier }) => {
      const d = detailById.get(row.id);
      return {
        id: row.id,
        name: row.n,
        tier,
        aliases: (d?.aliases as string[] | undefined) ?? [],
        dateOfBirth: (d?.dateOfBirth as string | undefined) ?? "",
        postalCode: (d?.postalCode as string | undefined) ?? "",
        banned: Boolean(d?.banned),
        flagged: Boolean(d?.flagged),
        flagReason: (d?.flagReason as string | undefined) ?? "",
        banReason: (d?.banReason as string | undefined) ?? "",
        status: (d?.status as string | undefined) ?? "Active",
        picture: (d?.photoThumb as string | undefined) ?? "",
        arcCardStatus: cardStatusByUser.get(row.id),
      };
    });

    return NextResponse.json({ ids, results });
  } catch (error) {
    console.error("User search error:", error);
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
}
