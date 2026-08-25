"use client";

import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getExpandedRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable,
  Row,
} from "@tanstack/react-table";
import {
  ArrowLeft,
  ArrowRight,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  CreditCard,
  Download,
  Filter,
  Flag,
  History,
  Search,
  XCircle,
  X,
} from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import StaffSelector from "../StaffSelector";
import { useIsViewOnly } from "../ViewModeContext";
import type {
  UserReportRow,
  CardHistoryEntry,
  ActivityEntry,
  ReportCardRow,
} from "./types";
// xlsx is only needed once the user actually exports, and it is a large
// dependency. Import the types statically (erased at build time) and pull the
// module in dynamically from the export handlers so it stays out of the
// initial bundle.
import type * as XLSXNS from "xlsx";

type XLSXModule = typeof import("xlsx");
const EDMONTON_TIMEZONE = "America/Edmonton";

// Constructing an Intl.DateTimeFormat is one of the most expensive ICU
// operations; these functions run once per row (and per card/activity entry)
// inside filteredData, which recomputes on every keystroke. Build each
// formatter once at module load and reuse it, instead of thousands of
// constructions per recompute — the difference is a multi-hundred-ms freeze
// per keystroke on a low-end PC when a date filter is active.
const DATE_FORMAT = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: EDMONTON_TIMEZONE,
});
const DATE_TIME_FORMAT = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: EDMONTON_TIMEZONE,
});
const DAY_KEY_FORMAT = new Intl.DateTimeFormat("en-CA", {
  timeZone: EDMONTON_TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

// --- API ---

// Server-side layered filtering: the filter params travel to the API, which
// returns only matching users, cursor-paged with bounded work per request
// (partial pages resume via cursor). The client walks the cursor so no
// single response can approach the platform response cap.
type ReportFetchResult = {
  users: UserReportRow[];
  cards: ReportCardRow[];
  truncated: string[];
};

// Bounded client-side cache for fetched report datasets, keyed by the exact
// server filter params. Email/phone searches (which the server can't filter,
// so the params don't change) previously re-walked the whole collection on
// every keystroke; a cache hit reuses the dataset instead. The cache is capped
// by total cached rows so it never becomes a memory burden on a weak PC — a
// result larger than the whole budget is simply not cached (fetch still
// works), and older entries are evicted to keep the running sum under the cap.
// Entries also expire so a repeated view doesn't serve indefinitely-stale data.
const REPORT_MEMO_MAX_ROWS = 5000;
const REPORT_MEMO_TTL_MS = 60_000;
type ReportMemoEntry = { at: number; rows: number; data: ReportFetchResult };

async function fetchReportData(
  filterParams: URLSearchParams,
  signal?: AbortSignal,
): Promise<ReportFetchResult> {
  const users: UserReportRow[] = [];
  const cardsById = new Map<string, ReportCardRow>();
  const truncated = new Set<string>();
  let cursor: string | null = null;
  let guard = 0;

  do {
    const params = new URLSearchParams(filterParams);
    params.set("limit", "300");
    if (cursor) params.set("cursor", cursor);
    const res = await fetch(`/api/reports/data?${params.toString()}`, {
      signal,
    });
    if (!res.ok) throw new Error("Failed to fetch report data");
    const page = (await res.json()) as {
      users?: UserReportRow[];
      cards?: ReportCardRow[];
      nextCursor?: string | null;
      truncated?: string[];
    };
    users.push(...(page.users ?? []));
    for (const card of page.cards ?? []) {
      const existing = cardsById.get(card.cardId);
      if (existing) {
        existing.issueDates = Array.from(
          new Set([...existing.issueDates, ...card.issueDates]),
        ).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
      } else {
        cardsById.set(card.cardId, card);
      }
    }
    for (const t of page.truncated ?? []) truncated.add(t);
    cursor = page.nextCursor ?? null;
  } while (cursor && ++guard < 200);

  users.sort((a, b) => {
    const lastCmp = a.lastName.localeCompare(b.lastName);
    return lastCmp !== 0 ? lastCmp : a.firstName.localeCompare(b.firstName);
  });

  return {
    users,
    cards: Array.from(cardsById.values()).sort((a, b) =>
      a.cardNumber.localeCompare(b.cardNumber),
    ),
    truncated: Array.from(truncated),
  };
}

// --- Helpers ---

function formatDate(dateStr: string): string {
  if (!dateStr) return "—";
  try {
    const parsed = parseFlexibleDate(dateStr);
    if (!parsed) return dateStr;
    return DATE_FORMAT.format(parsed);
  } catch {
    return dateStr;
  }
}

function formatDateTime(dateStr: string): string {
  if (!dateStr) return "—";
  try {
    const parsed = parseFlexibleDate(dateStr);
    if (!parsed) return dateStr;
    return DATE_TIME_FORMAT.format(parsed);
  } catch {
    return dateStr;
  }
}

function parseDateOnlyParts(
  value: string,
): { year: number; month: number; day: number } | null {
  const trimmed = value.trim();
  const isoDateOnly = /^(\d{4})-(\d{2})-(\d{2})$/;
  const isoDateOnlyMatch = trimmed.match(isoDateOnly);
  if (isoDateOnlyMatch) {
    return {
      year: Number(isoDateOnlyMatch[1]),
      month: Number(isoDateOnlyMatch[2]),
      day: Number(isoDateOnlyMatch[3]),
    };
  }

  const slashParts = trimmed.split("/");
  if (slashParts.length === 3) {
    const first = Number(slashParts[0]);
    const second = Number(slashParts[1]);
    const year = Number(slashParts[2]);
    if (
      Number.isFinite(first) &&
      Number.isFinite(second) &&
      Number.isFinite(year)
    ) {
      // Support both M/D/YYYY and D/M/YYYY.
      const month = first > 12 ? second : first;
      const day = first > 12 ? first : second;
      return { year, month, day };
    }
  }

  return null;
}

function parseFlexibleDate(dateStr: string): Date | null {
  if (!dateStr) return null;
  const trimmed = dateStr.trim();

  const dateOnlyParts = parseDateOnlyParts(trimmed);
  if (dateOnlyParts) {
    const parsed = new Date(
      Date.UTC(
        dateOnlyParts.year,
        dateOnlyParts.month - 1,
        dateOnlyParts.day,
        12,
        0,
        0,
      ),
    );
    if (!isNaN(parsed.getTime())) return parsed;
  }

  const iso = new Date(trimmed);
  if (!isNaN(iso.getTime())) return iso;

  return null;
}

function toEdmontonDayKey(value: Date): number {
  const parts = DAY_KEY_FORMAT.formatToParts(value);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  if (!year || !month || !day) return NaN;
  return Number(`${year}${month}${day}`);
}

function parseInputDayKey(value: string): number | null {
  if (!value) return null;
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  return Number(`${match[1]}${match[2]}${match[3]}`);
}

function autoFitColumns(
  ws: XLSXNS.WorkSheet,
  data: Record<string, string | number>[],
) {
  if (data.length === 0) return;
  const keys = Object.keys(data[0]);
  ws["!cols"] = keys.map((key) => {
    const maxLen = Math.max(
      key.length,
      ...data.map((row) => String(row[key] ?? "").length),
    );
    return { wch: Math.min(maxLen + 2, 50) };
  });
}

// --- Sub-components ---

function SortableHeader({
  label,
  onClick,
  sorted,
}: {
  label: string;
  onClick?: ((event: unknown) => void) | (() => void);
  sorted: false | "asc" | "desc";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex items-center gap-1 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-500 hover:text-gray-700"
    >
      {label}
      <span className="flex flex-col opacity-0 transition-opacity group-hover:opacity-50">
        <ChevronUp
          className={`h-2 w-2 ${sorted === "asc" ? "text-black opacity-100" : ""}`}
        />
        <ChevronDown
          className={`h-2 w-2 ${sorted === "desc" ? "text-black opacity-100" : ""}`}
        />
      </span>
    </button>
  );
}

function AccountStateBadge({
  flagged,
  banned,
  bannedAt,
}: {
  flagged: boolean;
  banned: boolean;
  bannedAt: string | null;
}) {
  if (banned) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-200 border border-red-300 px-2.5 py-0.5 text-xs font-bold text-red-800">
        <XCircle className="h-3 w-3" />
        Banned
        {bannedAt && (
          <span className="font-semibold text-red-700 ml-0.5">
            ({formatDate(bannedAt)})
          </span>
        )}
      </span>
    );
  }

  if (!flagged)
    return <span className="text-gray-500 text-xs font-semibold">No</span>;

  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-orange-200 border border-orange-300 px-2.5 py-0.5 text-xs font-bold text-orange-800">
      <Flag className="h-3 w-3" />
      Flagged
    </span>
  );
}

