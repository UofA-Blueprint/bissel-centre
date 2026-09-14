# Security & Permissions Test Scenarios

> Test plan for verifying Firestore security rules, authentication flows,
> and role-based access control. Each scenario should be executed manually
> or via the Firebase Rules Emulator.

---

## Test Accounts

Set up these accounts before running scenarios:

| # | Role | Email | How to create |
|---|------|-------|---------------|
| A1 | IT Admin (primary) | `admin1@test.com` | Bootstrap script: `node scripts/checkOrCreateAdmin.cjs` |
| A2 | IT Admin (secondary) | `admin2@test.com` | Created by A1 via `/admin/api/create-admin` |
| S1 | Staff (active) | `staff1@test.com` | Created by A1 via `/api/register-staff` |
| S2 | Staff (active) | `staff2@test.com` | Created by A1 via `/api/register-staff` |
| S3 | Staff (deactivated) | `staff3@test.com` | Created by A1, then soft-deleted via admin panel |
| U1 | Unauthenticated | — | No account; use Firebase client SDK with no sign-in |

---

## 1. Authentication Flow Scenarios

### 1.1 IT Admin Login

| # | Scenario | Steps | Expected |
|---|----------|-------|----------|
| 1.1.1 | Valid admin login | Enter A1's identification number on `/admin/login` | Custom token issued, session cookie set, redirect to `/admin/dashboard` |
| 1.1.2 | Invalid identification number | Enter random 10-char string | Login rejected, no token |
| 1.1.3 | Staff ID used on admin login | Enter S1's email/password on `/admin/login` | Rejected — admin login requires identification number, not email |
| 1.1.4 | Admin accesses staff routes | A1 logged in, navigate to `/dashboard` | Allowed in read-only "view as" mode |
| 1.1.5 | Admin session expiry | Wait >5 days or revoke refresh tokens | Session cookie rejected, redirect to `/admin/login` |

### 1.2 Staff Login

| # | Scenario | Steps | Expected |
|---|----------|-------|----------|
| 1.2.1 | Valid staff login | S1 enters email + password on `/login` | Session cookie set, redirect to `/dashboard` |
| 1.2.2 | Deactivated staff login | S3 enters email + password | Session created (Auth not disabled) but API returns 403 because `isDeleted === true` |
| 1.2.3 | Admin tries staff login | A1 enters email/password on `/login` | Rejected — `session-login` route rejects `admin === true` claims |
| 1.2.4 | Staff accesses admin routes | S1 logged in, navigate to `/admin/dashboard` | Redirected to `/dashboard` by middleware |
| 1.2.5 | First-login activation | S2 logs in for first time | `onboardingStatus` updated from `"invited"` to `"active"` via `/api/authorise-staff` |

### 1.3 Unauthenticated Access

| # | Scenario | Steps | Expected |
|---|----------|-------|----------|
| 1.3.1 | Access protected staff route | Navigate to `/dashboard` without session | Redirect to `/login` |
| 1.3.2 | Access protected admin route | Navigate to `/admin/dashboard` without session | Redirect to `/admin/login` |
| 1.3.3 | Access public routes | Navigate to `/`, `/login`, `/admin/login` | Allowed |
| 1.3.4 | Call API without session | `GET /api/dashboard/summary` with no cookie | 401 Unauthorized |

---

## 2. Firestore Security Rules — Read Permissions

### 2.1 `users` Collection

| # | Actor | Operation | Expected | Rule |
|---|-------|-----------|----------|------|
| 2.1.1 | S1 (staff) | Read any user doc | Allowed | `isStaffOrAdmin()` |
| 2.1.2 | A1 (admin) | Read any user doc | Allowed | `isStaffOrAdmin()` |
| 2.1.3 | S3 (deactivated) | Read any user doc | **Denied** | `isActiveStaff()` fails — `isDeleted == true` |
| 2.1.4 | U1 (unauth) | Read any user doc | **Denied** | No `request.auth` |
| 2.1.5 | U1 (unauth) | List all users | **Denied** | Default deny |

### 2.2 `arc_cards` Collection

