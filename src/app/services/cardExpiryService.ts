import "server-only";

import admin from "firebase-admin";
import { Firestore } from "firebase-admin/firestore";

const EDMONTON_TIMEZONE = "America/Edmonton";
const MONTHLY_UNLOAD_SETTINGS_COLLECTION = "app_settings";
const MONTHLY_UNLOAD_SETTINGS_DOC = "arc_card_monthly_unload";

export type MonthlyUnloadSchedule = {
  enabled: boolean;
  dayOfMonth: number;
  time24: string; // HH:mm in Edmonton local time.
  timezone: string;
  lastRunMonthKey?: string;
  lastRunAt?: string | null;
  // Set only while a sweep is part-finished. sweepCursor is the id of the last
  // arc_cards doc unloaded, so the next invocation picks up from there.
  sweepMonthKey?: string;
  sweepCursor?: string;
};

function getEdmontonNowParts() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: EDMONTON_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date());

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value || "";

  return {
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day")),
    hour: Number(get("hour")),
    minute: Number(get("minute")),
  };
}

// Day 0 of the following month is the last day of this one. `month` is 1-based,
// matching getEdmontonNowParts().
function daysInEdmontonMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function parseTime24(value: string): { hour: number; minute: number } | null {
  const match = String(value || "").match(/^([01]\d|2[0-3]):([0-5]\d)$/);
  if (!match) return null;
  return {
    hour: Number(match[1]),
    minute: Number(match[2]),
  };
}

export function getDefaultMonthlyUnloadSchedule(): MonthlyUnloadSchedule {
  return {
    enabled: false,
    dayOfMonth: 1,
    time24: "00:00",
    timezone: EDMONTON_TIMEZONE,
    lastRunMonthKey: undefined,
    lastRunAt: null,
    sweepMonthKey: undefined,
    sweepCursor: undefined,
  };
}

export async function getMonthlyUnloadSchedule(
  db: Firestore,
): Promise<MonthlyUnloadSchedule> {
  const settingsRef = db
    .collection(MONTHLY_UNLOAD_SETTINGS_COLLECTION)
    .doc(MONTHLY_UNLOAD_SETTINGS_DOC);
  const snap = await settingsRef.get();
  if (!snap.exists) return getDefaultMonthlyUnloadSchedule();

  const data = snap.data() as Partial<MonthlyUnloadSchedule> | undefined;
  const parsedTime = parseTime24(String(data?.time24 || ""));

  return {
    enabled: Boolean(data?.enabled),
    dayOfMonth: Math.min(31, Math.max(1, Number(data?.dayOfMonth || 1))),
    time24: parsedTime
      ? `${String(parsedTime.hour).padStart(2, "0")}:${String(parsedTime.minute).padStart(2, "0")}`
      : "00:00",
    timezone: EDMONTON_TIMEZONE,
    lastRunMonthKey:
      typeof data?.lastRunMonthKey === "string" ? data.lastRunMonthKey : undefined,
    lastRunAt:
      typeof data?.lastRunAt === "string" ? data.lastRunAt : null,
    sweepMonthKey:
      typeof data?.sweepMonthKey === "string" ? data.sweepMonthKey : undefined,
    sweepCursor:
      typeof data?.sweepCursor === "string" && data.sweepCursor.length > 0
        ? data.sweepCursor
        : undefined,
  };
}

export async function updateMonthlyUnloadSchedule(
  db: Firestore,
  input: { dayOfMonth: number; time24: string; enabled?: boolean },
): Promise<MonthlyUnloadSchedule> {
  const parsedTime = parseTime24(input.time24);
  if (!parsedTime) {
    throw new Error("Time must be in HH:mm format.");
  }
  if (!Number.isInteger(input.dayOfMonth) || input.dayOfMonth < 1 || input.dayOfMonth > 31) {
    throw new Error("Day of month must be between 1 and 31.");
  }

  const settingsRef = db
    .collection(MONTHLY_UNLOAD_SETTINGS_COLLECTION)
    .doc(MONTHLY_UNLOAD_SETTINGS_DOC);
  const current = await getMonthlyUnloadSchedule(db);
  const next: MonthlyUnloadSchedule = {
    ...current,
    enabled: input.enabled ?? true,
    dayOfMonth: input.dayOfMonth,
    time24: `${String(parsedTime.hour).padStart(2, "0")}:${String(parsedTime.minute).padStart(2, "0")}`,
    timezone: EDMONTON_TIMEZONE,
  };
  const scheduleWritePayload: Record<string, unknown> = {
    enabled: next.enabled,
    dayOfMonth: next.dayOfMonth,
    time24: next.time24,
    timezone: next.timezone,
    lastRunAt: next.lastRunAt ?? null,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };
  if (typeof next.lastRunMonthKey === "string" && next.lastRunMonthKey.length > 0) {
    scheduleWritePayload.lastRunMonthKey = next.lastRunMonthKey;
  }

  await settingsRef.set(
    scheduleWritePayload,
    { merge: true },
  );
  return next;
}

