# Deployment Runbook

Everything needed to get a change from a laptop into production, and what to do
when something goes wrong.

---

## How deployment works

Deployment is automatic. You never run a deploy command by hand.

```
push / merge  →  GitHub Actions (.github/workflows/ci-cd.yml)  →  Vercel
```

The pipeline runs, in order: `npm install`, `npm run lint`, `npm test`, the
Firestore security rules tests against the emulator, `npm run build`, then the
Playwright E2E tests. **If any step fails, nothing deploys** — with one
deliberate exception: the rules step is currently marked `continue-on-error`
while it establishes a baseline, so it reports pass/fail without blocking.
See [`KNOWN_ISSUES.md`](KNOWN_ISSUES.md) for how to promote it to a real gate.

| Branch | Intended environment |
|---|---|
| `staging` | Staging site — test here first, always |
| `main` | Production — what Bissell Centre staff actually use |

Feature branches open pull requests into `staging`. The pipeline also runs on
those PRs, so you see a red or green check before merging.

Only `main` deploys to the production domain. The `--prod` flag comes solely
from a branch conditional in the deploy step:

```yaml
vercel-args: ${{ github.ref == 'refs/heads/main' && '--prod' || '' }}
```

Never add a literal `--prod` alongside that expression. Doing so sends staging
builds to the production domain — this was a real bug in the workflow, fixed in
September 2026, and it is easy to reintroduce because the mistake still looks
correct at a glance.

**Verify after your first deploy from each branch** that a `staging` push
produced a *preview* URL and not a production one. If staging output ever lands
on the production domain, this is the line to check.

---

## Releasing a change

1. **Check locally first.** Run `npm run lint && npm test && npm run build`. If
   these pass locally they will almost certainly pass in CI, and you avoid a
   slow red-build cycle.
2. **Open a PR into `staging`** and wait for the GitHub Actions check to go
   green. Do not merge on a red check.
3. **Merge to `staging`.** This deploys the staging site automatically.
4. **Run the smoke tests** in [`QA_CHECKLIST.md`](QA_CHECKLIST.md) against
   staging — not localhost. Staging uses real infrastructure, so it catches
   problems (missing env vars, missing indexes, permission errors) that
   localhost hides.
5. **Back up Firestore before any release that changes the data model.** See
   below — there is no automatic backup.
6. **Merge `staging` into `main`.** This deploys production.
7. **Re-run the short smoke list** against production: sign in, load the
   dashboard, register one test recipient, export one report. Delete the test
   recipient afterwards.

> **The first `staging` → `main` merge is a cutover, not a release.** As of
> September 2026, `main` is 122 commits behind `staging` and has never had a
> `vercel.json`, so the monthly unload has never existed in production. Treat
> that merge as a scheduled event: warn Bissell Centre staff, pick a low-traffic
> window, take a backup first, and confirm the cron appears under Vercel →
> Settings → Cron Jobs afterwards.

---

## Backups

**Nothing in this repository configures backups, and Firestore does not take
them for you.** Before any release that touches the data model, export the
database:

```bash
gcloud firestore export gs://<your-backup-bucket> --project bissel-centre
```

For ongoing protection, enable scheduled backups or Point-in-Time Recovery in
the Firebase console (Firestore → Backups). This data is recipient names,
addresses, phone numbers, and photos — losing it is not recoverable by any other
means.

**Never run `npm run seed` against production.** It writes sample data directly
into whatever project the credentials point at.

---

## Firestore rules and indexes are NOT deployed by the pipeline

This is the most common cause of "it worked on staging and broke in
production". Security rules and database indexes live in Firebase, not Vercel,
and must be pushed separately whenever `firestore.rules` or
`firestore.indexes.json` changes:

```bash
npx firebase login
npx firebase deploy --only firestore:indexes
npx firebase deploy --only firestore:rules
```

Notes:

- `firebase` is not installed globally; use `npx firebase`.
- If it asks *"Would you like to delete these indexes?"*, answer **N**. Deleting
  indexes that are still in use will break queries.
- `HTTP Error: 409, index already exists` is not a failure — it means that index
  was already deployed. Nothing to do.
- New indexes take a few minutes to build. Queries that depend on them fail
  until the build finishes, so deploy indexes *before* the code that needs them.

---

## Environment variables

The full list and where each value comes from is in the [README](../README.md).
They must be set in **three** places, and they drift apart easily:

| Where | Why |
|---|---|
| `.env.local` on each developer machine | Local development |
| Vercel project settings (Preview + Production) | The deployed app |
| GitHub Actions repository secrets | So CI can build and run tests |

If a deploy succeeds but the live site throws server errors, a missing Vercel
environment variable is the first thing to check.

---

## Required Vercel project setting: Fluid Compute

**This must be on, and it is not stored in this repository.** Open the Vercel
project → Settings → Functions → enable **Fluid Compute** → Save → redeploy.

Two routes ask for more than 60 seconds to finish: the cron sweep
(`maxDuration = 300`) and the reports export (`maxDuration = 120`). Vercel's
older serverless model caps Hobby functions at 60 seconds and **fails the whole
deployment** with "Serverless Functions must have a maxDuration between 1 and 60
for plan hobby" rather than merely warning. Fluid Compute raises the Hobby
ceiling to 300 seconds, which is where those numbers come from.