function StatusChip({
  status,
  flagged,
  banned,
}: {
  status: string;
  flagged: boolean;
  banned: boolean;
}) {
  if (banned) {
    return (
      <span className="inline-flex items-center justify-center rounded-full border px-3 py-1 text-xs font-bold min-w-[70px] text-center bg-red-200 text-red-900 border-red-300">
        Banned
      </span>
    );
  }

  if (flagged) {
    return (
      <span className="inline-flex items-center justify-center rounded-full border px-3 py-1 text-xs font-bold min-w-[70px] text-center bg-orange-200 text-orange-900 border-orange-300">
        Flagged
      </span>
    );
  }

  const styles: Record<string, string> = {
    Active: "bg-emerald-200 text-emerald-900 border-emerald-300",
    Inactive: "bg-gray-300 text-gray-800 border-gray-400",
    Unknown: "bg-amber-200 text-amber-900 border-amber-300",
  };
  return (
    <span
      className={`inline-flex items-center justify-center rounded-full border px-3 py-1 text-xs font-bold min-w-[70px] text-center ${styles[status] || styles.Unknown}`}
    >
      {status}
    </span>
  );
}

function CardStatusChip({ status }: { status: string }) {
  const styles: Record<string, string> = {
    Active: "bg-emerald-200 text-emerald-900 border-emerald-300",
    Unattributed: "bg-amber-200 text-amber-900 border-amber-300",
    Expired: "bg-red-200 text-red-800 border-red-300",
    Unloaded: "bg-gray-300 text-gray-800 border-gray-400",
    Cancelled: "bg-red-200 text-red-800 border-red-300",
  };
  return (
    <span
      className={`inline-flex items-center justify-center rounded-full border px-2.5 py-0.5 text-xs font-bold ${styles[status] || "bg-gray-200 text-gray-700 border-gray-300"}`}
    >
      {status}
    </span>
  );
}

