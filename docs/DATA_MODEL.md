# Bissel Centre ARC Card Management — Data Model Guide

> Canonical reference for every Firestore collection, its fields, relationships,
> and the security rules that govern access. Updated alongside the production-readiness audit (Aug 2026).

---

## Roles

| Role | Auth mechanism | Custom claim | Firestore marker |
|------|---------------|--------------|------------------|
| **IT Admin** | Identification Number → SHA-256 hash → Firebase Auth UID | `admin: true` | Doc in `it_admins/{hashedUID}` |
| **Staff** | Email + password (Firebase Auth) | None | Doc in `administrative_staff/{authUID}` with `isDeleted != true` |
| **Unauthenticated** | — | — | No access to any collection |

---

## Collections

### `users` — Recipients

People who receive ARC bus passes. Contains PII — protected by rules.

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `firstName` | string | Yes | |
| `secondName` | string | Yes | Last name |
| `picture` | string | Yes | Base64-encoded photo (up to ~1 MB) |
| `genderIdentity` | string | No | |
| `aliases` | array\<string\> | No | Alternative names |
| `dateOfBirth` | string | No | ISO date `YYYY-MM-DD` |
| `arcCardNumber` | string | No | Last 7 digits of currently assigned card. Cleared when card is detached. |
| `address` | string | No | |
| `postalCode` | string | No | |
| `passesIssued` | array\<string\> | No | Array of `arc_cards/{id}` doc IDs previously held |
| `banned` | boolean | No | `true` when actively banned |
| `banReason` | string | No | |
| `notes` | string | No | |
| `status` | string | No | `"Active"` or `"Inactive"` |
| `email` | string | No | |
| `phone` | string | No | AES-256-GCM encrypted |
| `journey` | string | No | Survey answer |
| `mostCommonReason` | string | No | Survey answer |
| `secondMostCommonReason` | string | No | Survey answer |
| `housingOption` | string | No | Survey answer |
| `createdAt` | timestamp | Yes | Server timestamp |
| `createdBy` | string | Yes | UID of `administrative_staff` who registered |
| `updatedAt` | timestamp | Yes | Server timestamp |

**Relationships**: `createdBy` → `administrative_staff/{id}`. `passesIssued[n]` → `arc_cards/{id}`. `arcCardNumber` matches `arc_cards.arcCardNumber`.

**Access**: Staff read/write. Admin read-only.

---

### `arc_cards` — ARC Transit Cards

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `currentUserId` | string \| null | Yes | Current holder. `null` = unassigned. |
| `allocationDate` | string | Yes | Date card was allocated to Bissell Centre (`YYYY-MM-DD`) |
| `department` | string | Yes | One of 13 departments (see below) |
| `arcCardNumber` | string | Yes | Last 7 digits |
| `securityCode` | string | Yes | |
| `status` | string | Yes | `"Active"`, `"Unattributed"`, `"Expired"`, `"Unloaded"`, `"Cancelled"` |
| `notes` | string | No | |
| `createdAt` | timestamp | Yes | Server timestamp |
| `updatedAt` | timestamp | Yes | Server timestamp |

**Legacy fields** (pre-migration, may exist on old docs):
- `userId` — same purpose as `currentUserId`
- `monthsRemaining` — max 3
- `issuedAt` — legacy timestamp
- `passRecipient` — denormalized recipient name
- `issueDates` — array of date strings

**Departments**: Mental Health, Emergency, Case MCT, Newcomer Volunteer, Reception, Housing, FE/Comm Bridge, FASS, Child Care, Employment, Comp Eng Dept, Transit Dept, HELP Program

**Statuses**:
| Status | Meaning |
|--------|---------|
| Unloaded | Default/reset state; set by monthly cron |
| Unattributed | Card exists but not assigned to anyone |
| Active | Assigned to a recipient and in use |
| Expired | Card has expired |
| Cancelled | Card is permanently cancelled |

**Access**: Staff read/write (no delete). Admin read-only.

---

### `issues` — Card Issuance Events

One record per time a card is issued to a recipient. Post-migration source of truth.

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `cardId` | string | Yes | → `arc_cards/{id}` |
| `userId` | string | Yes | → `users/{id}` |
| `issueDate` | string | Yes | Date string `YYYY-MM-DD` |
| `createdAt` | timestamp | Yes | |
| `issuedBy` | string | Yes | → `administrative_staff/{id}` |
| `notes` | string | No | |
| `returnedAt` | timestamp \| null | Yes | `null` means card is still active with this user |
| `expiresAt` | timestamp | No | |
| `closedCardStatus` | string | No | Card status at time issue was closed |