Fluid Compute is on by default for Vercel projects created after April 2025, so
a project set up from scratch today will already satisfy this. It is called out
here because this project predates that default, and because a setting that
lives only in a dashboard is invisible to anyone reading the code.

If a future maintainer ever needs to turn it off, both `maxDuration` values must
drop to 60 in the same change, or deployment breaks.

---

## The monthly card unload cron job

`vercel.json` schedules `/api/cron/expire-cards` to run **once a day** at
`0 8 * * *` UTC (early morning in Edmonton). The route itself decides whether to
act: it compares the current Edmonton time against the day-and-time configured
on the Cards page, and performs the unload at most once per calendar month.

**Why daily and not hourly.** Vercel's Hobby plan permits at most one cron
execution per day; an hourly expression like `0 * * * *` *fails the deployment
outright* with "Hobby accounts are limited to daily cron jobs." Hobby also runs
the job at any point within the scheduled hour. If this project ever moves to a
Pro plan, an hourly schedule becomes available and would reduce the worst-case
delay — but it is not required for correctness.

**The sweep is catch-up capable, so a once-a-day cron is safe.** It fires on the
first invocation *on or after* the configured day and time, clamping the day to
the last day of short months. That matters: an earlier version required an exact
day match, so a once-a-day cron that happened to run before the configured time
would skip the month entirely, and any schedule set to the 29th–31st never fired
in February. The "already ran this month" marker keeps it to a single run no
matter how many invocations find it due.

**An interrupted sweep resumes instead of skipping cards.** The sweep unloads
cards in batches, walking them in document-id order, and stops after 45 seconds
of work. If it stops early it saves its position, and the next day's invocation
continues from there rather than starting over. Starting over would be the
dangerous option: staff may have reactivated a card in the intervening hours,
and a restart would unload it again. A run that crashes before writing anything
releases its claim on the month so the next invocation can retry cleanly. In
practice, with a few thousand cards the sweep finishes in one run — this is
insurance, not the normal path.

- The route requires an `Authorization: Bearer <CRON_SECRET>` header in
  production and returns 401 without it. Vercel sends this automatically when
  `CRON_SECRET` is set in the project's environment variables.
- Add `?dryRun=1` to see what the job *would* do without writing anything.
- The Cards page displays the configured schedule and the last run time, which
  is the quickest way to confirm the job is alive.

To verify after a production deploy, check the Vercel dashboard under
Settings → Cron Jobs for the last invocation and its response status.

---

## If something goes wrong in production

**Roll back first, diagnose second.** In the Vercel dashboard, open the
Deployments list, find the last known-good deployment, and use *Promote to
Production*. This is near-instant and does not require a git revert.

Then:

- **Server errors on a page** → check the Vercel runtime logs for that
  deployment. Missing env var and missing Firestore index are the two most
  common causes, and both say so in the error.
- **"Permission denied" from Firestore** → the security rules in Firebase don't
  match what the code expects. Compare against `firestore.rules` and redeploy
  the rules.
- **Users can log in but see nothing** → usually a session cookie or custom
  claims problem; have the user sign out fully and back in.

Once production is stable again, fix forward on a branch and go through the
staging flow as normal.

---

## Handing the project to someone else

**Transfer ownership of all three accounts.** Firebase (Console → Project
Settings → Users and permissions → add as Owner), Vercel (transfer the project
or add an admin member), and GitHub (admin on the repo). Confirm who owns the
Firebase billing account, and whether the project is on Spark or Blaze.

**Share secrets through a password manager, never chat or email.** The values
that matter are `FIREBASE_PRIVATE_KEY`, `PHONE_ENCRYPTION_KEY`,
`IT_ID_HASH_PEPPER`, and `CRON_SECRET`. Two of them can never be rotated without
a migration script — see [`KNOWN_ISSUES.md`](KNOWN_ISSUES.md).

**Rotate the credentials the outgoing maintainer holds.** Their laptop has a
`serviceAccountKey.json` and a `.env.local` containing live production keys.
After handover, revoke that service account key in the Firebase console and
issue a fresh one to the new owner; otherwise the previous maintainer keeps full
database access indefinitely.

**Clean up test data.** Remove any test recipients, test staff accounts, and
test IT admin accounts created during QA, and release any cards used for
testing.

**Verify email delivery from production.** Staff onboarding and reactivation
both depend on Firebase password-setup emails actually arriving. Send one to a
real inbox and check it isn't in spam.

**Turn the backlog into issues.** Open a GitHub issue for each item in
[`KNOWN_ISSUES.md`](KNOWN_ISSUES.md); a list inside a markdown file gets ignored.

**Prove the handover worked.** Have the new maintainer make a trivial change and
take it to production following this runbook, unaided, while you watch. If they
can, you are done. If they get stuck, you have found the gap while you are still
available to fix it.

**Two things Bissell Centre should know about the hosting.** The Vercel Hobby
plan is free because the work is unpaid and the organization is a nonprofit — if
anyone is ever paid to maintain this, it becomes commercial use and needs a Pro
plan. Separately, Vercel's terms allow them to suspend Hobby projects at their
discretion, which is worth weighing for a tool staff depend on daily.

**Nobody is watching this app.** There is no uptime monitoring or error
alerting. If it breaks at 2am, the first report will come from a staff member.
Even a free uptime check against the login page would be an improvement.
