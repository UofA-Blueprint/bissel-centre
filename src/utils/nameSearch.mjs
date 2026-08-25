/**
 * Name folding + search-index entry building.
 *
 * Single source of truth for how names are normalized for search — imported
 * by BOTH the Next.js API routes and the Node maintenance scripts. The same
 * folding MUST run at index-build time and at query time or matches silently
 * fail.
 *
 * Designed for the Bissell Centre population (50-60% Indigenous clients —
 * Cree, Métis, Dene, Blackfoot): standard NFD accent-stripping handles Cree
 * SRO vowels (macron AND circumflex conventions) and ogonek nasal vowels,
 * but several Dene/European letters are atomic Unicode codepoints with NO
 * decomposition and need the explicit map below. Apostrophes circulate as
 * three distinct codepoints (ASCII ', curly ’, modifier ʼ) that do not
 * normalize to each other — all are removed. Canadian Aboriginal Syllabics
 * pass through untouched (searchable verbatim).
 */

import { doubleMetaphone } from "double-metaphone";

// ASCII apostrophe, curly quotes, okina, modifier apostrophe, backtick, acute.
const APOSTROPHE_CLASS = /['‘’ʻʼ`´]/g;

// Letters with no NFD decomposition — NFD-strip alone passes them through.
const ATOMIC_FOLDS = new Map(
  Object.entries({
    ł: "l", // ł  (Tłı̨chǫ, Dëne Sųłıné)
    đ: "d", // đ
    ø: "o", // ø
    æ: "ae", // æ
    œ: "oe", // œ
    ß: "ss", // ß
    þ: "th", // þ
    ð: "d", // ð
    ǝ: "e", // ǝ  (Dene Kǝdǝ́)
    ə: "e", // ə
    ı: "i", // ı  (dotless i — Tłı̨chǫ ı̨ decomposes to this + ogonek)
    ŋ: "n", // ŋ
    ʔ: "", //  ʔ  glottal stop (letter, not punctuation)
    ɂ: "", //  ɂ  glottal stop, small
    ŧ: "t", // ŧ
    ħ: "h", // ħ
  }),
);

/**
 * Fold a name to its canonical search form. Lowercase, apostrophes removed,
 * accents stripped (NFD), atomic letters mapped, punctuation collapsed to
 * single spaces. Returns "" for empty input.
 */
export function foldName(input) {
  if (!input) return "";
  let s = String(input).toLowerCase();
  s = s.replace(APOSTROPHE_CLASS, "");
  s = s.normalize("NFD").replace(/[̀-ͯ]/g, "");
  let out = "";
  for (const ch of s) {
    out += ATOMIC_FOLDS.has(ch) ? ATOMIC_FOLDS.get(ch) : ch;
  }
  return out
    .replace(/[.\-_,/\\]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function tokensOf(folded) {
  return folded ? folded.split(" ").filter((t) => t.length > 0) : [];
}

/**
 * Variants a prefix search should match against: the full folded string,
 * each token, the fully-joined form, and adjacent-pair joins — so
 * "Littlechild" and "Little Child" find each other in both directions.
 */
export function searchVariants(folded) {
  const out = new Set();
  const toks = tokensOf(folded);
  if (folded) out.add(folded);
  for (const t of toks) out.add(t);
  if (toks.length > 1) {
    out.add(toks.join(""));
    for (let i = 0; i < toks.length - 1; i++) {
      out.add(toks[i] + toks[i + 1]);
    }
  }
  return Array.from(out);
}

/**
 * Double Metaphone codes per token. English/French-phonology algorithm — it
 * earns its keep on translated/fur-trade surnames (Littlechild, Cardinal,
 * L'Hirondelle) but has NO ruleset for Cree/Dene phonology, which is why
 * phonetic matching is the LOWEST-ranked tier, never the primary one.
 */
export function phoneticCodes(folded) {
  const codes = new Set();
  for (const t of tokensOf(folded)) {
    if (t.length < 2 || !/^[a-z]+$/.test(t)) continue;
    const [primary, secondary] = doubleMetaphone(t);
    if (primary) codes.add(primary);
    if (secondary) codes.add(secondary);
  }
  return Array.from(codes);
}

/**
 * Build the search-index entry for one user doc. Aliases are first-class:
 * street names are how many clients are actually known, and reclaimed
 * traditional names mean former names should live on in aliases.
 */
export function buildIndexEntry(user) {
  const displayName = [user.firstName, user.secondName]
    .filter((p) => typeof p === "string" && p.trim().length > 0)
    .join(" ")
    .trim();
  const aliases = Array.isArray(user.aliases)
    ? user.aliases.filter((a) => typeof a === "string" && a.trim().length > 0)
    : [];
  const postalCode =
    typeof user.postalCode === "string" ? user.postalCode.trim() : "";

  const strings = new Set();
  const codes = new Set();
  for (const source of [displayName, ...aliases, postalCode]) {
    const folded = foldName(source);
    if (!folded) continue;
    for (const v of searchVariants(folded)) strings.add(v);
    if (source !== postalCode) {
      for (const c of phoneticCodes(folded)) codes.add(c);
    }
  }

  return {
    n: displayName || "(unnamed)",
    s: Array.from(strings),
    c: Array.from(codes),
  };
}

// ── Index sharding ───────────────────────────────────────────────
// A single doc would pass Firestore's 1 MiB cap somewhere around 5-6k
// users; four shards keep each comfortably small at the 10k ceiling.

export const SEARCH_INDEX_COLLECTION = "search_index";
export const SEARCH_INDEX_SHARDS = 4;

export function shardForUserId(userId) {
  let h = 0;
  for (let i = 0; i < userId.length; i++) {
    h = (h * 31 + userId.charCodeAt(i)) >>> 0;
  }
  return h % SEARCH_INDEX_SHARDS;
}

export function shardDocId(shard) {
  return `users_${shard}`;
}