| # | Actor | Operation | Expected | Rule |
|---|-------|-----------|----------|------|
| 2.2.1 | S1 | Read any card | Allowed | `isStaffOrAdmin()` |
| 2.2.2 | A1 | Read any card | Allowed | `isStaffOrAdmin()` |
| 2.2.3 | U1 | Read any card | **Denied** | |
| 2.2.4 | S3 (deactivated) | Read any card | **Denied** | |

### 2.3 `administrative_staff` Collection

| # | Actor | Operation | Expected | Rule |
|---|-------|-----------|----------|------|
| 2.3.1 | A1 (admin) | Read any staff doc | Allowed | `isAdmin()` |
| 2.3.2 | S1 | Read own staff doc (`request.auth.uid == staffId`) | Allowed | Self-read rule |
| 2.3.3 | S1 | Read S2's staff doc | **Denied** | Not admin, not own doc |
| 2.3.4 | U1 | Read any staff doc | **Denied** | |

### 2.4 `it_admins` Collection

| # | Actor | Operation | Expected | Rule |
|---|-------|-----------|----------|------|
| 2.4.1 | A1 | Read any admin doc | Allowed | `isAdmin()` |
| 2.4.2 | S1 | Read any admin doc | **Denied** | Not admin |
| 2.4.3 | U1 | Read any admin doc | **Denied** | |

### 2.5 `history` Collection

| # | Actor | Operation | Expected | Rule |
|---|-------|-----------|----------|------|
| 2.5.1 | S1 | Read history entries | Allowed | `isStaffOrAdmin()` |
| 2.5.2 | A1 | Read history entries | Allowed | |
| 2.5.3 | U1 | Read history | **Denied** | |

### 2.6 `app_settings` Collection

| # | Actor | Operation | Expected | Rule |
|---|-------|-----------|----------|------|
| 2.6.1 | S1 | Read settings | Allowed | `isStaffOrAdmin()` |
| 2.6.2 | A1 | Read settings | Allowed | |
| 2.6.3 | U1 | Read settings | **Denied** | |

### 2.7 `_migrations` Collection

| # | Actor | Operation | Expected | Rule |
|---|-------|-----------|----------|------|
| 2.7.1 | Any authenticated | Read migration doc | **Denied** | All client reads blocked |
| 2.7.2 | Admin SDK (server) | Read migration doc | Allowed | Admin SDK bypasses rules |

---

## 3. Firestore Security Rules — Write Permissions

### 3.1 `users` Collection — Writes

| # | Actor | Operation | Expected | Rule |
|---|-------|-----------|----------|------|
| 3.1.1 | S1 | Create new user | Allowed | `isActiveStaff()` |
| 3.1.2 | S1 | Update user | Allowed | `isActiveStaff()` |
| 3.1.3 | S1 | Delete user | Allowed | `isActiveStaff()` |
| 3.1.4 | A1 | Create user | **Denied** | Admin is read-only for users |
| 3.1.5 | A1 | Update user | **Denied** | |
| 3.1.6 | S3 (deactivated) | Create user | **Denied** | `isDeleted == true` |
| 3.1.7 | U1 | Create user | **Denied** | |

### 3.2 `arc_cards` Collection — Writes

| # | Actor | Operation | Expected | Rule |
|---|-------|-----------|----------|------|
| 3.2.1 | S1 | Create card | Allowed | |
| 3.2.2 | S1 | Update card status | Allowed | |
| 3.2.3 | S1 | Delete card | **Denied** | Delete always denied |
| 3.2.4 | A1 | Update card | **Denied** | Admin read-only |
| 3.2.5 | U1 | Create card | **Denied** | |

### 3.3 `history` Collection — Writes (Append-Only)

| # | Actor | Operation | Expected | Rule |
|---|-------|-----------|----------|------|
| 3.3.1 | S1 | Create history entry | Allowed | |
| 3.3.2 | S1 | Update history entry | **Denied** | Append-only: update always denied |
| 3.3.3 | S1 | Delete history entry | **Denied** | Append-only: delete always denied |
| 3.3.4 | A1 | Create history entry | **Denied** | Admin can't write history |

