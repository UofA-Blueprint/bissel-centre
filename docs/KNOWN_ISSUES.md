# Known Issues & Backlog

An honest list of what is not perfect, so the next maintainer finds out from
this file rather than from a user. Nothing here blocks release.

---

## Test coverage gaps

**End-to-end coverage is essentially a placeholder.** `tests/e2e/home.spec.ts`
only asserts that the home page has a non-null title. The CI pipeline runs
Playwright, so the harness works — but no real user journey is covered
automatically. Every meaningful flow is verified by hand using
[`QA_CHECKLIST.md`](QA_CHECKLIST.md).

*Highest-value next step:* automate the top three flows from the checklist
(register a recipient, assign a card, export a report). That converts the
longest part of each release from manual clicking into a CI check.

The Jest suite (48 tests across 8 suites) covers services and API route logic,
not UI behaviour.

**The Firestore security rules tests are wired up but not yet enforced.**
`tests/firestore-rules.test.mjs` covers every collection × role × operation
against the deny-by-default rules. Historically nothing invoked it: Jest only
collects the eight suites under `src/tests/`, and this file is `.mjs` requiring
the Firestore emulator. It now runs in CI via `npm run test:rules`, but the step
is marked `continue-on-error` because it has no established green baseline.

**Action required:** after the first CI run, check the "Run Firestore Rules
Tests" step. If it passed, delete the `continue-on-error: true` line in
`.github/workflows/ci-cd.yml` so a future rules regression actually fails the
build. If it failed, the rules and the test have drifted apart and one of them
needs updating — until then, nothing verifies your access controls.

Running it locally needs **Java 21 or newer** installed (the emulator is a Java
process, and current `firebase-tools` refuses to start on anything older). On
macOS, `brew install --cask temurin` is the quickest route. CI installs Java 21
itself, so this only affects running `npm run test:rules` on your own machine.

---

## Lint warnings

`npm run lint` reports 5 warnings and 0 errors. All five are unused
`eslint-disable` comments — suppressions left behind after the underlying
problems were fixed. They are cosmetic and auto-fixable with
`npx eslint . --fix`. They were left alone to avoid unrelated churn close to
release.

---

## Deployment pipeline

**CI uses `npm install`, not `npm ci`.** The lockfile is therefore not strictly
enforced during builds, so CI can resolve slightly different dependency versions
than a developer has locally. Switching to `npm ci` would make builds
reproducible.

---

## Operational fragility

**Environment variables live in three places** (developer `.env.local`, Vercel
project settings, GitHub Actions secrets) with nothing keeping them in sync.
Adding a new variable means remembering all three. A missing one in Vercel
produces a successful deploy that throws at runtime.

**Firestore rules and indexes deploy separately** from the app. The CI pipeline
does not touch them, so a change to `firestore.indexes.json` that isn't manually
deployed causes queries to fail only in production. See the runbook.

**The Edmonton timezone string is duplicated in nine files** rather than living
in one shared date helper. This is not hypothetical harm: the reports date
filters were written with a hardcoded `-06:00` offset instead, which is only
Edmonton's offset during daylight saving and silently dropped records in the
final hour of a range every winter. That has been fixed, but the next piece of
date code written without the shared constant can repeat it. Worth extracting
into `src/utils/` the next time date handling is touched.

**Middleware does not list every protected route.** `STAFF_ONLY_ROUTES` in
`middleware.ts` covers `/dashboard`, `/profile`, `/cards`, and `/reports` but not
`/it-admin`. There is no actual hole — the `(app)` layout and the `/it-admin`
page each verify the session server-side and redirect — but the middleware list
should be kept in step so the outer guard stays meaningful.

**Two secrets are effectively permanent.** Changing `PHONE_ENCRYPTION_KEY` makes
all stored recipient phone numbers unreadable; changing `IT_ID_HASH_PEPPER`
locks out every IT Admin. Neither has a migration path. If either ever needs to
rotate, it requires a re-encryption/re-registration script written first.

---

## Product behaviour worth documenting

**Staff display names come from the session.** If an IT Admin renames a staff
member, the new name doesn't appear in that person's top navigation until they
sign out and back in. Everywhere else reads live data, so this is only a
cosmetic lag for the affected user.

