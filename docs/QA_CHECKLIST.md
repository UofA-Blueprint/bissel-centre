# Manual QA Checklist

Run this against the **staging site** before merging to `main`, and run the
Smoke Test section again against production after deploying.

You do not need to test every screen. Concentrate on anything that **writes to
the database** — a broken read is visible and harmless, a broken write corrupts
data quietly.

Use a throwaway recipient (name it something obvious like `ZZTest Recipient`)
and clean up afterwards.

---

## Smoke Test — 10 minutes

If any of these fail, stop and fix before going further.

- [ ] Staff can sign in at `/login`
- [ ] Dashboard loads and shows the recipient list plus the stat cards
- [ ] Cards page loads and lists cards
- [ ] Reports page loads and shows data
- [ ] IT Admin can sign in at `/admin/login` and the IT Admin page loads
- [ ] Register one test recipient successfully
- [ ] Export one report and open the file
- [ ] Sign out returns you to the login screen and the back button does not
      restore the dashboard

---

## Dashboard

- [ ] Stat cards show plausible numbers (total recipients, flagged, banned)
- [ ] **Flagged Users** and **Banned Users** are separate counts
- [ ] The Banned Users card shows a red cross icon, not a flag
- [ ] Scrolling / "load more" brings in additional recipients without duplicates
- [ ] Search by first name returns the expected recipient
- [ ] Search tolerates a misspelling (e.g. `Katherine` finds `Catherine`)
- [ ] Filtering by staff member ("Recipients by staff") returns **all** of that
      person's recipients, not just the ones already on screen, and the match
      count agrees with the list length
- [ ] A recipient holding an unloaded card reads **"Card Assigned but
      Unloaded"**, not "Active card"
- [ ] A flagged recipient shows as flagged and active; a banned recipient shows
      as banned
- [ ] In view-only mode, hovering the Edit button shows a tooltip explaining
      editing is disabled

---

## Register Recipient

- [ ] A valid registration saves and the new recipient appears on the dashboard
- [ ] Email is required and an invalid email is rejected
- [ ] Uploading a large photo works without an error
- [ ] There is **no** "ARC Card Issue Duration" field on the form
- [ ] Assigning an available (Unattributed) card during registration works
- [ ] Attempting to assign a card that is already assigned shows a clear error
      instead of a crash, and the registration does not half-save
- [ ] Registering on a phone-sized screen is usable (no cut-off fields)

---

## Edit Recipient

- [ ] The modal opens and you can jump between sections without having to
      complete them in order
- [ ] Editing a field saves and the change is visible on the dashboard
- [ ] **History** opens from its own button and shows past changes
- [ ] History's "Modified By" only lists staff-driven events, not system noise
- [ ] **ARC Card** section shows the current card and lets you search for an
      unattributed card to swap to
- [ ] After swapping, the old card is fully unassigned and the new one is
      attached to the recipient
- [ ] Flag a user with a reason → the dashboard flagged count increases
- [ ] Unflag → the count decreases
- [ ] Ban with a reason, then unban with a reason → banned count moves both ways
- [ ] Delete a recipient works and they disappear from the list
- [ ] Opening the flag/ban dialog and clicking inside it does **not** trigger
      "Are you sure you want to exit?" on the parent modal
- [ ] After confirming a flag/ban, the parent modal closes cleanly and is not
      stuck loading

---

## Cards

- [ ] The explanation of card statuses appears at the top of the page
- [ ] An unassigned card shows "No recipient"; an assigned card shows the
      recipient's name, and reverts correctly after unassigning
- [ ] The column reads **Allocation Date** and dates are in Mountain Time
- [ ] **Force Unassign** asks for confirmation first
- [ ] After force-unassigning, the card is *Unattributed* and the recipient no
      longer shows that card
- [ ] There is **no** "Cards issued by" filter
- [ ] The saved monthly unload schedule (day and time) is displayed
- [ ] The **last run** date and time is displayed
- [ ] Saving a new schedule works and does not throw a Firestore error
- [ ] Simply refreshing the Cards page does **not** trigger the cron job or
      change the last-run value
- [ ] New Allocation screen is usable on a phone (padding and layout correct)

---

## Reports

- [ ] Filters narrow the on-screen results as expected
- [ ] A custom date range is **inclusive** of both the start and end dates
- [ ] Dates display in Mountain Time
- [ ] Exported file contains exactly the rows currently filtered on screen —
      especially when filtering by department
- [ ] The Users sheet includes the **Cards owned (complete history)**,
      **Current ARC Card**, and **Current Department of ARC Card** columns
- [ ] The workbook contains all four sheets: Users, Export Info, Card History,
      and Activity Log
- [ ] Card export and activity export both produce sensible data
- [ ] Open the exported file and confirm no cell tries to run a formula: a value
      beginning with `=`, `+`, `-` or `@` should appear as plain text and
      Excel/Sheets should not prompt about formulas

---

## IT Admin

- [ ] Create a new staff account; they receive the password setup email
- [ ] The new staff member can complete setup and sign in
- [ ] Deactivate a staff member → they can no longer sign in
- [ ] Reactivate them → they receive a fresh password setup email, the old
      password no longer works, and after setting a new one they can sign in
- [ ] After a successful login following reactivation, their account status
      reads `active`
- [ ] Audit log statistics are non-zero where activity exists — in particular
      "bans placed" reflects real bans
- [ ] Drill-down links from the IT Admin page land on a correctly filtered list
- [ ] Staff first/last names display consistently (no blank or duplicated
      surname fields)

---

## Cross-cutting

- [ ] Every date shown anywhere in the app is Mountain Time (Edmonton)
- [ ] An unauthenticated visitor cannot reach `/dashboard`, `/cards`,
      `/reports`, or `/it-admin` by typing the URL
- [ ] A staff member cannot reach IT-Admin-only functionality
- [ ] Loading states appear instead of blank screens on slow connections
- [ ] The app is usable on a phone-sized screen

---

## After testing

- [ ] Delete the test recipient and release any card used for testing
- [ ] Record anything that failed in [`KNOWN_ISSUES.md`](KNOWN_ISSUES.md) if you
      decide to ship without fixing it