### 3.4 `administrative_staff` Collection — Writes

| # | Actor | Operation | Expected | Rule |
|---|-------|-----------|----------|------|
| 3.4.1 | A1 | Write staff doc (client SDK) | **Denied** | All client writes blocked |
| 3.4.2 | S1 | Write own staff doc | **Denied** | All client writes blocked |
| 3.4.3 | Admin SDK (server) | Write staff doc | Allowed | Server-side bypasses rules |

### 3.5 `it_admins` Collection — Writes

| # | Actor | Operation | Expected | Rule |
|---|-------|-----------|----------|------|
| 3.5.1 | A1 (client SDK) | Create admin doc | **Denied** | All client writes blocked |
| 3.5.2 | Admin SDK (server) | Create admin doc | Allowed | |

### 3.6 `app_settings` Collection — Writes

| # | Actor | Operation | Expected | Rule |
|---|-------|-----------|----------|------|
| 3.6.1 | S1 (client SDK) | Update settings | **Denied** | All client writes blocked |
| 3.6.2 | Admin SDK (server) | Update settings | Allowed | API route uses Admin SDK |

---

## 4. API Route Authorization

### 4.1 Staff-Only Write Routes

| # | Route | Method | Actor | Expected |
|---|-------|--------|-------|----------|
| 4.1.1 | `/api/register-recipient` | POST | S1 (staff) | 201 Created |
| 4.1.2 | `/api/register-recipient` | POST | A1 (admin) | 403 Forbidden |
| 4.1.3 | `/api/register-recipient` | POST | No session | 401 Unauthorized |
| 4.1.4 | `/api/cards` | POST | S1 | 201 Created |
| 4.1.5 | `/api/cards` | POST | A1 | 403 Forbidden |
| 4.1.6 | `/api/cards` | PATCH | S1 | 200 OK |
| 4.1.7 | `/api/cards` | PATCH | A1 | 403 Forbidden |

### 4.2 Read Routes (Staff + Admin)

| # | Route | Method | Actor | Expected |
|---|-------|--------|-------|----------|
| 4.2.1 | `/api/dashboard/summary` | GET | S1 | 200 OK |
| 4.2.2 | `/api/dashboard/summary` | GET | A1 | 200 OK |
| 4.2.3 | `/api/dashboard/summary` | GET | No session | 401 |
| 4.2.4 | `/api/cards` | GET | S1 | 200 OK |
| 4.2.5 | `/api/cards` | GET | A1 | 200 OK |
| 4.2.6 | `/api/reports/data` | GET | S1 | 200 OK |
| 4.2.7 | `/api/reports/data` | GET | A1 | 200 OK |

### 4.3 Admin-Only Routes

| # | Route | Method | Actor | Expected |
|---|-------|--------|-------|----------|
| 4.3.1 | `/api/set-admin` | POST | A1 | 200 OK |
| 4.3.2 | `/api/set-admin` | POST | S1 | 403 Forbidden |
| 4.3.3 | `/api/set-admin` | POST | No session | 401 |
| 4.3.4 | `/admin/api/create-admin` | POST | A1 (valid ID) | 200 OK |
| 4.3.5 | `/admin/api/create-admin` | POST | Wrong ID number | 403 |

### 4.4 Identification-Number-Gated Routes

| # | Route | Method | Input | Expected |
|---|-------|--------|-------|----------|
| 4.4.1 | `/api/register-staff` | POST | Valid admin ID | 200 OK |
| 4.4.2 | `/api/register-staff` | POST | Invalid ID | 403 |
| 4.4.3 | `/api/register-staff` | POST | Staff member's ID (not admin) | 403 |
| 4.4.4 | `/admin/api/get-custom-token` | POST | Valid admin ID | Token returned |
| 4.4.5 | `/admin/api/get-custom-token` | POST | Invalid ID | `null` returned |

### 4.5 Cron Route

