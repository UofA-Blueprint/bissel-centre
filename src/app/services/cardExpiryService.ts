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
const MAX_SWEEP_ROUNDS = 50; // runaway guard (~20k cards)

/**
 * Claim this month's run transactionally BEFORE sweeping, so two overlapping
 * cron invocations can never double-process. Trade-off: if the sweep dies
 * mid-way the month stays claimed and remaining cards need a manual re-run
 * (clear lastRunMonthKey) — preferred over double-processing.
 */
async function claimMonthlyRun(db: Firestore, monthKey: string): Promise<boolean> {
  const settingsRef = db
    .collection(MONTHLY_UNLOAD_SETTINGS_COLLECTION)
    .doc(MONTHLY_UNLOAD_SETTINGS_DOC);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(settingsRef);
    const data = (snap.data() ?? {}) as Partial<MonthlyUnloadSchedule>;
    if (data.lastRunMonthKey === monthKey) return false;
    tx.set(
      settingsRef,
      {
        lastRunMonthKey: monthKey,
        lastRunAt: new Date().toISOString(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
    return true;
  });
}

/**
 * Unload every non-Unloaded card in bounded batches. Each committed batch
 * removes its docs from the filtered query, so re-querying until empty is
 * both the pagination and the progress tracking.
 */
async function sweepLoadedCards(db: Firestore): Promise<number> {
  let updated = 0;
  for (let round = 0; round < MAX_SWEEP_ROUNDS; round++) {
    const snap = await db
      .collection("arc_cards")
      .where("status", "in", NON_UNLOADED_STATUSES)
      .select() // refs only
      .limit(SWEEP_BATCH_SIZE)
      .get();
    if (snap.empty) break;

    const batch = db.batch();
    for (const doc of snap.docs) {
      batch.update(doc.ref, {
        status: "Unloaded",
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
    await batch.commit();
    updated += snap.size;
    if (snap.size < SWEEP_BATCH_SIZE) break;
  }
  return updated;
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
}> {
  const now = getEdmontonNowParts();
  const monthKey = `${String(now.year).padStart(4, "0")}-${String(now.month).padStart(2, "0")}`;
  const scheduleTime = parseTime24(schedule.time24) ?? { hour: 0, minute: 0 };
  const isScheduledDay = now.day === schedule.dayOfMonth;
  const hasReachedTime =
    now.hour > scheduleTime.hour ||
    (now.hour === scheduleTime.hour && now.minute >= scheduleTime.minute);
  const wouldRunNow =
    schedule.enabled &&
    isScheduledDay &&
    hasReachedTime &&
    schedule.lastRunMonthKey !== monthKey;

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

  const claimed = await claimMonthlyRun(db, monthKey);
  if (!claimed) {
    return {
      ran: false,
      updatedCardCount: 0,
      monthKey,
      reason: "already ran (or a concurrent invocation claimed this month)",
    };
  }

  const updatedCardCount = await sweepLoadedCards(db);
  return { ran: true, updatedCardCount, monthKey };
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
    ...(result.dryRun
      ? { dryRun: true, wouldRunNow: result.wouldRunNow }
      : {}),
    ...(result.reason ? { reason: result.reason } : {}),
  };
}