**Access**: Staff read/create/update (no delete). Admin read-only.

---

### `banned_users` — Active Bans

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `userId` | string | Yes | → `users/{id}` |
| `banReason` | string | Yes | |
| `bannedAt` | timestamp | Yes | |
| `bannedBy` | string | Yes | → `administrative_staff/{id}` |
| `notes` | string | No | |

**Access**: Staff read/write. Admin read-only.

---

### `administrative_staff` — Staff Accounts

**Document ID = Firebase Auth UID**.

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `email` | string | Yes | |
| `firstName` | string | Yes | |
| `lastName` | string | Yes | (legacy: `secondName`) |
| `createdBy` | string | Yes | UID of IT admin who created |
| `createdAt` | timestamp | Yes | |
| `onboardingStatus` | string | No | `"invited"` or `"active"` |
| `accountStatus` | string | No | `"active"`, `"deactivated"`, `"invited"` |
| `isDeleted` | boolean | No | Soft-delete flag |
| `deletedAt` | timestamp | No | |
| `deletedBy` | string | No | |
| `inviteSentAt` | timestamp | No | |
| `inviteAcceptedAt` | timestamp | No | |
| `reactivatedAt` | timestamp | No | |
| `reactivatedBy` | string | No | |
| `updatedAt` | timestamp | No | |

**Access**: Admin reads all. Staff reads own doc only (for auth check). No client-side writes — all mutations go through server actions.

---

### `it_admins` — IT Admin Records

**Document ID = Firebase Auth UID** (SHA-256 hash of raw identification number).

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `uid` | string | Yes | Same as doc ID |
| `firstName` | string | Yes | |
| `lastName` | string | Yes | |
| `email` | string | Yes | |
| `createdBy` | string | Yes | UID of creating admin or `"bootstrap"` |
| `createdAt` | timestamp | Yes | |

**Access**: Admin read-only. No client-side writes.

> **Note**: Legacy collection `it_admin` (singular) exists from the old seed. Code uses `it_admins` (plural). Rules cover both.

---

### `history` — Audit Log

Append-only log of all significant events.

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `date` | timestamp | Yes | |
| `userId` | string | Yes | → `users/{id}` affected |
| `modifiedBy` | string | Yes | UID of `administrative_staff` or `"system"` |
| `event` | string | Yes | `"Ban"`, `"Unban"`, `"Override"`, `"Issue Card"`, `"Renew Card"`, `"Status Change"` |
| `notes` | string | No | |
| `reason` | string | No | For overrides |

**Access**: Staff read/create. **No updates or deletes** — audit log is immutable.

---

### `questions` — Survey Responses

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `userId` | string | Yes | → `users/{id}` |
| `questions` | array\<string\> | Yes | |
| `answers` | array\<string\> | Yes | Same length as questions |

**Access**: Staff read/write. Admin read-only.

---

### `app_settings` — System Configuration

Known document: `arc_card_monthly_unload`

| Field | Type | Notes |
|-------|------|-------|
| `enabled` | boolean | |
| `dayOfMonth` | number | 1–31 |
| `time24` | string | `"HH:mm"` in Edmonton timezone |
| `timezone` | string | Always `"America/Edmonton"` |
| `lastRunMonthKey` | string | e.g. `"2026-08"` |
| `lastRunAt` | string | ISO timestamp |
| `updatedAt` | timestamp | |

**Access**: Staff and admin read-only from client. Writes go through API routes (Admin SDK).

---

### `_migrations` — Internal State

| Document | Purpose |
|----------|---------|
| `issues_v1` | When present, code uses `issues` collection instead of legacy `arc_cards.issueDates` |

**Access**: No client access. Admin SDK only.

---

## Seed vs. Production Schema Drift (Fixed)

The original `seed.ts` had these mismatches with production code:

| Issue | Seed wrote | Production expects | Fixed |
|-------|-----------|-------------------|-------|
| Card holder field | `userId` | `currentUserId` | Yes |
| IT admin collection | `it_admin` (singular) | `it_admins` (plural) | Yes |
| Staff `passesIssued` | Card number string | Card document ID | Yes |
| `hashedPassword` field | Plaintext passwords | Field doesn't exist (Firebase Auth owns passwords) | Removed |
| `hashedIdentificationNumber` | Plaintext `"ABC123"` | Not stored in Firestore (hashed UID is the doc ID) | Removed |
| Missing fields | No `status`, `email`, `phone`, `onboardingStatus` | Required by app logic | Added |
| Missing `_migrations/issues_v1` | Not written | Required for issues collection to be used | Added |
| Legacy `monthsRemaining`, `issuedAt` | Written | Deprecated, not used by current code | Removed |
