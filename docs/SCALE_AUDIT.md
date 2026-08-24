# Scale & Pagination Audit — Every Query, Every Page

> Full audit of each Firestore query and each page in the app, measured against a
> production ceiling of **10,000 ARC cards** (modelled alongside ~6,000 recipients,
> ~25,000 issues, ~30,000 history entries, ~500 bans, ~25 staff).
> Companion to the Aug 2026 production-readiness audit (SCALE-01…05) and the
> security-rules work in `docs/SECURITY_TEST_SCENARIOS.md`.
>
> Verification tooling: `tests/stress/` (seed / measure / concurrent / cleanup).

---

## 1. Platform limits the app must live under

| Limit | Value | Where it binds |
|---|---|---|
| Vercel serverless response body | **4.5 MB hard cap** | `/api/cards`, `/api/dashboard/summary`, `/api/reports/data` |
| Vercel function duration | 10–15 s default (raise via `maxDuration`) | `/api/reports/export`, `/api/cron/expire-cards` |
| Vercel function memory | ~1–2 GB | `/api/reports/data` (holds 5 collections in RAM) |
| Firestore document size | 1 MiB | `users.picture` base64 (enforced at 1 MB in register-recipient) |
| Firestore batch write | 500 ops | cron unload (uses 400 — OK) |
| Firestore `in` query | **30 values** | `/api/cards` chunks at 10 (3× more queries than needed) |
| Firestore sustained write rate | ~1 write/s per doc; ramp new collections 500/50/5 | bulk seeding, cron |
| Firestore full-scan cost | reads billed **per document** | every unbounded `.get()` below |

Key property to certify: an endpoint is scale-safe when its cost is **O(page size)**,
not O(collection size). Only one endpoint in the app passes today.

---

## 2. Backend audit — every query, per endpoint

Legend: reads/req = Firestore document reads per request at the 10k-card model.
"FAIL @" = the collection size where the endpoint stops working entirely.

### 2.1 `GET /api/cards` — `src/app/api/cards/route.ts:147`

| Query | Location | Bound? |
|---|---|---|
| `arc_cards.get()` (full scan) | `route.ts:156` | ❌ unbounded |
| `_migrations/issues_v1.get()` | `route.ts:158` | ✅ 1 doc |
| `issues.get()` (full scan) | `route.ts:166` (also pre-migration path `:242`) | ❌ unbounded |
| `users` by id, `in` chunks of **10**, all fired in parallel | `route.ts:124-141` | ❌ grows with distinct holders (~6,000 → 600 parallel queries) |
| `app_settings/arc_card_monthly_unload.get()` | via `getMonthlyUnloadSchedule`, `route.ts:293` | ✅ 1 doc |
| session verify + staff doc | `route.ts:75,93` | ✅ 2 |

- **Reads/req at 10k cards:** ~41,000 (10k cards + 25k issues + 6k user name docs + auth).
- **Response size:** ~400–600 B/card serialized → **5–6 MB. FAIL @ ≈ 8,000–9,000 cards**
  (Vercel 4.5 MB cap). Latency seconds-long well before that.
- **Verdict: BLOCKER.** The card master list dies before the 10k ceiling.
- **Fix:** cursor pagination (`orderBy("arcCardNumber").startAfter(cursor).limit(pageSize)`),
  status/department filters as `where` clauses, derive `passRecipient`/`issueDates`
  only for the returned page (one `in` chunk of ≤30), return `nextCursor`.

### 2.2 `POST /api/cards` — `route.ts:305`

- Writes each card with `await …add()` **sequentially in a loop** (`route.ts:340`) —
  no batch, no cap on `body.cards` length, and **no duplicate `arcCardNumber` check**.
- 100-card allocation = 100 round-trips (~10–30 s risk); a 5,000-card POST times out
  mid-loop leaving a partial, unreported write set.
- **Verdict: needs work before bulk allocations.**
- **Fix:** cap batch size (e.g. 200/request), use `db.batch()`, enforce unique card
  number via a transaction on a lookup doc or a pre-query.

### 2.3 `PATCH /api/cards` (status / force-unassign / schedule) — `route.ts:365`

- All reads are single-doc or `limit(1)` (`route.ts:464-470,580-586`); mirror updates
  wrapped in transactions. **Verdict: scale-safe.** (Concurrency: last-write-wins on
  plain status change is the known SYNC-01 issue, orthogonal to scale.)

### 2.4 `GET /api/cards/search` — `src/app/api/cards/search/route.ts:45-53`