| # | Route | Input | Expected |
|---|-------|-------|----------|
| 4.5.1 | `/api/cron/expire-cards` | Valid `CRON_SECRET` Bearer token | 200 OK |
| 4.5.2 | `/api/cron/expire-cards` | No/wrong Bearer token (production) | 401 |
| 4.5.3 | `/api/cron/expire-cards` | No Bearer token (development) | Allowed (dev bypass) |

---

## 5. Server Action Authorization

### 5.1 Admin-Session-Gated Actions

| # | Action | Actor | Expected |
|---|--------|-------|----------|
| 5.1.1 | `getAdministrativeStaff()` | A1 (admin session) | Returns staff list |
| 5.1.2 | `getAdministrativeStaff()` | S1 (staff session) | Throws "Unauthorized" |
| 5.1.3 | `getAdministrativeStaff()` | No session | Throws "Unauthorized" |
| 5.1.4 | `deleteAdministrativeStaff(id)` | A1 | Soft-deletes staff, disables Auth |
| 5.1.5 | `deleteAdministrativeStaff(id)` | S1 | Throws "Unauthorized" |
| 5.1.6 | `reactivateAdministrativeStaff(id)` | A1 | Re-enables staff, sends reset email |
| 5.1.7 | `updateAdministrativeStaff(id, input)` | A1 | Updates name/email |
| 5.1.8 | `getAdministrativeStaffSummary(id)` | A1 | Returns profile + counts |

### 5.2 Newly Gated Actions (SEC-03 fix)

| # | Action | Actor | Expected |
|---|--------|-------|----------|
| 5.2.1 | `listUsers()` | A1 (admin session) | Returns Auth user list |
| 5.2.2 | `listUsers()` | No session | **Throws "Unauthorized"** (was previously ungated) |
| 5.2.3 | `setUserAsAdmin(email)` | A1 (admin session) | Sets admin claim |
| 5.2.4 | `setUserAsAdmin(email)` | No session | **Throws "Unauthorized"** (was previously ungated) |

---

## 6. Card Management Scenarios

### 6.1 Card Assignment

| # | Scenario | Steps | Expected |
|---|----------|-------|----------|
| 6.1.1 | Register recipient with card | S1 registers user with `arcCardDigits` set to an Unattributed card | User created, card status → Active, `currentUserId` set, issue created |
| 6.1.2 | Register recipient without card | S1 registers user without `arcCardDigits` | User created, no card linked |
| 6.1.3 | Assign already-assigned card | S1 tries to assign card that has `currentUserId != null` | 400 error: "already assigned" |
| 6.1.4 | Assign non-Unattributed card | S1 tries to assign a card with status "Active" | 400 error: "must be Unattributed" |

### 6.2 Card Status Changes

| # | Scenario | Steps | Expected |
|---|----------|-------|----------|
| 6.2.1 | Change Active card to Unattributed | S1 patches card with holder | 409 dangerous-change warning → confirm → user detached, issue closed |
| 6.2.2 | Change Unattributed to Active (no holder) | S1 patches card | 409 dangerous-change warning |
| 6.2.3 | Force unassign | S1 force-unassigns card | Card → Unattributed, user's `arcCardNumber` cleared, issue closed |
| 6.2.4 | Admin tries status change | A1 patches card | 403 Forbidden (staff-only write) |

### 6.3 Concurrent Edit Scenario (SYNC-01)

| # | Scenario | Steps | Expected (current) | Expected (after fix) |
|---|----------|-------|--------------------|---------------------|
| 6.3.1 | Two staff edit same card | S1 and S2 both load card page. S1 changes status. S2 changes status. | S2's write silently overwrites S1's | 409 conflict on S2's write |

### 6.4 Monthly Unload Cron

| # | Scenario | Steps | Expected |
|---|----------|-------|----------|
| 6.4.1 | Cron runs on schedule day | Cron fires on configured `dayOfMonth` after `time24` | All non-Unloaded cards → Unloaded. `lastRunMonthKey` updated. |
| 6.4.2 | Cron runs again same month | Cron fires again after already running | Skipped — `lastRunMonthKey` matches |
| 6.4.3 | Schedule update by staff | S1 updates `dayOfMonth` and `time24` | Settings doc updated |
| 6.4.4 | Schedule update by admin | A1 tries to update schedule | 403 Forbidden |

