# Bissell Centre — ARC Card Management

Internal web app for Bissell Centre staff to register recipients, issue and track
ARC transit cards, and report on usage.

Built with Next.js (App Router), React 19, Tailwind CSS, and Firebase
(Authentication + Firestore). Deployed on Vercel.

Firebase Storage is configured and initialised but currently unused — recipient
photos are stored in Firestore, not Storage.

- **Data model reference:** [`docs/DATA_MODEL.md`](docs/DATA_MODEL.md)
- **Deployment runbook:** [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md)
- **Manual QA checklist:** [`docs/QA_CHECKLIST.md`](docs/QA_CHECKLIST.md)
- **Known issues / backlog:** [`docs/KNOWN_ISSUES.md`](docs/KNOWN_ISSUES.md)

---

## Who uses it

| Role | Signs in with | Can do |
|------|---------------|--------|
| **Staff** | Email + password | Register recipients, assign/manage ARC cards, run reports |
| **IT Admin** | Identification Number | Create and deactivate staff accounts, view audit logs and drill-downs |

IT Admins sign in at `/admin/login`; staff sign in at `/login`.

---

## Running it locally

Requires **Node.js 20** (the CI pipeline pins this version).

```bash
npm install
cp .env.example .env.local   # then fill in the real values (see below)
npm run dev
```

The app runs at http://localhost:3000.

### Environment variables

All of these must be set in `.env.local` for local development and in the
Vercel project settings for deployed environments. None of them are committed
to the repo.

**Firebase web SDK** — from Firebase Console → Project Settings → General → Your apps:

| Variable | Notes |
|---|---|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | |
| `NEXT_PUBLIC_FIREBASE_VAPID_KEY` | Web push key, from Cloud Messaging tab |

**Firebase Admin SDK** — from Firebase Console → Project Settings → Service Accounts → Generate new private key:

| Variable | Notes |
|---|---|
| `FIREBASE_PROJECT_ID` | `project_id` from the service account JSON |
| `FIREBASE_CLIENT_EMAIL` | `client_email` from the service account JSON |
| `FIREBASE_PRIVATE_KEY` | `private_key` from the JSON. Keep the `\n` escape sequences — the app converts them back to real newlines at startup. Wrap the whole value in double quotes. |
| `FIREBASE_STORAGE_BUCKET` | Same bucket as the public one above |

**Application secrets** — generate these yourself and never rotate them casually:

| Variable | Notes |
|---|---|
| `PHONE_ENCRYPTION_KEY` | AES-256-GCM key used to encrypt recipient phone numbers. **Changing this makes existing stored phone numbers unreadable.** |
| `IT_ID_HASH_PEPPER` | Salt mixed into IT Admin Identification Number hashing. **Changing this locks every IT Admin out of their account.** |
| `CRON_SECRET` | Shared secret the monthly card-unload cron job must present. Must match the value Vercel sends. |

**Local scripts only** — not needed to run the app:

| Variable | Used by |
|---|---|
| `SERVICE_ACCOUNT_PATH` | `scripts/checkOrCreateAdmin.cjs`; defaults to `./serviceAccountKey.json` |
| `NEW_ADMIN_EMAIL`, `NEW_ADMIN_FIRST`, `NEW_ADMIN_LAST` | `scripts/checkOrCreateAdmin.cjs`, for bootstrapping the first admin |

`serviceAccountKey.json` is used by `seed.ts` and `scripts/checkOrCreateAdmin.cjs`.
It is gitignored and must never be committed.

---

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Local dev server |
| `npm run build` | Production build (also the best check that nothing is broken) |
| `npm start` | Serve a production build locally |
| `npm run lint` | ESLint |
| `npm test` | Jest unit tests |
| `npm run test:e2e` | Builds/serves the app and runs Playwright tests |
| `npm run test:rules` | Firestore security rules tests. Needs Java (starts the Firestore emulator) |
| `npm run seed` | Populate Firestore with sample data (development only) |

---

## Project layout

```
src/app/(app)/        Authenticated staff pages: dashboard, cards, reports, it-admin
src/app/admin/        IT Admin login, registration, and dashboard
src/app/api/          Backend API routes (recipients, cards, reports, session, cron)
src/app/services/     Firebase setup and server-side data services
src/utils/            Shared helpers: phone encryption, IT-ID hashing, fuzzy
                      name search, registration validation, spreadsheet safety
src/tests/            Jest unit tests
tests/e2e/            Playwright end-to-end tests
firestore.rules       Firestore security rules
firestore.indexes.json Firestore composite indexes
```

---

## Things worth knowing before you change anything

- **All dates are Mountain Time (`America/Edmonton`).** Date filters, exports, and
  the cron schedule all assume this. Note there is **no shared date helper** —
  the timezone string is currently repeated in eight separate files, so if you
  add date formatting anywhere, copy the existing pattern rather than using bare
  `new Date()` formatting, which would silently render in the server's timezone.
- **Cards unload automatically once a month.** A Vercel cron job hits
  `/api/cron/expire-cards` every hour; the job checks whether the configured
  day-and-time has passed for the current month and, if so, sets all cards to
  *Unloaded* while keeping them assigned to their recipients. Staff reactivate
  cards manually. The schedule is editable from the Cards page.
- **Firestore queries need matching indexes.** If you add a query that combines a
  filter and a sort, add the composite index to `firestore.indexes.json` and
  deploy it, or the query will fail in production.
- **Recipient phone numbers are encrypted at rest** and IT Admin ID numbers are
  hashed. See the secrets table above for what happens if those keys change.