**The cron job runs daily but acts monthly.** `/api/cron/expire-cards` is
invoked once a day (the most Vercel's Hobby plan allows) and exits immediately
unless the configured monthly day-and-time has passed and the current month
hasn't been processed. This is deliberate for resilience, but Vercel's cron log
will therefore show roughly thirty invocations a month that did nothing. Check
the "last run" indicator on the Cards page to see the meaningful runs.

A consequence of the daily cadence: the unload happens on the *first daily run
at or after* the configured time, so it can land up to 24 hours late. Moving to
a Vercel Pro plan would allow an hourly schedule and shrink that window.

**The Reports "card issue date" filter ignores the issues-migration switch.**
Card issue dates live in one of two places: the legacy `issueDates` array on each
`arc_cards` document, or one document per handover in the `issues` collection.
Which one is authoritative is decided by whether `_migrations/issues_v1` exists.
Every display path checks that marker (`isMigrated` in
`src/app/api/reports/data/route.ts`, `src/app/api/cards/route.ts` and
`src/app/api/reports/export/route.ts`). The `issuedFrom`/`issuedTo` filter does
not — it queries the `issues` collection unconditionally
(`src/app/api/reports/data/route.ts`, the `idsFromSimpleLayer` call guarded by
`if (f.issuedFrom || f.issuedTo)`).

If `_migrations/issues_v1` is absent in a given environment, that filter narrows
the result set against a collection the rest of the app is ignoring, so
recipients are dropped silently — the page cannot recover rows the server has
already excluded. Staging filtered these dates in the browser, where the problem
could not arise; the server-side narrowing arrived with the reports performance
work.

**How to tell whether it is biting you:** check Firestore for
`_migrations/issues_v1`. If it exists, the filter is correct as written — every
code path that writes `issueDate` uses `formatEdmontonDate`, so the values are
consistently `YYYY-MM-DD` and the string range compares correctly and
inclusively. If it does not exist, filtering Reports by card issue date will
under-report.

**The fix**, should it be needed, is to make that filter branch on `isMigrated`
the way the display code does, falling back to matching against the card
documents' `issueDates` arrays. Note those legacy arrays can hold `M/D/YYYY`
values, so a Firestore string range is unsafe against them — the client's
`parseFlexibleDate` handles both shapes and is the model to follow. This is the
same reason `card_allocation` is deliberately excluded from server-side date
filtering.

**Searching while a staff filter is applied only matches loaded recipients.** On
the dashboard, when `?createdBy=` is set, search results are restricted to
recipients already fetched into the page; matches on later pages are
deliberately dropped rather than shown unfiltered. Clearing the staff filter
searches everyone correctly.

**Banned/flagged icons differ between the two dashboard views.** The recipient
card correctly shows an orange flag for flagged and a red cross for banned. The
dense search-results row (`/dashboard?search=`) instead shows a red *flag* icon
for banned recipients, labelled "Flagged user", and shows nothing for flagged
ones. Cosmetic and confined to search mode.

**The Banned Users stat icon is selected by matching the label text.** The stats
array still carries `/flag.svg` for that card and `StatCard` special-cases
`label === "Banned Users"` to render the red cross instead. It renders
correctly, but renaming the label would silently revert the icon.

**Recipient photos live in Firestore rather than Firebase Storage.** The split is
deliberate and works well: `recipientPhotoService.ts` uses `sharp` to produce a
96px JPEG thumbnail that is stored as base64 on the user document, while the
full-resolution image goes to a separate `user_photos/{id}` document that loads
lazily only when a single recipient is opened. Size is capped at 1 MB for the
source and 20 KB for the thumbnail, so list views stay cheap. The remaining
limitation is simply that image bytes sit in Firestore documents at all — if
storage or read costs become a problem, Firebase Storage is the destination.

---

## Dead code

**Four service modules have no imports anywhere in the codebase:**

| Module | Status |
|---|---|
| `src/app/services/userService.ts` | unused |
| `src/app/services/administrativeStaffService.ts` | unused |
| `src/app/services/arcCardService.ts` | unused |
| `src/app/services/authService.ts` | unused |

These are the remains of an earlier client-SDK data layer; everything now goes
through API routes using the Admin SDK. `docs/SCALE_AUDIT.md` already lists
their removal as a P3 item ("Delete dead client data layer"). They are inert —
unreferenced modules are tree-shaken out of the build — but they are actively
misleading in two ways.

First, `userService.ts` contains `banUser`/`unbanUser` that disagree with the
live implementation: the real route (`PATCH /api/recipients/[id]`) writes
`banned_users/{userId}`, which is idempotent, whereas these use `addDoc` and
would create a second document if someone were banned twice, inflating the
dashboard's banned count. Anyone who wired them back up would introduce that bug.

Second, the two `TODO: Create Firebase composite index` comments in that file
describe queries that no longer run, so they read as outstanding work when
nothing is outstanding.

---

## Repository hygiene

`test-results.json` and the `test-results/` directory are generated Playwright
output. They should not be in version control and are ignored going forward.