---

## 7. Direct Firestore Access (Bypass App)

These test the security rules by hitting Firestore directly with the client SDK, bypassing the Next.js app layer entirely. This is the critical attack surface the rules protect.

| # | Actor | Operation | Expected |
|---|-------|-----------|----------|
| 7.1 | U1 (no auth, using public Firebase config) | `getDocs(collection(db, 'users'))` | **Permission denied** |
| 7.2 | U1 | `getDoc(doc(db, 'users', 'anyId'))` | **Permission denied** |
| 7.3 | U1 | `setDoc(doc(db, 'users', 'newId'), {...})` | **Permission denied** |
| 7.4 | U1 | `deleteDoc(doc(db, 'users', 'anyId'))` | **Permission denied** |
| 7.5 | U1 | `getDocs(collection(db, 'arc_cards'))` | **Permission denied** |
| 7.6 | U1 | `getDocs(collection(db, 'administrative_staff'))` | **Permission denied** |
| 7.7 | U1 | `getDocs(collection(db, 'it_admins'))` | **Permission denied** |
| 7.8 | U1 | `getDocs(collection(db, 'history'))` | **Permission denied** |
| 7.9 | U1 | `getDocs(collection(db, 'banned_users'))` | **Permission denied** |
| 7.10 | U1 | `getDocs(collection(db, 'app_settings'))` | **Permission denied** |
| 7.11 | S1 (authenticated staff) | `getDocs(collection(db, 'users'))` | Allowed |
| 7.12 | S1 | `getDocs(collection(db, 'it_admins'))` | **Permission denied** (staff can't read admin records) |
| 7.13 | S1 | `getDoc(doc(db, 'administrative_staff', otherStaffUid))` | **Permission denied** (can only read own doc) |
| 7.14 | S1 | `updateDoc(doc(db, 'administrative_staff', ownUid), {...})` | **Permission denied** (no client writes) |
| 7.15 | S1 | `updateDoc(doc(db, 'history', 'anyId'), {...})` | **Permission denied** (append-only) |
| 7.16 | S1 | `deleteDoc(doc(db, 'history', 'anyId'))` | **Permission denied** (append-only) |
| 7.17 | S1 | `addDoc(collection(db, 'history'), {...})` | Allowed (append) |
| 7.18 | S1 | `deleteDoc(doc(db, 'arc_cards', 'anyId'))` | **Permission denied** (no card deletes) |
| 7.19 | A1 (admin) | `getDocs(collection(db, 'users'))` | Allowed (read) |
| 7.20 | A1 | `setDoc(doc(db, 'users', 'newId'), {...})` | **Permission denied** (admin is read-only for users) |
| 7.21 | A1 | `getDocs(collection(db, 'administrative_staff'))` | Allowed |
| 7.22 | A1 | `getDocs(collection(db, 'it_admins'))` | Allowed |
| 7.23 | A1 | `setDoc(doc(db, 'it_admins', 'x'), {...})` | **Permission denied** (no client writes) |
| 7.24 | S3 (deactivated, `isDeleted: true`) | `getDocs(collection(db, 'users'))` | **Permission denied** |

---

## 8. Running These Tests

### Option A: Firebase Emulator (recommended)

```bash
# Install Firebase CLI if not present
npm install -g firebase-tools

# Start emulator with rules
firebase emulators:start --only firestore

# Run tests against emulator
# Set FIRESTORE_EMULATOR_HOST=localhost:8080
```

### Option B: Firebase Rules Playground

1. Go to Firebase Console → Firestore → Rules
2. Use the "Rules playground" tab
3. Simulate reads/writes with different auth states

### Option C: Manual App Testing

1. Create the test accounts listed above
2. Log in as each role
3. Attempt each operation through the UI and via browser console (direct Firestore SDK calls)
4. Verify the expected outcomes

### Verifying Rules Deployment

```bash
# Deploy rules to Firebase
firebase deploy --only firestore:rules

# Deploy indexes
firebase deploy --only firestore:indexes

# Verify deployed rules match repo
firebase firestore:rules:get
```