function CardHistoryTable({ cards }: { cards: CardHistoryEntry[] }) {
  if (cards.length === 0) {
    return <p className="text-gray-400 text-xs italic py-2">No card history</p>;
  }
  return (
    <table className="w-full text-xs border-collapse">
      <thead>
        <tr className="bg-cyan-100 text-left">
          <th className="px-3 py-2 font-bold text-gray-900">Card #</th>
          <th className="px-3 py-2 font-bold text-gray-900">Department</th>
          <th className="px-3 py-2 font-bold text-gray-900">Status</th>
          <th className="px-3 py-2 font-bold text-gray-900">Allocated</th>
          <th className="px-3 py-2 font-bold text-gray-900">Issue Dates</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-100">
        {cards.map((card, idx) => (
          <tr key={idx} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}>
            <td className="px-3 py-2 font-mono font-semibold text-gray-900">
              {card.cardNumber || "—"}
            </td>
            <td className="px-3 py-2 text-gray-800">{card.department}</td>
            <td className="px-3 py-2">
              <CardStatusChip status={card.status} />
            </td>
            <td className="px-3 py-2 text-gray-800">
              {card.allocationDate || "—"}
            </td>
            <td className="px-3 py-2 text-gray-800">
              {card.issueDates.length > 0 ? card.issueDates.join(", ") : "—"}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ActivityHistoryTable({ entries }: { entries: ActivityEntry[] }) {
  if (entries.length === 0) {
    return (
      <p className="text-gray-400 text-xs italic py-2">No activity history</p>
    );
  }
  return (
    <table className="w-full text-xs border-collapse">
      <thead>
        <tr className="bg-amber-100 text-left">
          <th className="px-3 py-2 font-bold text-gray-900">Date</th>
          <th className="px-3 py-2 font-bold text-gray-900">Event</th>
          <th className="px-3 py-2 font-bold text-gray-900">Details</th>
          <th className="px-3 py-2 font-bold text-gray-900">Modified By</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-100">
        {entries.map((entry, idx) => (
          <tr key={idx} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}>
            <td className="px-3 py-2 text-gray-800 whitespace-nowrap">
              {formatDateTime(entry.date)}
            </td>
            <td className="px-3 py-2">
              <EventBadge event={entry.event} />
            </td>
            <td className="px-3 py-2 text-gray-800">
              {entry.notes}
              {entry.reason && (
                <span className="ml-1 text-orange-700 font-medium italic">
                  ({entry.reason})
                </span>
              )}
            </td>
            <td className="px-3 py-2 text-gray-700">
              {entry.modifiedBy || "—"}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function EventBadge({ event }: { event: string }) {
  const styles: Record<string, string> = {
    Ban: "bg-red-200 text-red-900 border-red-300",
    Unban: "bg-emerald-200 text-emerald-900 border-emerald-300",
    Override: "bg-orange-200 text-orange-900 border-orange-300",
    "Issue Card": "bg-blue-200 text-blue-900 border-blue-300",
    "Renew Card": "bg-cyan-200 text-cyan-900 border-cyan-300",
    "Status Change": "bg-purple-200 text-purple-900 border-purple-300",
  };
  return (
    <span
      className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-bold ${styles[event] || "bg-gray-200 text-gray-700 border-gray-300"}`}
    >
      {event}
    </span>
  );
}

// --- Expanded Row Content ---

function ExpandedRowContent({ row }: { row: Row<UserReportRow> }) {
  const user = row.original;
  const [activeTab, setActiveTab] = useState<"cards" | "activity">("cards");
  const fullName = `${user.firstName} ${user.lastName}`.trim();

  return (
    <div className="bg-cyan-50/30">
      <div className="px-5 py-3 space-y-3">
        {/* Owner headline — this panel belongs to THIS recipient */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-gray-900">
            {fullName || "(unnamed)"}
          </span>
          <span className="text-xs text-gray-400">— recipient details</span>
          {user.banned && (
            <span className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-medium text-red-600">
              Flagged
            </span>
          )}
        </div>

        {/* User detail summary strip */}
        <div className="flex flex-wrap gap-x-8 gap-y-2 text-sm">
          <div>
            <span className="text-gray-500">Gender:</span>{" "}
            <span className="font-medium text-gray-800">
              {user.genderIdentity || "—"}
            </span>
          </div>
          <div>
            <span className="text-gray-500">DOB:</span>{" "}
            <span className="font-medium text-gray-800">
              {user.dateOfBirth || "—"}
            </span>
          </div>
          <div>
            <span className="text-gray-500">Address:</span>{" "}
            <span className="font-medium text-gray-800">
              {user.address ? `${user.address}, ${user.postalCode}` : "—"}
            </span>
          </div>
          <div>
            <span className="text-gray-500">Registered:</span>{" "}
            <span className="font-medium text-gray-800">
              {formatDate(user.createdAt)}
            </span>
          </div>
          {user.notes && (
            <div>
              <span className="text-gray-500">Notes:</span>{" "}
              <span className="font-medium text-gray-800">{user.notes}</span>
            </div>
          )}
          {user.flagged && user.flagReason && (
            <div>
              <span className="text-gray-500">Flag Reason:</span>{" "}
              <span className="font-medium text-orange-700">
                {user.flagReason}
              </span>
            </div>
          )}
          {user.banned && user.banReason && (
            <div>
              <span className="text-gray-500">Ban Reason:</span>{" "}
              <span className="font-medium text-red-700">{user.banReason}</span>
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-cyan-100">
          <button
            onClick={() => setActiveTab("cards")}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "cards"
                ? "border-cyan-500 text-cyan-700"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            ARC Card History ({user.cardHistory.length})
          </button>
          <button
            onClick={() => setActiveTab("activity")}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "activity"
                ? "border-cyan-500 text-cyan-700"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            Activity Log ({user.activityHistory.length})
          </button>
        </div>

        {/* Tab content */}
        <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
          {activeTab === "cards" ? (
            <CardHistoryTable cards={user.cardHistory} />
          ) : (
            <ActivityHistoryTable entries={user.activityHistory} />
          )}
        </div>
      </div>
    </div>
  );
}

// --- Main Page ---

export default function ReportsPage() {
  const isViewOnly = useIsViewOnly();
  const searchParams = useSearchParams();
  const modifiedByFilter = searchParams.get("modifiedBy");
  const bannedByFilter = searchParams.get("bannedBy");
  const searchParam = searchParams.get("search");
  // Exact single-recipient deep link (e.g. from dashboard rows/cards).
  const userIdFilter = searchParams.get("userId");
  // Recipients issued a card by this staff member (admin drill-down link).
  // Server-side only: rows don't carry per-issue staff attribution.
  const issuedByFilter = searchParams.get("issuedBy");
  const [data, setData] = useState<UserReportRow[]>([]);
  const [allCards, setAllCards] = useState<ReportCardRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sorting, setSorting] = useState<SortingState>([]);

  // Search / filter
  const [searchQuery, setSearchQuery] = useState(searchParam ?? "");
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [flagFilter, setFlagFilter] = useState<
    "all" | "flagged" | "banned" | "not_flagged"
  >("all");
  const [statusFilter, setStatusFilter] = useState<("Active" | "Inactive")[]>(
    [],
  );
  const [currentCardFilter, setCurrentCardFilter] = useState<
    "all" | "has_current" | "no_current"
  >("all");
  const [cardStatusFilter, setCardStatusFilter] = useState<string[]>([]);
  const [cardDepartmentFilter, setCardDepartmentFilter] = useState<string[]>(
    [],
  );
  const [activityEventFilter, setActivityEventFilter] = useState<string[]>([]);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [dateField, setDateField] = useState<
    "registered" | "card_allocation" | "card_issue" | "activity" | "flagged"
  >("registered");
  const [datePreset, setDatePreset] = useState<
    "none" | "today" | "last7" | "last30" | "thisMonth" | "lastMonth"
  >("none");
  const filterRef = useRef<HTMLDivElement>(null);

  const [exporting, setExporting] = useState<
    "all" | "cards" | "activity" | null
  >(null);
  const [refreshing, setRefreshing] = useState(false);
  const [truncatedLayers, setTruncatedLayers] = useState<string[]>([]);

  // Static option lists — with server-side filtering, deriving options from
  // the (already filtered) dataset would make options vanish as you filter.
  const availableCardStatuses = useMemo<string[]>(
    () => ["Active", "Unattributed", "Unloaded", "Expired", "Cancelled"],
    [],
  );
  const availableCardDepartments = useMemo<string[]>(
    () =>
      [
        "Mental Health",
        "Emergency",
        "Case MCT",
        "Newcomer Volunteer",
        "Reception",
        "Housing",
        "FE/Comm Bridge",
        "FASS",
        "Child Care",
        "Employment",
        "Comp Eng Dept",
        "Transit Dept",
        "HELP Program",
      ].sort(),
    [],
  );
  const availableActivityEvents = useMemo<string[]>(
    () => ["Ban", "Issue Card", "Renew Card", "Status Change", "Unban"],
    [],
  );

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        filterRef.current &&
        !filterRef.current.contains(event.target as Node)
      ) {
        setShowFilterDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Any filter change re-fetches only the matching users from the server
  // (debounced, aborted on newer changes). The client-side filteredData memo
  // below re-applies the same predicates as a refinement — it also covers
  // the two filters the server cannot express: allocation-date ranges (the
  // stored strings mix formats) and email/phone substring search.
  const reportMemo = useRef<Map<string, ReportMemoEntry>>(new Map());
  const reportMemoRows = useRef(0);

  useEffect(() => {
    const applyReportData = (reportData: ReportFetchResult) => {
      setData(reportData.users);
      setAllCards(reportData.cards);
      setTruncatedLayers(reportData.truncated);
      setError(null);
      setLoading(false);
      setRefreshing(false);
    };

    const storeReportMemo = (key: string, reportData: ReportFetchResult) => {
      const rows = reportData.users.length + reportData.cards.length;
      const existing = reportMemo.current.get(key);
      if (existing) {
        reportMemo.current.delete(key);
        reportMemoRows.current -= existing.rows;
      }
      // A single result bigger than the whole budget is never cached — fall
      // back to fetching it fresh rather than let the cache dominate RAM.
      if (rows > REPORT_MEMO_MAX_ROWS) return;
      // Evict oldest entries (Map preserves insertion order) until this fits.
      while (
        reportMemoRows.current + rows > REPORT_MEMO_MAX_ROWS &&
        reportMemo.current.size > 0
      ) {
        const oldestKey = reportMemo.current.keys().next().value as
          string | undefined;
        if (oldestKey === undefined) break;
        const evicted = reportMemo.current.get(oldestKey);
        reportMemo.current.delete(oldestKey);
        if (evicted) reportMemoRows.current -= evicted.rows;
      }
      reportMemo.current.set(key, { at: Date.now(), rows, data: reportData });
      reportMemoRows.current += rows;
    };

    const params = new URLSearchParams();
    const q = searchQuery.trim();
    // Name-ish queries resolve through the server name index; queries
    // with @ or digits (email/phone) stay client-side.
    const looksLikePostalCode = /[a-z]/i.test(q) && /\d/.test(q);
    if (q && !q.includes("@") && (!/\d/.test(q) || looksLikePostalCode)) {
      params.set("search", q);
    }
    if (flagFilter !== "all") params.set("flag", flagFilter);
    if (statusFilter.length) params.set("statuses", statusFilter.join(","));
    if (currentCardFilter !== "all") {
      params.set("currentCard", currentCardFilter);
    }
    if (cardStatusFilter.length) {
      params.set("cardStatuses", cardStatusFilter.join(","));
    }
    if (cardDepartmentFilter.length) {
      params.set("cardDepartments", cardDepartmentFilter.join(","));
    }
    if (activityEventFilter.length) {
      params.set("events", activityEventFilter.join(","));
    }
    if (dateFrom || dateTo) {
      const paramPairs: Partial<Record<typeof dateField, [string, string]>> = {
        registered: ["createdFrom", "createdTo"],
        card_issue: ["issuedFrom", "issuedTo"],
        activity: ["activityFrom", "activityTo"],
        flagged: ["flaggedFrom", "flaggedTo"],
        // card_allocation intentionally absent: mixed date formats in
        // the stored strings make a server range unsafe — client-side.
      };
      const pair = paramPairs[dateField];
      if (pair) {
        if (dateFrom) params.set(pair[0], dateFrom);
        if (dateTo) params.set(pair[1], dateTo);
      }
    }
    if (modifiedByFilter) params.set("modifiedBy", modifiedByFilter);
    if (bannedByFilter) params.set("bannedBy", bannedByFilter);
    if (issuedByFilter) params.set("issuedBy", issuedByFilter);
    if (userIdFilter) params.set("userId", userIdFilter);

    // Identical params (e.g. successive keystrokes of a phone number, which
    // never reach the server) reuse the cached dataset — no network walk, no
    // spinner. The client-side filteredData memo still refines it locally.
    const key = params.toString();
    const cached = reportMemo.current.get(key);
    if (cached && Date.now() - cached.at < REPORT_MEMO_TTL_MS) {
      applyReportData(cached.data);
      return;
    }

    const controller = new AbortController();
    // Brief debounce so a burst of keystrokes collapses into one fetch; kept
    // short enough to stay imperceptible for a deliberate filter change.
    const timeoutId = window.setTimeout(async () => {
      try {
        setRefreshing(true);
        const reportData = await fetchReportData(params, controller.signal);
        storeReportMemo(key, reportData);
        applyReportData(reportData);
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError(
          err instanceof Error ? err.message : "Failed to fetch report data",
        );
        setLoading(false);
        setRefreshing(false);
      }
    }, 350);
    return () => {
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [
    searchQuery,
    flagFilter,
    statusFilter,
    currentCardFilter,
    cardStatusFilter,
    cardDepartmentFilter,
    activityEventFilter,
    dateFrom,
    dateTo,
    dateField,
    modifiedByFilter,
    bannedByFilter,
    issuedByFilter,
    userIdFilter,
  ]);

  // Keep the search box in sync with /reports?search= so dashboard links,
  // history entries, and refreshes restore the same filtered view.
  useEffect(() => {
    setSearchQuery((prev) => {
      const fromUrl = searchParam ?? "";
      return fromUrl !== prev ? fromUrl : prev;
    });
  }, [searchParam]);

  const updateSearchQuery = (q: string) => {
    setSearchQuery(q);
    const params = new URLSearchParams(window.location.search);
    if (q) params.set("search", q);
    else params.delete("search");
    const qs = params.toString();
    window.history.replaceState(null, "", qs ? `/reports?${qs}` : "/reports");
  };

  const clearUserIdFilter = () => {
    const params = new URLSearchParams(window.location.search);
    params.delete("userId");
    const qs = params.toString();
    window.history.replaceState(null, "", qs ? `/reports?${qs}` : "/reports");
  };

  const clearIssuedByFilter = () => {
    const params = new URLSearchParams(window.location.search);
    params.delete("issuedBy");
    const qs = params.toString();
    window.history.replaceState(null, "", qs ? `/reports?${qs}` : "/reports");
  };

  const filteredData = useMemo(() => {
    let result = data;

    if (userIdFilter) {
      result = result.filter((u) => u.userId === userIdFilter);
    }

    if (searchQuery.trim()) {
      const raw = searchQuery.trim();
      // Mirror the fetch effect's split. Email/phone queries (which contain @
      // or a digit) are never sent to the server, so this is the ONLY place
      // they are filtered — keep the raw substring match over all fields.
      const isEmailOrPhone = raw.includes("@") || /\d/.test(raw);
      if (isEmailOrPhone) {
        const q = raw.toLowerCase();
        result = result.filter(
          (u) =>
            u.firstName.toLowerCase().includes(q) ||
            u.lastName.toLowerCase().includes(q) ||
            u.email.toLowerCase().includes(q) ||
            u.phoneNumber.toLowerCase().includes(q) ||
            `${u.firstName} ${u.lastName}`.toLowerCase().includes(q),
        );
      }
      // Name-ish queries were already matched server-side through the folded /
      // alias / phonetic index. Re-filtering here with a raw includes() silently
      // dropped diacritic (Renée), apostrophe (O'Brien), hyphen (Jo-Ann),
      // spacing (Jo Ann vs Jo-Ann), and ALIAS matches the server correctly
      // returned — so trust the server result and do not re-filter by name.
    }

    if (flagFilter === "flagged") {
      result = result.filter((u) => u.flagged);
    } else if (flagFilter === "banned") {
      result = result.filter((u) => u.banned);
    } else if (flagFilter === "not_flagged") {
      result = result.filter((u) => !u.flagged && !u.banned);
    }

    if (statusFilter.length > 0) {
      result = result.filter((u) =>
        statusFilter.includes(u.status as "Active" | "Inactive"),
      );
    }

    if (currentCardFilter === "has_current") {
      result = result.filter((u) => Boolean(u.currentArcCard));
    } else if (currentCardFilter === "no_current") {
      result = result.filter((u) => !u.currentArcCard);
    }

    if (cardStatusFilter.length > 0) {
      const selectedStatuses = new Set(cardStatusFilter);
      result = result.filter((u) =>
        u.cardHistory.some((card) => selectedStatuses.has(card.status)),
      );
    }

    if (cardDepartmentFilter.length > 0) {
      const selectedDepartments = new Set(cardDepartmentFilter);
      result = result.filter((u) =>
        u.cardHistory.some((card) => selectedDepartments.has(card.department)),
      );
    }

    if (activityEventFilter.length > 0) {
      const selectedEvents = new Set(activityEventFilter);
      result = result.filter((u) =>
        u.activityHistory.some((entry) => selectedEvents.has(entry.event)),
      );
    }

    if (dateFrom || dateTo) {
      const fromDayKey = parseInputDayKey(dateFrom);
      const toDayKey = parseInputDayKey(dateTo);
      const inRange = (dateStr: string) => {
        const parsed = parseFlexibleDate(dateStr);
        if (!parsed) return false;
        const dayKey = toEdmontonDayKey(parsed);
        if (Number.isNaN(dayKey)) return false;
        if (fromDayKey !== null && dayKey < fromDayKey) return false;
        if (toDayKey !== null && dayKey > toDayKey) return false;
        return true;
      };

      result = result.filter((u) => {
        if (dateField === "registered") {
          return inRange(u.createdAt);
        }
        if (dateField === "flagged") {
          return !!u.bannedAt && inRange(u.bannedAt);
        }
        if (dateField === "card_allocation") {
          return u.cardHistory.some((card) => inRange(card.allocationDate));
        }
        if (dateField === "card_issue") {
          return u.cardHistory.some((card) =>
            card.issueDates.some((issueDate) => inRange(issueDate)),
          );
        }
        return u.activityHistory.some((activity) => inRange(activity.date));
      });
    }

    // IT-admin "view as staff" filters — keep users whose activity or ban was
    // performed by the selected staff.
    if (modifiedByFilter) {
      result = result.filter((u) =>
        u.activityHistory.some((a) => a.modifiedBy === modifiedByFilter),
      );
    }
    if (bannedByFilter) {
      result = result.filter((u) => u.bannedBy === bannedByFilter);
    }

    return result;
  }, [
    data,
    searchQuery,
    flagFilter,
    statusFilter,
    currentCardFilter,
    cardStatusFilter,
    cardDepartmentFilter,
    activityEventFilter,
    dateFrom,
    dateTo,
    dateField,
    modifiedByFilter,
    bannedByFilter,
    userIdFilter,
  ]);

  const activeFilterCount =
    (flagFilter !== "all" ? 1 : 0) +
    statusFilter.length +
    (currentCardFilter !== "all" ? 1 : 0) +
    cardStatusFilter.length +
    cardDepartmentFilter.length +
    activityEventFilter.length +
    (dateFrom ? 1 : 0) +
    (dateTo ? 1 : 0);

  const clearAllFilters = () => {
    setFlagFilter("all");
    setStatusFilter([]);
    setCurrentCardFilter("all");
    setCardStatusFilter([]);
    setCardDepartmentFilter([]);
    setActivityEventFilter([]);
    setDateFrom("");
    setDateTo("");
    setDateField("registered");
    setDatePreset("none");
    updateSearchQuery("");
  };

  const applyDatePreset = (
    preset: "today" | "last7" | "last30" | "thisMonth" | "lastMonth",
  ) => {
    const now = new Date();
    const start = new Date(now);
    const end = new Date(now);

    if (preset === "today") {
      // start/end are today
    } else if (preset === "last7") {
      start.setDate(now.getDate() - 6);
    } else if (preset === "last30") {
      start.setDate(now.getDate() - 29);
    } else if (preset === "thisMonth") {
      start.setDate(1);
    } else if (preset === "lastMonth") {
      start.setMonth(now.getMonth() - 1, 1);
      end.setDate(0);
    }

    const toInput = (date: Date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    };
    setDateFrom(toInput(start));
    setDateTo(toInput(end));
    setDatePreset(preset);
  };

  const toggleStatusFilter = (s: "Active" | "Inactive") => {
    setStatusFilter((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s],
    );
  };

  const toggleStringFilter = (
    value: string,
    setter: (updater: (prev: string[]) => string[]) => void,
  ) => {
    setter((prev) =>
      prev.includes(value)
        ? prev.filter((item) => item !== value)
        : [...prev, value],
    );
  };

  const buildUserSheet = (XLSX: XLSXModule, wb: XLSXNS.WorkBook) => {
    const userRows = filteredData.map((u, i) => ({
      "#": i + 1,
      "First Name": u.firstName,
      "Last Name": u.lastName,
      Email: u.email || "",
      Phone: u.phoneNumber || "",
      Status: u.status,
      Flagged: u.flagged ? "Yes" : "No",
      Banned: u.banned ? "Yes" : "No",
      "Flagged Date": u.bannedAt ? formatDate(u.bannedAt) : "",
      "Flag Reason": u.flagReason || "",
      "Ban Reason": u.banReason || "",
      Gender: u.genderIdentity || "",
      "Date of Birth": u.dateOfBirth || "",
      Address: u.address || "",
      "Postal Code": u.postalCode || "",
      "Cards owned (complete history)": u.totalCardsIssued,
      "Current ARC Card": u.currentArcCard || "",
      "Current Department of ARC Card": u.currentArcCardDepartment || "",
      "Activity Events": u.activityHistory.length,
      Notes: u.notes || "",
      Registered: u.createdAt ? formatDate(u.createdAt) : "",
    }));
    const ws = XLSX.utils.json_to_sheet(userRows);
    autoFitColumns(ws, userRows);
    XLSX.utils.book_append_sheet(wb, ws, "Users");
  };

  const buildExportInfoSheet = (
    XLSX: XLSXModule,
    wb: XLSXNS.WorkBook,
    scope: "All" | "Cards" | "Activity",
  ) => {
    const dateFieldLabel: Record<typeof dateField, string> = {
      registered: "Registered Date",
      card_allocation: "Card Allocation Date",
      card_issue: "Card Issue Date",
      activity: "Activity Date",
      flagged: "Flagged Date",
    };
    const presetLabel: Record<typeof datePreset, string> = {
      none: "Custom / None",
      today: "Today",
      last7: "Last 7 Days",
      last30: "Last 30 Days",
      thisMonth: "This Month",
      lastMonth: "Last Month",
    };
    const rows: Array<Record<string, string | number>> = [
      { Field: "Export Scope", Value: scope },
      { Field: "Generated At", Value: new Date().toISOString() },
      { Field: "Total Rows (Users Table)", Value: filteredData.length },
      { Field: "Search Query", Value: searchQuery || "None" },
      { Field: "Flag Filter", Value: flagFilter },
      {
        Field: "Status Filter",
        Value: statusFilter.length > 0 ? statusFilter.join(", ") : "All",
      },
      { Field: "Current Card Filter", Value: currentCardFilter },
      {
        Field: "Card Status Filter",
        Value:
          cardStatusFilter.length > 0 ? cardStatusFilter.join(", ") : "All",
      },
      {
        Field: "Card Department Filter",
        Value:
          cardDepartmentFilter.length > 0
            ? cardDepartmentFilter.join(", ")
            : "All",
      },
      {
        Field: "Activity Event Filter",
        Value:
          activityEventFilter.length > 0
            ? activityEventFilter.join(", ")
            : "All",
      },
      { Field: "Date Field", Value: dateFieldLabel[dateField] },
      { Field: "Date Preset", Value: presetLabel[datePreset] },
      { Field: "Date From", Value: dateFrom || "None" },
      { Field: "Date To", Value: dateTo || "None" },
    ];
    const ws = XLSX.utils.json_to_sheet(rows);
    autoFitColumns(ws, rows);
    XLSX.utils.book_append_sheet(wb, ws, "Export Info");
  };

  const buildCardSheet = (XLSX: XLSXModule, wb: XLSXNS.WorkBook) => {
    const filteredCardIdsFromUsers = new Set(
      filteredData.flatMap((user) =>
        user.cardHistory.map((card) => card.cardId),
      ),
    );
    let cardsForExport = allCards.filter((card) =>
      filteredCardIdsFromUsers.has(card.cardId),
    );

    if (cardStatusFilter.length > 0) {
      const selectedStatuses = new Set(cardStatusFilter);
      cardsForExport = cardsForExport.filter((card) =>
        selectedStatuses.has(card.status),
      );
    }

    if (cardDepartmentFilter.length > 0) {
      const selectedDepartments = new Set(cardDepartmentFilter);
      cardsForExport = cardsForExport.filter((card) =>
        selectedDepartments.has(card.department),
      );
    }

    if ((dateFrom || dateTo) && dateField === "card_allocation") {
      const fromDayKey = parseInputDayKey(dateFrom);
      const toDayKey = parseInputDayKey(dateTo);
      cardsForExport = cardsForExport.filter((card) => {
        const parsed = parseFlexibleDate(card.allocationDate);
        if (!parsed) return false;
        const dayKey = toEdmontonDayKey(parsed);
        if (Number.isNaN(dayKey)) return false;
        if (fromDayKey !== null && dayKey < fromDayKey) return false;
        if (toDayKey !== null && dayKey > toDayKey) return false;
        return true;
      });
    }

    if ((dateFrom || dateTo) && dateField === "card_issue") {
      const fromDayKey = parseInputDayKey(dateFrom);
      const toDayKey = parseInputDayKey(dateTo);
      cardsForExport = cardsForExport.filter((card) =>
        card.issueDates.some((issueDate) => {
          const parsed = parseFlexibleDate(issueDate);
          if (!parsed) return false;
          const dayKey = toEdmontonDayKey(parsed);
          if (Number.isNaN(dayKey)) return false;
          if (fromDayKey !== null && dayKey < fromDayKey) return false;
          if (toDayKey !== null && dayKey > toDayKey) return false;
          return true;
        }),
      );
    }

    const cardRows: Record<string, string | number>[] = cardsForExport.map(
      (c) => ({
        "Card ID": c.cardId,
        "Card Number": c.cardNumber,
        "Security Code": c.securityCode,
        Department: c.department,
        "Card Status": c.status,
        "Allocation Date": c.allocationDate,
        "Current User ID": c.currentUserId || "",
        "Current User Name": c.currentUserName || "",
        "Issue Dates": c.issueDates.join(", "),
        Notes: c.notes || "",
        "Created At": c.createdAt || "",
        "Updated At": c.updatedAt || "",
      }),
    );
    const ws = XLSX.utils.json_to_sheet(
      cardRows.length > 0 ? cardRows : [{ Info: "No cards found." }],
    );
    if (cardRows.length > 0) autoFitColumns(ws, cardRows);
    XLSX.utils.book_append_sheet(wb, ws, "Card History");
  };

  const buildActivitySheet = (XLSX: XLSXModule, wb: XLSXNS.WorkBook) => {
    const activityRows: Record<string, string>[] = [];
    for (const u of filteredData) {
      for (const entry of u.activityHistory) {
        activityRows.push({
          "First Name": u.firstName,
          "Last Name": u.lastName,
          Date: entry.date ? formatDateTime(entry.date) : "",
          Event: entry.event,
          Details: entry.notes,
          Reason: entry.reason || "",
          "Modified By": entry.modifiedBy || "",
        });
      }
    }
    const ws = XLSX.utils.json_to_sheet(
      activityRows.length > 0
        ? activityRows
        : [{ Info: "No activity history for the current filter" }],
    );
    if (activityRows.length > 0) autoFitColumns(ws, activityRows);
    XLSX.utils.book_append_sheet(wb, ws, "Activity Log");
  };

  const downloadWorkbook = (
    XLSX: XLSXModule,
    wb: XLSXNS.WorkBook,
    suffix: string,
  ) => {
    const today = new Date().toISOString().split("T")[0];
    XLSX.writeFile(wb, `user-reports-${suffix}-${today}.xlsx`);
  };

  const handleExportAll = async () => {
    setExporting("all");
    try {
      const XLSX = await import("xlsx");
      const wb = XLSX.utils.book_new();
      buildExportInfoSheet(XLSX, wb, "All");
      buildUserSheet(XLSX, wb);
      buildCardSheet(XLSX, wb);
      buildActivitySheet(XLSX, wb);
      downloadWorkbook(XLSX, wb, "all");
    } catch {
      alert("Failed to generate export");
    } finally {
      setExporting(null);
    }
  };

  const handleExportCards = async () => {
    setExporting("cards");
    try {
      const XLSX = await import("xlsx");
      const wb = XLSX.utils.book_new();
      buildExportInfoSheet(XLSX, wb, "Cards");
      buildCardSheet(XLSX, wb);
      downloadWorkbook(XLSX, wb, "cards");
    } catch {
      alert("Failed to generate export");
    } finally {
      setExporting(null);
    }
  };

  const handleExportActivity = async () => {
    setExporting("activity");
    try {
      const XLSX = await import("xlsx");
      const wb = XLSX.utils.book_new();
      buildExportInfoSheet(XLSX, wb, "Activity");
      buildActivitySheet(XLSX, wb);
      downloadWorkbook(XLSX, wb, "activity");
    } catch {
      alert("Failed to generate export");
    } finally {
      setExporting(null);
    }
  };

  // Column definitions
  const columns = useMemo<ColumnDef<UserReportRow>[]>(
    () => [
      {
        id: "expander",
        header: () => null,
        cell: ({ row }) => (
          <button
            onClick={row.getToggleExpandedHandler()}
            className="p-1 rounded hover:bg-gray-200 transition-colors"
          >
            {row.getIsExpanded() ? (
              <ChevronDown className="h-4 w-4 text-gray-800" />
            ) : (
              <ChevronRight className="h-4 w-4 text-gray-600" />
            )}
          </button>
        ),
        size: 40,
      },
      {
        id: "rowNumber",
        header: ({ column }) => (
          <SortableHeader
            label="No."
            sorted={column.getIsSorted()}
            onClick={column.getToggleSortingHandler()}
          />
        ),
        cell: ({ row }) => (
          <span className="text-gray-700 font-semibold">{row.index + 1}</span>
        ),
        size: 50,
      },
      {
        accessorKey: "firstName",
        header: ({ column }) => (
          <SortableHeader
            label="First Name"
            sorted={column.getIsSorted()}
            onClick={column.getToggleSortingHandler()}
          />
        ),
        cell: ({ getValue }) => (
          <span className="font-medium text-gray-900">
            {getValue<string>()}
          </span>
        ),
      },
      {
        accessorKey: "lastName",
        header: ({ column }) => (
          <SortableHeader
            label="Last Name"
            sorted={column.getIsSorted()}
            onClick={column.getToggleSortingHandler()}
          />
        ),
        cell: ({ getValue }) => (
          <span className="font-medium text-gray-900">
            {getValue<string>()}
          </span>
        ),
      },
      {
        accessorKey: "email",
        header: ({ column }) => (
          <SortableHeader
            label="Email"
            sorted={column.getIsSorted()}
            onClick={column.getToggleSortingHandler()}
          />
        ),
        cell: ({ getValue }) => (
          <span className="text-gray-800 text-xs">
            {getValue<string>() || "—"}
          </span>
        ),
      },
      {
        accessorKey: "phoneNumber",
        header: () => (
          <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
            Phone
          </span>
        ),
        cell: ({ getValue }) => (
          <span className="text-gray-800">{getValue<string>() || "—"}</span>
        ),
      },
      {
        accessorKey: "status",
        header: () => (
          <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
            Status
          </span>
        ),
        cell: ({ row, getValue }) => (
          <StatusChip
            status={getValue<string>()}
            flagged={row.original.flagged}
            banned={row.original.banned}
          />
        ),
      },
      {
        id: "currentArcCard",
        accessorKey: "currentArcCard",
        header: ({ column }) => (
          <SortableHeader
            label="Current ARC Card"
            sorted={column.getIsSorted()}
            onClick={column.getToggleSortingHandler()}
          />
        ),
        cell: ({ getValue }) => (
          <span className="font-mono text-gray-800 text-xs">
            {getValue<string>() || "—"}
          </span>
        ),
      },
      {
        id: "currentArcCardDepartment",
        accessorKey: "currentArcCardDepartment",
        header: () => (
          <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
            Current Card Dept.
          </span>
        ),
        cell: ({ getValue }) => (
          <span className="text-gray-800 text-xs">
            {getValue<string>() || "—"}
          </span>
        ),
      },
      {
        accessorKey: "banned",
        header: ({ column }) => (
          <SortableHeader
            label="Account Flags"
            sorted={column.getIsSorted()}
            onClick={column.getToggleSortingHandler()}
          />
        ),
        cell: ({ row }) => (
          <AccountStateBadge
            flagged={row.original.flagged}
            banned={row.original.banned}
            bannedAt={row.original.bannedAt}
          />
        ),
        sortingFn: (rowA, rowB) => {
          const rank = (row: UserReportRow) => {
            if (row.banned) return 2;
            if (row.flagged) return 1;
            return 0;
          };
          const a = rank(rowA.original);
          const b = rank(rowB.original);
          return a - b;
        },
      },
      {
        accessorKey: "totalCardsIssued",
        header: ({ column }) => (
          <SortableHeader
            label="Cards Owned (Complete History)"
            sorted={column.getIsSorted()}
            onClick={column.getToggleSortingHandler()}
          />
        ),
        cell: ({ getValue }) => {
          const count = getValue<number>();
          return (
            <span
              className={`inline-flex items-center justify-center rounded-full border px-2.5 py-0.5 text-xs font-bold ${
                count > 0
                  ? "bg-cyan-200 text-cyan-900 border-cyan-300"
                  : "bg-gray-200 text-gray-600 border-gray-300"
              }`}
            >
              {count}
            </span>
          );
        },
        size: 70,
      },
      {
        id: "activityCount",
        header: () => (
          <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
            History
          </span>
        ),
        cell: ({ row }) => {
          const count = row.original.activityHistory.length;
          return (
            <span className="text-gray-700 text-xs font-medium">
              {count} event{count !== 1 ? "s" : ""}
            </span>
          );
        },
        size: 80,
      },
    ],
    [],
  );

  const table = useReactTable({
    data: filteredData,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    getRowCanExpand: () => true,
    initialState: {
      pagination: { pageSize: 20 },
    },
  });

  const rows = table.getRowModel().rows;
  const { pageIndex, pageSize } = table.getState().pagination;
  const start = pageIndex * pageSize + 1;
  const end = Math.min(start + rows.length - 1, filteredData.length);

  const columnWidths: Record<string, string> = {
    expander: "40px",
    rowNumber: "50px",
    firstName: "130px",
    lastName: "130px",
    email: "180px",
    phoneNumber: "120px",
    status: "90px",
    currentArcCard: "140px",
    currentArcCardDepartment: "140px",
    banned: "140px",
    totalCardsIssued: "70px",
    activityCount: "80px",
  };

  // Summary stats
  const totalUsers = filteredData.length;
  const flaggedCount = filteredData.filter((u) => u.flagged).length;
  const bannedCount = filteredData.filter((u) => u.banned).length;
  const totalCards = filteredData.reduce((s, u) => s + u.totalCardsIssued, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px] bg-gray-50">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-cyan-500 border-t-transparent" />
          <span className="text-gray-500">Loading report data...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px] bg-gray-50">
        <div className="text-red-500">Error: {error}</div>
      </div>
    );
  }

  return (
    <div className="space-y-4 px-2 py-3 sm:p-6 bg-gray-50 font-sans">
      {/* Header */}
      {isViewOnly && (
        <div className="flex flex-wrap items-center gap-3">
          <StaffSelector queryParam="modifiedBy" label="Activity by" />
          <StaffSelector queryParam="bannedBy" label="Flags by" />
          {(modifiedByFilter || bannedByFilter) && (
            <span className="text-xs text-gray-500">
              {filteredData.length} recipient
              {filteredData.length === 1 ? "" : "s"} match
            </span>
          )}
        </div>
      )}
      {issuedByFilter && (
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-2 rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-xs font-medium text-cyan-800">
            Showing recipients issued a card by the selected staff member
            <button
              type="button"
              onClick={clearIssuedByFilter}
              title="Show all recipients"
              className="rounded-full p-0.5 text-cyan-600 hover:bg-cyan-100"
            >
              <X size={12} strokeWidth={3} />
            </button>
          </span>
        </div>
      )}
      {userIdFilter && (
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-2 rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-xs font-medium text-cyan-800">
            Showing single recipient:{" "}
            {filteredData[0]
              ? `${filteredData[0].firstName} ${filteredData[0].lastName}`.trim()
              : "(not found)"}
            <button
              type="button"
              onClick={clearUserIdFilter}
              title="Show all recipients"
              className="rounded-full p-0.5 text-cyan-600 hover:bg-cyan-100"
            >
              <X size={12} strokeWidth={3} />
            </button>
          </span>
        </div>
      )}
      {truncatedLayers.length > 0 && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          A filter matched a very large number of records (
          {truncatedLayers.join(", ")}) and was capped — results may be
          incomplete. Narrow the filters for exact results.
        </div>
      )}
      <header className="flex flex-col gap-3 pb-2 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">User Reports</h1>
          <p className="text-sm text-gray-500 mt-1">
            Comprehensive view of all recipients — card history, flags, and
            activity
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
          {/* Search */}
          <div className="relative w-full sm:w-72">
            <input
              type="search"
              placeholder="Search by name, email, phone..."
              value={searchQuery}
              onChange={(e) => updateSearchQuery(e.target.value)}
              className="w-full rounded-md border border-gray-300 bg-white pl-4 pr-10 py-2 text-sm placeholder-gray-400 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
            />
            {searchQuery ? (
              <button
                onClick={() => updateSearchQuery("")}
                className="absolute right-1 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-gray-400 hover:text-gray-600"
              >
                <X size={14} strokeWidth={3} />
              </button>
            ) : (
              <div className="absolute right-1 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-white bg-cyan-400">
                <Search size={14} strokeWidth={3} />
              </div>
            )}
          </div>

          {/* Filter */}
          <div className="relative" ref={filterRef}>
            <button
              onClick={() => setShowFilterDropdown(!showFilterDropdown)}
              className={`flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-semibold transition-colors ${
                activeFilterCount > 0
                  ? "border-cyan-500 bg-cyan-50 text-cyan-700"
                  : "border-cyan-500 text-cyan-600 hover:bg-cyan-50"
              }`}
            >
              <Filter className="h-4 w-4" />
              Filter
              {activeFilterCount > 0 && (
                <span className="ml-1 rounded-full bg-cyan-500 px-2 py-0.5 text-xs text-white">
                  {activeFilterCount}
                </span>
              )}
            </button>

            {showFilterDropdown && (
              <div className="absolute right-0 top-full mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-lg border border-gray-200 bg-white shadow-lg z-50">
                <div className="p-4">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-gray-900">Filters</h3>
                    {activeFilterCount > 0 && (
                      <button
                        onClick={clearAllFilters}
                        className="text-xs text-cyan-600 hover:text-cyan-700"
                      >
                        Clear all
                      </button>
                    )}
                  </div>

                  {/* Date range filter */}
                  <div className="mb-4">
                    <h4 className="text-sm font-medium text-gray-700 mb-2">
                      Date Filter
                    </h4>
                    <div className="mb-2">
                      <label className="block text-xs text-gray-500 mb-1">
                        Filter by date field
                      </label>
                      <select
                        value={dateField}
                        onChange={(e) =>
                          setDateField(
                            e.target.value as
                              | "registered"
                              | "card_allocation"
                              | "card_issue"
                              | "activity"
                              | "flagged",
                          )
                        }
                        className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-xs focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                      >
                        <option value="registered">Registered Date</option>
                        <option value="card_allocation">
                          Card Allocation Date
                        </option>
                        <option value="card_issue">Card Issue Date</option>
                        <option value="activity">Activity Date</option>
                        <option value="flagged">Flagged Date</option>
                      </select>
                    </div>
                    <div className="mb-2">
                      <label className="block text-xs text-gray-500 mb-1">
                        Quick presets
                      </label>
                      <div className="flex flex-wrap gap-1.5">
                        {(
                          [
                            ["today", "Today"],
                            ["last7", "Last 7d"],
                            ["last30", "Last 30d"],
                            ["thisMonth", "This Month"],
                            ["lastMonth", "Last Month"],
                          ] as const
                        ).map(([preset, label]) => (
                          <button
                            key={preset}
                            onClick={() => applyDatePreset(preset)}
                            className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                              datePreset === preset
                                ? "bg-cyan-100 text-cyan-700 ring-2 ring-offset-1 ring-cyan-500"
                                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                            }`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <label className="block text-xs text-gray-500 mb-1">
                      Custom range
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="date"
                        value={dateFrom}
                        onChange={(e) => {
                          setDateFrom(e.target.value);
                          setDatePreset("none");
                        }}
                        className="flex-1 border border-gray-300 rounded-md px-2 py-1.5 text-xs focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                      />
                      <span className="text-gray-400 text-xs">to</span>
                      <input
                        type="date"
                        value={dateTo}
                        onChange={(e) => {
                          setDateTo(e.target.value);
                          setDatePreset("none");
                        }}
                        className="flex-1 border border-gray-300 rounded-md px-2 py-1.5 text-xs focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                      />
                    </div>
                  </div>

                  {/* Flagged filter */}
                  <div className="mb-4">
                    <h4 className="text-sm font-medium text-gray-700 mb-2">
                      Flagged Status
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {(
                        ["all", "flagged", "banned", "not_flagged"] as const
                      ).map((opt) => (
                        <button
                          key={opt}
                          onClick={() => setFlagFilter(opt)}
                          className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                            flagFilter === opt
                              ? opt === "flagged" || opt === "banned"
                                ? "bg-red-100 text-red-700 ring-2 ring-offset-1 ring-cyan-500"
                                : "bg-cyan-100 text-cyan-700 ring-2 ring-offset-1 ring-cyan-500"
                              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                          }`}
                        >
                          {opt === "all"
                            ? "All"
                            : opt === "flagged"
                              ? "Flagged"
                              : opt === "banned"
                                ? "Banned"
                                : "Not Flagged"}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Account Status filter */}
                  <div className="mb-4">
                    <h4 className="text-sm font-medium text-gray-700 mb-2">
                      Account Status
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {(["Active", "Inactive"] as const).map((s) => (
                        <button
                          key={s}
                          onClick={() => toggleStatusFilter(s)}
                          className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                            statusFilter.includes(s)
                              ? "bg-cyan-100 text-cyan-700 ring-2 ring-offset-1 ring-cyan-500"
                              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                          }`}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Current card filter */}
                  <div className="mb-4">
                    <h4 className="text-sm font-medium text-gray-700 mb-2">
                      Current ARC Card
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {(
                        [
                          ["all", "All"],
                          ["has_current", "Has Current Card"],
                          ["no_current", "No Current Card"],
                        ] as const
                      ).map(([opt, label]) => (
                        <button
                          key={opt}
                          onClick={() => setCurrentCardFilter(opt)}
                          className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                            currentCardFilter === opt
                              ? "bg-cyan-100 text-cyan-700 ring-2 ring-offset-1 ring-cyan-500"
                              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Card status filter */}
                  <div className="mb-4">
                    <h4 className="text-sm font-medium text-gray-700 mb-2">
                      Card Status History
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {availableCardStatuses.map((status) => (
                        <button
                          key={status}
                          onClick={() =>
                            toggleStringFilter(status, setCardStatusFilter)
                          }
                          className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                            cardStatusFilter.includes(status)
                              ? "bg-cyan-100 text-cyan-700 ring-2 ring-offset-1 ring-cyan-500"
                              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                          }`}
                        >
                          {status}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Card department filter */}
                  <div className="mb-4">
                    <h4 className="text-sm font-medium text-gray-700 mb-2">
                      Card Department History
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {availableCardDepartments.map((department) => (
                        <button
                          key={department}
                          onClick={() =>
                            toggleStringFilter(
                              department,
                              setCardDepartmentFilter,
                            )
                          }
                          className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                            cardDepartmentFilter.includes(department)
                              ? "bg-cyan-100 text-cyan-700 ring-2 ring-offset-1 ring-cyan-500"
                              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                          }`}
                        >
                          {department}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Activity event filter */}
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-2">
                      Activity Event Type
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {availableActivityEvents.map((eventName) => (
                        <button
                          key={eventName}
                          onClick={() =>
                            toggleStringFilter(
                              eventName,
                              setActivityEventFilter,
                            )
                          }
                          className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                            activityEventFilter.includes(eventName)
                              ? "bg-cyan-100 text-cyan-700 ring-2 ring-offset-1 ring-cyan-500"
                              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                          }`}
                        >
                          {eventName}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Export buttons */}
          <div className="flex items-center rounded-md shadow-sm overflow-x-auto">
            <button
              onClick={handleExportAll}
              disabled={!!exporting}
              className="flex items-center gap-1.5 bg-primary px-3.5 py-2 text-sm font-semibold text-white hover:bg-cyan-600 disabled:opacity-50 transition-colors"
            >
              <Download className="h-4 w-4" />
              {exporting === "all" ? "Exporting..." : "Export All"}
            </button>
            <div className="w-px bg-cyan-400/50 self-stretch" />
            <button
              onClick={handleExportCards}
              disabled={!!exporting}
              className="flex items-center gap-1.5 bg-primary px-3 py-2 text-sm font-medium text-white hover:bg-cyan-600 disabled:opacity-50 transition-colors"
              title="Download Card History sheet"
            >
              <CreditCard className="h-3.5 w-3.5" />
              {exporting === "cards" ? "..." : "Cards"}
            </button>
            <div className="w-px bg-cyan-400/50 self-stretch" />
            <button
              onClick={handleExportActivity}
              disabled={!!exporting}
              className="flex items-center gap-1.5 bg-primary px-3 py-2 text-sm font-medium text-white hover:bg-cyan-600 disabled:opacity-50 transition-colors rounded-r-md"
              title="Download Activity Log sheet"
            >
              <History className="h-3.5 w-3.5" />
              {exporting === "activity" ? "..." : "Activity"}
            </button>
          </div>
        </div>
      </header>

      {/* Summary stats bar */}
      <div className="flex gap-3 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:gap-4 sm:overflow-visible">
        <div className="flex-1 min-w-[180px] rounded-lg border border-cyan-200 bg-white px-4 py-3 flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-cyan-200 flex items-center justify-center">
            <span className="text-cyan-900 font-extrabold text-sm">
              {totalUsers}
            </span>
          </div>
          <div>
            <p className="text-xs font-medium text-gray-600">
              Total Recipients
            </p>
            <p className="text-sm font-bold text-gray-900">
              {filteredData.length !== data.length
                ? `${totalUsers} of ${data.length}`
                : `${totalUsers}`}
            </p>
          </div>
        </div>
        <div className="flex-1 min-w-[180px] rounded-lg border border-red-200 bg-white px-4 py-3 flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-red-200 flex items-center justify-center">
            <Flag className="h-4.5 w-4.5 text-red-700" />
          </div>
          <div>
            <p className="text-xs font-medium text-gray-600">Flagged Users</p>
            <p className="text-sm font-bold text-gray-900">{flaggedCount}</p>
          </div>
        </div>
        <div className="flex-1 min-w-[180px] rounded-lg border border-rose-200 bg-white px-4 py-3 flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-rose-200 flex items-center justify-center">
            <XCircle className="h-4.5 w-4.5 text-rose-700" />
          </div>
          <div>
            <p className="text-xs font-medium text-gray-600">Banned Users</p>
            <p className="text-sm font-bold text-gray-900">{bannedCount}</p>
          </div>
        </div>
        <div className="flex-1 min-w-[180px] rounded-lg border border-blue-200 bg-white px-4 py-3 flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-blue-200 flex items-center justify-center">
            <span className="text-blue-900 font-extrabold text-sm">
              {totalCards}
            </span>
          </div>
          <div>
            <p className="text-xs font-medium text-gray-600">
              Total Cards Issued
            </p>
            <p className="text-sm font-bold text-gray-900">{totalCards}</p>
          </div>
        </div>
      </div>

      {/* Table */}
      <div
        className={`overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm transition-opacity ${
          refreshing ? "pointer-events-none opacity-60" : ""
        }`}
      >
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                {table.getFlatHeaders().map((header) => (
                  <th
                    key={header.id}
                    className="px-3 py-2 text-left align-middle"
                    style={{ width: columnWidths[header.id] ?? "auto" }}
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((row) => (
                <Fragment key={row.id}>
                  <tr
                    className={`transition-colors cursor-pointer ${
                      row.getIsExpanded()
                        ? "bg-cyan-50 [&>td:first-child]:border-l-4 [&>td:first-child]:border-l-cyan-500"
                        : "bg-white hover:bg-cyan-50/40"
                    }`}
                    onClick={row.getToggleExpandedHandler()}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="px-3 py-2.5 align-middle">
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext(),
                        )}
                      </td>
                    ))}
                  </tr>
                  {row.getIsExpanded() && (
                    <tr>
                      {/* Same left accent as the parent row so the panel
                          reads as belonging to that recipient. */}
                      <td
                        colSpan={columns.length}
                        className="p-0 border-l-4 border-l-cyan-500"
                      >
                        <ExpandedRowContent row={row} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td
                    colSpan={columns.length}
                    className="p-8 text-center text-gray-500"
                  >
                    No recipients found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-end gap-4 py-4 pr-2">
        <button
          onClick={() => table.previousPage()}
          disabled={!table.getCanPreviousPage()}
          className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-white hover:bg-cyan-600 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>

        <span className="text-sm font-medium text-gray-600">
          {filteredData.length === 0 ? "0" : `${start}-${end}`} of{" "}
          {filteredData.length}
          {filteredData.length !== data.length && (
            <span className="text-gray-400">
              {" "}
              (filtered from {data.length})
            </span>
          )}
        </span>

        <button
          onClick={() => table.nextPage()}
          disabled={!table.getCanNextPage()}
          className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-white hover:bg-cyan-600 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