- Indexed `where` + `orderBy` + `startAt/endAt` prefix + `limit(7)`.
- **Reads/req: ≤ 9. Verdict: ✅ the reference pattern.** Every list endpoint should
  look like this.

### 2.5 `GET /api/dashboard/summary` — `src/app/services/dashboardService.ts:90-121`

| Query | Bound? |
|---|---|
| `users.select(… "picture" …).get()` — full scan **including base64 photo** | ❌ |
| `issues.select(…).get()` — full scan | ❌ |
| `arc_cards.select("status","currentUserId").get()` — full scan | ❌ |
| 4 × `count()` aggregates (`dashboardService.ts:117-120`) | ✅ cheap, correct pattern |

- **Measured:** 5.48 MB at 57 recipients → **already over the 4.5 MB cap. FAIL @ ≈ 41
  recipients.** At 6,000 recipients the users read alone is ~660 MB in function memory.
- Photos are **99.5 %** of the payload (measured).
- **Reads/req at model scale:** ~41,000.
- **Verdict: BLOCKER (worst endpoint).**
- **Fix:** select `photoThumb` instead of `picture` (photo split, SCALE-02);
  paginate users server-side; move search server-side (SCALE-03); compute
  `arcCardStatus`/`lastIssued` per page via bounded queries, or denormalize
  `lastIssuedAt`/`cardStatus` onto the user doc at write time.

### 2.6 `GET /api/reports/data` — `src/app/api/reports/data/route.ts:65-73`

- **Five full-collection scans in parallel**: `users` (full docs incl. photos),
  `arc_cards`, `issues`, `banned_users`, `history`, then builds nested
  per-user card/activity history in memory and returns *everything* as one JSON.
- `history` and `issues` grow monotonically forever — this endpoint degrades even
  with zero new recipients.
- **Reads/req at model scale:** ~72,000. Response/memory: hundreds of MB.
  **FAIL @ ≈ 40 recipients** (same photo cap; users are returned with full doc data).
- **Verdict: BLOCKER.**
- **Fix:** paginate the user rows server-side; fetch card/activity history lazily per
  expanded row (`where("userId","==",id).limit(n)` — indexes already exist); strip
  `picture`; move filters (flag/status/date/staff) into the query.

### 2.7 `POST /api/reports/export` — `src/app/api/reports/export/route.ts:140-154`

- Full `arc_cards` + full `issues` scans, then a **sequential N+1**: one awaited
  `users.doc(uid).get()` per distinct holder (`route.ts:141-154`, and again at
  `:182` pre-migration). At 6,000 holders ≈ 6,000 serial round-trips ≈ **minutes →
  guaranteed function timeout.** This is the worst *latency* offender in the app.
- **Verdict: BLOCKER at scale.**
- **Fix:** date-range filter as a Firestore `where` on `allocationDate` first, then
  batch names via `in` chunks of 30 (helper already exists in `admin/actions.ts:530`).
  Consider streaming or emailing large exports.

### 2.8 `GET /api/cron/expire-cards` → `cardExpiryService.ts:152-194`

- `arc_cards.get()` full scan, then rewrites **every non-Unloaded card** in 400-op
  batches (sequential commits). At 10k cards: 10k reads + up to 10k writes ≈ 25
  serial commits → 15–30 s. Default `maxDuration` will kill it mid-run; the
  `lastRunMonthKey` marker only lands in the final batch, so a killed run repeats
  work (idempotent, but never completes).
- No overlap lock (two concurrent invocations both scan/write).
- **Verdict: needs work before ~2,000 cards.**
- **Fix:** query only `where("status", "in", ["Active","Unattributed","Expired","Cancelled"])`
  (or `!=` with index); set `maxDuration: 300`; write the month marker first with a
  transactional check as a poor-man's lock; page the scan with cursors.

### 2.9 Auth / session routes — all ✅ O(1)

- `POST /api/session-login` (`route.ts:17-43`): verify + 1 staff doc.
- `GET /api/user-session`, `POST /api/authorise-staff`, `POST /api/logout`,
  `POST /api/set-admin`, `admin/api/*` (create-admin, sign-in, get-custom-token):
  constant reads. **Scale-safe.**
- `POST /api/register-recipient` (`route.ts:177-249`): transaction with `limit(1)`
  card lookup + bounded stale-issue cleanup. **Scale-safe.** (Photo ≤ 1 MB base64
  enforced at `route.ts:113` — the size itself is the SCALE-02 problem, see §4.)
- `POST /api/register-staff`: constant. ✅

### 2.10 Admin server actions — `src/app/admin/actions.ts`