// Only statuses that actually need unloading — the sweep never reads
// already-Unloaded cards, so its cost tracks work to do, not collection size.
const NON_UNLOADED_STATUSES = ["Active", "Unattributed", "Expired", "Cancelled"];
const SWEEP_BATCH_SIZE = 400; // under Firestore's 500-op batch cap
const MAX_SWEEP_ROUNDS = 50; // per-invocation cap (~20k cards)
// Held well below the smallest function timeout this app can be deployed under
// (60s on Vercel Hobby without fluid compute) so the cursor is always saved
// before the platform kills the invocation.
const SWEEP_TIME_BUDGET_MS = 45_000;

/**
 * Claim this month's run transactionally BEFORE sweeping, so two overlapping
 * cron invocations can never double-process. A sweep that doesn't finish keeps
 * the claim and leaves a cursor behind instead; see sweepLoadedCards.
 */
async function claimMonthlyRun(db: Firestore, monthKey: string): Promise<boolean> {
  const settingsRef = db
    .collection(MONTHLY_UNLOAD_SETTINGS_COLLECTION)
    .doc(MONTHLY_UNLOAD_SETTINGS_DOC);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(settingsRef);
    const data = (snap.data() ?? {}) as Partial<MonthlyUnloadSchedule>;
    if (data.lastRunMonthKey === monthKey) return false;
    // lastRunAt is deliberately not set here. Claiming isn't running: a run
    // that fails before touching a single card releases the claim again, and
    // staff would otherwise see a "Last run" time for a sweep that did nothing.
    // recordSweepProgress stamps it once real work has been committed.
    tx.set(
      settingsRef,
      {
        lastRunMonthKey: monthKey,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
    return true;
  });
}

/**
 * Unload every non-Unloaded card in bounded batches, walking the collection in
 * document-id order so an interrupted run can resume exactly where it stopped.
 *
 * Ordering by id rather than re-querying the filter from the top is what makes
 * resuming safe: staff may reactivate a card in the hours between a partial run
 * and its continuation, and those cards sit behind the cursor, so the resumed
 * sweep leaves them alone instead of unloading them a second time.
 */