| Action | Pattern | Verdict |
|---|---|---|
| `getAdministrativeStaff` (`:137`) | full `administrative_staff` scan | ✅ acceptable (staff ≈ dozens); revisit if staff > ~500 |
| `getAdministrativeStaffSummary` (`:425-437`) | 4 × `count()` aggregates | ✅ exemplary |
| `getStaffRecipients/Issues/AuditEntries/Bans` (`:554-707`) | `where(...).limit(100)` + `in` chunks of **30** | ✅ correct pattern |
| `listUsers` (`:115`) | `auth().listUsers()` (first 1000) | ✅ fine (auth users = staff+admins only) |

### 2.11 `(app)/layout.tsx` server layout — `src/app/(app)/layout.tsx:19-40`

- Every page navigation performs `verifySessionCookie(…, true)` (revocation check =
  Auth API round-trip) + staff doc read + `auth().getUser()` — 3 serial network calls
  **before** the page's own API call repeats the same verification (SCALE-05).
- **Verdict:** correctness fine; adds ~100–300 ms per navigation. Collapse into one
  verification (drop `checkRevoked` on hot read paths, or cache the staff check).

### 2.12 Dead client-side data layer

- `src/app/services/userService.ts` + `administrativeStaffService.ts`: client-SDK CRUD
  imported by nothing but still bundled (DATA-04). Any future caller would inherit
  unbounded client reads now **blocked by the deployed security rules** (staff can
  still read collections directly — rules allow it — so a revived client-side
  full-collection read would bypass all server paging). **Delete.**

---

## 3. Frontend audit — every page

### 3.1 `/dashboard` — `src/app/(app)/dashboard/page.tsx`

- Fetches `/api/dashboard/summary` (module-level 30 s cache, `page.tsx:55-59`).
- **No pagination of any kind** — renders every recipient card into the DOM
  (`page.tsx:274`), each with its full base64 photo as an `<Image src="data:…">`.
- Search: a **new Fuse.js index is built over the full user list on every keystroke**
  (`page.tsx:160-166`) — O(N) per character typed.
- `createdBy` filter is a client-side `Array.filter`.
- **Verdict at 10k scale: unusable** — even if the API paginated, this UI renders an
  unbounded list.
- **UI work needed:** paged or virtualized list + pagination controls (none exist
  today — this page needs *new* UI, unlike cards/reports); debounced server-side
  search box; `photoThumb` avatars (small base64) with the full photo loaded
  lazily via `/api/users/[id]/photo`; "load more" or numbered pages;
  keep stat tiles (already backed by `count()` aggregates).

### 3.2 `/cards` — `src/app/(app)/cards/page.tsx`

- Fetches the **entire** `/api/cards` payload once (`page.tsx:420-433`), then
  TanStack Table paginates **client-side** at 15 rows (`page.tsx:599-605`).
  The pagination footer (`page.tsx:874-902`) is cosmetic: the network/server cost
  already happened.
- Search (`page.tsx:436-462`) and status/department filters are in-memory scans of
  the full array; "X of Y (filtered from Z)" counts assume the full dataset is local.
- **Verdict: UI shell is 80 % reusable** — prev/next footer maps cleanly onto cursor
  pagination.
- **UI work needed:** wire footer to server cursors (`nextCursor`/`prevCursor` state,
  disable prev on first page); move search to a debounced call of a server search
  endpoint (extend `/api/cards/search` beyond unattributed-only); filter drawer
  passes `status`/`department` as query params; total count from a `count()`
  aggregate instead of `data.length`; sort headers become server `orderBy` params
  (or restrict sorting to the current page).

### 3.3 `/reports` — `src/app/(app)/reports/page.tsx`

- Fetches the **entire** `/api/reports/data` payload (`page.tsx:494-505`); TanStack
  client pagination at 20 rows (`page.tsx:1104-1108`).
- Heavy client-side filtering (`page.tsx:507-617`): date-range parsing plus nested
  `some()` scans over every user's `cardHistory`/`activityHistory` per filter change.
- XLSX export **client-side over the full dataset** (`page.tsx:880-885`); a proper
  server export exists only for cards (`/api/reports/export`, itself broken at
  scale, §2.7).
- Filter option lists (`availableCardStatuses` etc., `page.tsx:463-481`) are derived
  by scanning the full dataset.
- **Verdict: needs the deepest rework** — its filter model assumes all data is local.
- **UI work needed:** server-driven pagination + filters (each filter becomes a query
  param); expanded-row card/activity history fetched lazily on expand; exports go
  through server endpoints with the same filter params (never "export what the
  browser holds"); filter option lists become static enums or served from aggregates.
- **URL contract already in place (Aug 2026):** `/reports?search=` and
  `/reports?userId=` are live as client-side filters (history-synced, deep-linked
  from the dashboard list and search rows). When SCALE-01/03 pagination lands here,
  these two params must move INTO the API query (`where`/document fetch) rather
  than remaining client-side `filter()` calls — the URL contract itself stays
  unchanged, so the dashboard links keep working. `userId` especially becomes
  cheaper than the full view at that point (1 doc + subqueries instead of 5 scans).

### 3.4 `/cards/new` — `src/app/(app)/cards/new/page.tsx`

- Posts to `/api/cards`. UI is fine; backend needs the batch/dedupe fix (§2.2).
  Add a client-side cap + progress feedback for large allocations.

### 3.5 Register-recipient modal — `src/app/components/register_recipient/`

- Card lookup uses the server-limited `/api/cards/search` ✅.
- `PhotoUploadForm.tsx` compresses the photo to a ≤ 1 MB base64 string — the
  **root cause of SCALE-02** when stored inline on the user doc.
- **Resolved (base64 kept):** the form now also emits a ~3 KB `thumbnail`; the
  API stores the thumb on the user doc and the full-res base64 in
  `user_photos/{uid}` (progressive load via `/api/users/[id]/photo`).

### 3.6 `/it-admin` — server redirect page ✅. `/login`, `/register`,
`/admin/login`, `/admin/register` — auth flows, O(1) ✅.

### 3.7 `/admin/dashboard` — `src/app/admin/dashboard/page.tsx`

- Server actions (`getAdministrativeStaff`, per-staff `count()` summaries, drill-down
  modals capped at 100). **Scale-safe for realistic staff counts.** Drill-down modals
  should get a "showing first 100" indicator (silent cap today).
- Staff selector (`(app)/StaffSelector.tsx:43`) reuses `getAdministrativeStaff` ✅.

---

## 4. Cross-cutting root causes

1. **Base64 photos inside `users` docs** (~110 KB avg, 99.5 % of user payload).
   Strategy (base64 is retained by design): **split the photo out of the list
   path** — a small `photoThumb` (~3 KB, 96 px JPEG base64) stays on the user
   doc for list avatars; the full-res base64 moves to a `user_photos/{uid}` doc
   and loads progressively via `GET /api/users/[id]/photo` only when a detail
   view needs it. Turns the dashboard cap from ~41 users into a non-issue and
   shrinks reports/memory by ~30× once the legacy `picture` field is pruned.
   `user_photos` is server-only (deny-by-default rules; no client grant needed).
   Hardening: the API validates the declared mimetype against magic bytes and
   regenerates the thumbnail server-side with sharp (client thumb is ignored);
   the photo endpoint serves real `image/jpeg` bytes (browser-cacheable, ~25%
   smaller than base64-in-JSON) while Firestore storage stays base64.
2. **No server-side pagination anywhere** except `/api/cards/search`. Every list is
   full-scan → serialize → let the client slice.
3. **Derived display data computed by cross-joining full collections per request**
   (`passRecipient`, `issueDates`, `arcCardStatus`, `lastIssued`). Either compute
   per-page with bounded queries, or denormalize at write time (the codebase already
   maintains mirror fields — extend the pattern).
4. **`issues`/`history` grow forever** — any endpoint that full-scans them gets
   slower every month even with zero new recipients.
5. **Read amplification = billing exposure.** One dashboard load at model scale
   ≈ 41k billed reads; 13 staff refreshing through a workday reaches millions of
   reads/month. Post-pagination a dashboard load should cost ~25–60 reads.
6. **Every request re-verifies session with revocation check** (§2.11) — serial
   Auth API round-trips stacked on each navigation.

---

## 5. Failure thresholds (measured + projected)

| Endpoint | Baseline (measured Aug 2026) | Hard-fail point | At 10,000 cards |
|---|---|---|---|
| `/api/dashboard/summary` | 5.48 MB @ 57 recipients (**over cap**) | ~41 recipients | ~660 MB scanned, unusable |
| `/api/reports/data` | 5.57 MB footprint @ 57 recipients | ~40 recipients | OOM / cap, unusable |
| `/api/cards` | 43 KB @ ~90 cards | ~8–9k cards (4.5 MB) | 5–6 MB + ~41k reads — FAIL |
| `/api/reports/export` | OK at 40 cards | ~hundreds of holders (timeout) | minutes of N+1 — FAIL |
| `/api/cron/expire-cards` | OK at 40 cards | ~2k cards (10 s duration) | 25 serial batches — FAIL |
| `/api/cards/search` | ≤ 9 reads | none | ✅ flat |
| Auth/session/admin actions | O(1) / bounded | none | ✅ flat |

---

## 6. Work split — what to fix where

### Backend (API routes / services) — data-layer changes

| Priority | Route / service | Work |
|---|---|---|
| P1 | `GET /api/cards` | ✅ Done: cursor pagination + status/department filters + card-number/recipient-name search (via the name index) + `count()` totals + per-page joins (`in` ≤ 30) |
| P1 | `dashboardService.ts` | ✅ Done: `photoThumb`-only select, cursor-paged users (newest first) with per-page card/issue joins, server search, `count()` stats + total |
| P1 | `GET /api/reports/data` | ✅ Done: `select()`-stripped AND cursor-paginated — one page of users per request with banned/history/issues/cards joined via bounded `in`-queries (no full scans remain on this route); the client walks pages on load so every filter/export keeps working. Still open (true P2 redesign): filters→queries + lazy expanded-row detail, which require the client filter-model rework |
| P1 | Photo split (base64 kept) | ✅ Done: `photoThumb` on user doc + `user_photos/{uid}` full-res + lazy `GET /api/users/[id]/photo`; `scripts/migrate-photos.mjs` backfills (run `--prune` post-deploy to drop legacy `picture`) |
| P1 | `POST /api/reports/export` | ✅ Done: N+1 replaced with batched `in` joins (30/chunk), `maxDuration: 120`, `select()` on scans. (Date pre-filtering stays client-side: `allocationDate` mixes ISO and M/D/YYYY formats, so a string-range `where` would silently drop rows) |
| P2 | `POST /api/cards` | ✅ Done: single atomic `db.batch()` (no partial creations), 200/request cap, duplicate-number guard in-request and against existing cards (check-then-write race noted as accepted) |
| P2 | `cron/expire-cards` | ✅ Done: sweep queries only non-Unloaded statuses in 400-doc batches (re-query-until-empty), month claimed transactionally BEFORE sweeping so overlapping invocations can't double-process, `?dryRun=1` reports via one aggregate, `maxDuration: 300` |
| P2 | `(app)/layout.tsx` + per-route auth | ✅ Done: layout reads name/email from session claims (no `getUser`) and skips revocation; `checkRevoked` dropped on hot read routes (summary, searches, photo, cards GET, reports data) and kept on all writes + export |
| P2 | `firestore.indexes.json` | ✅ Done (P1): composite (status\|department + arcCardNumber) deployed |
| P3 | `services/userService.ts`, `administrativeStaffService.ts` | Delete dead client data layer |

### Frontend (pages / components) — UI changes

| Priority | Page | Work |
|---|---|---|
| P1 | `/dashboard` | ✅ Done: Load More pagination (60/page, "x of y"), debounced server search (search-first `?search=` mode), thumbnail avatars; search hits beyond loaded pages render from server-hydrated results |
| P1 | `/cards` | ✅ Done: prev/next walk server cursors, debounced server search (card number or recipient name), filter drawer → query params, totals from `count()`; sorting is within-page |
| P1 | Register-recipient modal | ✅ Done: emits ~3 KB thumbnail alongside the ≤ 1 MB base64 (both stay base64) |
| P2 | `/reports` | Server-driven filters + pagination; lazy expanded-row history; exports via server with filter params; static filter option lists |
| P2 | `/cards/new` | ✅ Done: 200-card client cap matching the server, server error messages (e.g. duplicates) surfaced instead of a generic failure |
| P3 | `/admin/dashboard` | "First 100 shown" indicator on drill-down modals |

Rule of thumb for the rewires: **`/cards` and `/reports` keep their table UI and lose
their "all data is local" assumption; `/dashboard` needs pagination UI built from
scratch.** Client-side sorting/filtering can remain as a *within-page* refinement,
but counts, search, and navigation must come from the server.

---

## 7. Verification method

Progressive production test (tooling in `tests/stress/`), designed to stay inside
Firestore limits: batched writes ≤ 400 ops with pauses between commits, bounded
parallelism for simulated concurrent staff writes, all synthetic docs prefixed
`__stress_` and removed by `cleanup.mjs`. Stages: baseline measure → +250 cards →
measure → concurrent multi-writer burst → +1,000–2,500 cards → measure → cleanup.
Pass criterion: bounded endpoints stay flat as N grows; unbounded endpoints grow
linearly (documented above) until their caps.