async function sweepLoadedCards(
  db: Firestore,
  startAfterId?: string,
): Promise<{
  updated: number;
  complete: boolean;
  cursor: string | null;
  error?: unknown;
}> {
  const deadline = Date.now() + SWEEP_TIME_BUDGET_MS;
  const cards = db.collection("arc_cards");
  let updated = 0;
  let cursor: string | null = startAfterId ?? null;
  let complete = false;
  let error: unknown;

  for (let round = 0; round < MAX_SWEEP_ROUNDS; round++) {
    // Caught rather than thrown so the caller can still persist the cursor for
    // the batches that did commit; the error is handed back and rethrown there.
    try {
      let query = cards
        .where("status", "in", NON_UNLOADED_STATUSES)
        .orderBy(admin.firestore.FieldPath.documentId())
        .select() // refs only
        .limit(SWEEP_BATCH_SIZE);
      if (cursor) query = query.startAfter(cards.doc(cursor));

      const snap = await query.get();
      if (snap.empty) {
        complete = true;
        break;
      }

      const batch = db.batch();
      for (const doc of snap.docs) {
        batch.update(doc.ref, {
          status: "Unloaded",
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }
      await batch.commit();
      updated += snap.size;
      cursor = snap.docs[snap.docs.length - 1].id;

      if (snap.size < SWEEP_BATCH_SIZE) {
        complete = true;
        break;
      }
    } catch (err) {
      error = err;
      break;
    }
    if (Date.now() >= deadline) break;
  }

  return { updated, complete, cursor, error };
}

// Hands the month back after a run that wrote nothing, so the next invocation
// retries instead of the month staying claimed with cards still loaded.
async function releaseMonthlyClaim(
  db: Firestore,
  monthKey: string,
): Promise<void> {
  const settingsRef = db
    .collection(MONTHLY_UNLOAD_SETTINGS_COLLECTION)
    .doc(MONTHLY_UNLOAD_SETTINGS_DOC);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(settingsRef);
    const data = (snap.data() ?? {}) as Partial<MonthlyUnloadSchedule>;
    if (data.lastRunMonthKey !== monthKey) return;
    tx.set(
      settingsRef,
      {
        lastRunMonthKey: null,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
  });
}

// Nulls rather than undefined: Firestore rejects undefined values outright.
async function recordSweepProgress(
  db: Firestore,
  monthKey: string,
  cursor: string | null,
  complete: boolean,
): Promise<void> {
  await db
    .collection(MONTHLY_UNLOAD_SETTINGS_COLLECTION)
    .doc(MONTHLY_UNLOAD_SETTINGS_DOC)
    .set(
      {
        sweepMonthKey: complete ? null : monthKey,
        sweepCursor: complete ? null : cursor,
        lastRunAt: new Date().toISOString(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
}

async function runMonthlyUnload(
  db: Firestore,
  schedule: MonthlyUnloadSchedule,
  opts?: { dryRun?: boolean },
): Promise<{
  ran: boolean;
  updatedCardCount: number;
  monthKey: string;
  dryRun?: boolean;
  wouldRunNow?: boolean;
  reason?: string;
  sweepComplete?: boolean;
  resumed?: boolean;
}> {
  const now = getEdmontonNowParts();
  const monthKey = `${String(now.year).padStart(4, "0")}-${String(now.month).padStart(2, "0")}`;
  const scheduleTime = parseTime24(schedule.time24) ?? { hour: 0, minute: 0 };
  // Clamp to the final day of short months, otherwise a 29th–31st schedule
  // never matches in February and that month silently skips.
  const targetDay = Math.min(
    schedule.dayOfMonth,
    daysInEdmontonMonth(now.year, now.month),
  );
  const hasReachedTime =
    now.hour > scheduleTime.hour ||
    (now.hour === scheduleTime.hour && now.minute >= scheduleTime.minute);
  // "On or after" rather than "exactly on": the sweep must still happen if the
  // cron fires once a day (Vercel Hobby allows no more than that) or if an
  // outage swallowed the scheduled window. lastRunMonthKey keeps it to once a
  // month regardless of how many invocations find it due.
  const isDue =
    now.day > targetDay || (now.day === targetDay && hasReachedTime);
  // A cursor left over from an earlier month is ignored: that month's window
  // has passed, and this month's own run will sweep those cards anyway.
  const hasUnfinishedSweep =
    schedule.sweepMonthKey === monthKey && Boolean(schedule.sweepCursor);
  const wouldRunNow =
    schedule.enabled &&
    (hasUnfinishedSweep ||
      (isDue && schedule.lastRunMonthKey !== monthKey));

  // Dry run: report what a live run would do — a single aggregate, zero
  // doc reads, zero writes, no lock claimed.
  if (opts?.dryRun) {
    const agg = await db
      .collection("arc_cards")
      .where("status", "in", NON_UNLOADED_STATUSES)
      .count()
      .get();
    return {
      ran: false,
      dryRun: true,
      wouldRunNow,
      updatedCardCount: agg.data().count,
      monthKey,
    };
  }

  if (!wouldRunNow) {
    return { ran: false, updatedCardCount: 0, monthKey };
  }

  // A resumed sweep is already covered by the claim made when it first started.
  if (!hasUnfinishedSweep) {
    const claimed = await claimMonthlyRun(db, monthKey);
    if (!claimed) {
      return {
        ran: false,
        updatedCardCount: 0,
        monthKey,
        reason: "already ran (or a concurrent invocation claimed this month)",
      };
    }
  }

  const sweep = await sweepLoadedCards(
    db,
    hasUnfinishedSweep ? schedule.sweepCursor : undefined,
  );
  if (sweep.error && sweep.cursor === null) {
    await releaseMonthlyClaim(db, monthKey);
    throw sweep.error;
  }
  await recordSweepProgress(db, monthKey, sweep.cursor, sweep.complete);
  if (sweep.error) throw sweep.error;

  return {
    ran: true,
    updatedCardCount: sweep.updated,
    monthKey,
    sweepComplete: sweep.complete,
    resumed: hasUnfinishedSweep,
    ...(sweep.complete
      ? {}
      : { reason: "sweep hit its time budget; the next run resumes from the saved cursor" }),
  };
}

export async function expireOverdueArcCards(
  db: Firestore,
  opts?: { dryRun?: boolean },
) {
  // Backward-compatible function name: now handles monthly unload schedule.
  const schedule = await getMonthlyUnloadSchedule(db);
  const result = await runMonthlyUnload(db, schedule, opts);
  return {
    mode: "monthly_unload",
    timezone: EDMONTON_TIMEZONE,
    schedule,
    ran: result.ran,
    ranForMonthKey: result.monthKey,
    updatedCardCount: result.updatedCardCount,
    ...(result.ran
      ? { sweepComplete: result.sweepComplete, resumed: result.resumed }
      : {}),
    ...(result.dryRun
      ? { dryRun: true, wouldRunNow: result.wouldRunNow }
      : {}),
    ...(result.reason ? { reason: result.reason } : {}),
  };
}