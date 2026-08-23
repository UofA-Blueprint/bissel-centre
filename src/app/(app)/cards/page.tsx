"use client";

import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable,
} from "@tanstack/react-table";
import { ArrowLeft, ArrowRight, ChevronDown, ChevronRight, ChevronUp, Filter, Plus, Search, X } from "lucide-react";
import { Dialog, DialogBackdrop, DialogPanel, DialogTitle } from "@headlessui/react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import BackNavigation from "@/app/components/BackNavigation";
import { useIsViewOnly } from "../ViewModeContext";
import {
  CardStatus,
  CardDepartment,
  STATUS_STYLES,
  DEPARTMENT_STYLES,
  STATUS_OPTIONS,
  DEPARTMENT_OPTIONS,
} from "./types";

// --- Types ---

type CardRow = {
  id: string;
  currentUserId?: string | null;
  allocationDate: string;
  status: CardStatus;
  department: CardDepartment;
  final7Digits: string;
  securityCode: string;
  passRecipient: string;
  issueDates: string[];
  issuedByAny: string[];
  notes: string;
};

type MonthlyUnloadSchedule = {
  enabled: boolean;
  dayOfMonth: number;
  time24: string;
  timezone: string;
  lastRunMonthKey?: string;
  lastRunAt?: string | null;
};

const STATUS_MEANINGS: Record<CardStatus, string> = {
  Active: "Card is currently assigned and in use by a recipient.",
  Unattributed: "Ready to be issued; currently not assigned.",
  Unloaded: "Card exists but is not loaded with funds.",
  Expired: "Card is no longer valid due to expiry.",
  Cancelled: "Card is cancelled and should not be used.",
};

// --- API Fetch Function ---

async function fetchCards(): Promise<{
  cards: CardRow[];
  monthlyUnloadSchedule: MonthlyUnloadSchedule;
}> {
  const response = await fetch("/api/cards");
  if (!response.ok) {
    throw new Error("Failed to fetch cards");
  }
  const data = await response.json();
  return {
    cards: data.cards.map((card: {
    id: string;
    currentUserId?: string | null;
    allocationDate: string;
    status: CardStatus;
    department: CardDepartment;
    arcCardNumber: string;
    securityCode: string;
    passRecipient: string;
    issueDates: string[];
    issuedByAny?: string[];
    notes: string;
  }) => ({
    id: card.id,
    currentUserId: card.currentUserId || null,
    allocationDate: card.allocationDate,
    status: card.status,
    department: card.department,
    final7Digits: card.arcCardNumber?.slice(-7) ?? "",
    securityCode: card.securityCode,
    passRecipient: card.passRecipient,
    issueDates: card.issueDates,
    issuedByAny: card.issuedByAny ?? [],
    notes: card.notes,
  })),
    monthlyUnloadSchedule: data.monthlyUnloadSchedule ?? {
      enabled: false,
      dayOfMonth: 1,
      time24: "00:00",
      timezone: "America/Edmonton",
      lastRunMonthKey: undefined,
      lastRunAt: null,
    },
  };
}

// --- Styles ---

const statusStyles = STATUS_STYLES;

const deptStyles = DEPARTMENT_STYLES;

// --- Components ---

function Chip({ label, tone }: { label: string; tone: string }) {
  return (
    <span
      className={`inline-flex items-center justify-center rounded-full px-3 py-1 text-xs font-bold shadow-sm ${tone} min-w-[80px] text-center`}
    >
      {label}
    </span>
  );
}

function SortableHeader({
  label,
  onClick,
  sorted,
}: {
  label: string;
  onClick?: (event: unknown) => void;
  sorted: false | "asc" | "desc";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex items-center gap-1 text-left text-xs font-bold text-gray-900 hover:text-black"
    >
      {label}
      <span className="flex flex-col opacity-0 transition-opacity group-hover:opacity-50">
        <ChevronUp className={`h-2 w-2 ${sorted === "asc" ? "text-black opacity-100" : ""}`} />
        <ChevronDown className={`h-2 w-2 ${sorted === "desc" ? "text-black opacity-100" : ""}`} />
      </span>
    </button>
  );
}



const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];
const EDMONTON_TIMEZONE = "America/Edmonton";

// Normalize inconsistent date strings (YYYY-MM-DD or M/D/YYYY) to "Mon D, YYYY".
function formatDate(value: string): string {
  if (!value) return "";
  const iso = value.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  const us = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  let y: number, m: number, d: number;
  if (iso) {
    y = +iso[1];
    m = +iso[2];
    d = +iso[3];
  } else if (us) {
    m = +us[1];
    d = +us[2];
    y = +us[3];
  } else {
    return value;
  }
  if (m < 1 || m > 12) return value;
  return `${MONTHS[m - 1]} ${d}, ${y}`;
}

function formatDateTime(value: string): string {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: EDMONTON_TIMEZONE,
  }).format(parsed);
}

function StatusSelect({
  value,
  onChange,
  className = "",
  disabled = false,
  disabledReason,
}: {
  value: CardStatus;
  onChange: (next: CardStatus) => void;
  className?: string;
  disabled?: boolean;
  disabledReason?: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as CardStatus)}
      disabled={disabled}
      title={disabled ? disabledReason : undefined}
      className={`rounded-md border border-gray-300 bg-white px-2 py-1 text-sm ${
        disabled ? "cursor-not-allowed opacity-60" : ""
      } ${className}`}
    >
      {STATUS_OPTIONS.map((s) => (
        <option key={s} value={s}>
          {s}
        </option>
      ))}
    </select>
  );
}

const VIEW_ONLY_CARDS_TIP =
  "Sign in as administrative staff to change card status.";
const VIEW_ONLY_NEW_ALLOCATION_TIP =
  "Sign in as administrative staff to allocate new cards.";

export default function CardsPage() {
  const isViewOnly = useIsViewOnly();
  const [data, setData] = useState<CardRow[]>([]);
  const [monthlyUnloadSchedule, setMonthlyUnloadSchedule] =
    useState<MonthlyUnloadSchedule>({
      enabled: false,
      dayOfMonth: 1,
      time24: "00:00",
      timezone: "America/Edmonton",
      lastRunMonthKey: undefined,
      lastRunAt: null,
    });
  const [scheduleDayInput, setScheduleDayInput] = useState("1");
  const [scheduleTimeInput, setScheduleTimeInput] = useState("00:00");
  const [isSavingSchedule, setIsSavingSchedule] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [barsHidden, setBarsHidden] = useState(false);
  const toolbarRef = useRef<HTMLDivElement>(null);
  
  // Search and Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [statusFilters, setStatusFilters] = useState<CardStatus[]>([]);
  const [departmentFilters, setDepartmentFilters] = useState<CardDepartment[]>([]);

  // edit card api call
const updateCardStatus = async (cardId: string, nextStatus: CardStatus) => {
  const firstRes = await fetch("/api/cards", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: cardId, status: nextStatus, confirmDangerous: false }),
  });
  const firstPayload = await firstRes.json();
  if (firstRes.status === 409 && firstPayload?.requiresConfirmation) {
    const reasonText = Array.isArray(firstPayload.reasons)
      ? firstPayload.reasons.map((r: string) => `- ${r}`).join("\n")
      : "";
    const ok = window.confirm(
      `Warning: This could be dangerous.\n\n` +
        `${firstPayload.warning ?? ""}\n\n` +
        `${reasonText}\n\n` +
        `Selected status meaning:\n${nextStatus}: ${STATUS_MEANINGS[nextStatus]}\n\n` +
        `Continue anyway?`,
    );
    if (!ok) return;
    const secondRes = await fetch("/api/cards", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: cardId, status: nextStatus, confirmDangerous: true }),
    });
    if (!secondRes.ok) {
      const secondPayload = await secondRes.json().catch(() => ({}));
      throw new Error(secondPayload.error || "Failed to force update status");
    }
  } else if (!firstRes.ok) {
    throw new Error(firstPayload.error || "Failed to update card status");
  }
  setData((prev) =>
    prev.map((card) =>
      card.id === cardId
        ? {
            ...card,
            status: nextStatus,
            // Keep recipient display in sync with server unlink behavior.
            passRecipient: nextStatus === "Active" ? card.passRecipient : "",
            currentUserId: nextStatus === "Active" ? card.currentUserId : null,
          }
        : card
    ),
  );
};

const forceUnassignCard = async (cardId: string, cardLabel: string) => {
  const firstRes = await fetch("/api/cards", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "FORCE_UNASSIGN",
      id: cardId,
      confirmDangerous: false,
    }),
  });
  const firstPayload = await firstRes.json().catch(() => ({}));
  if (firstRes.status === 409 && firstPayload?.requiresConfirmation) {
    const reasonText = Array.isArray(firstPayload.reasons)
      ? firstPayload.reasons.map((r: string) => `- ${r}`).join("\n")
      : "";
    const ok = window.confirm(
      `Warning: You are force unassigning this card.\n\n` +
        `Card: ${cardLabel}\n\n` +
        `${firstPayload.warning ?? ""}\n\n` +
        `${reasonText}\n\n` +
        `Continue?`,
    );
    if (!ok) return;
    const secondRes = await fetch("/api/cards", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "FORCE_UNASSIGN",
        id: cardId,
        confirmDangerous: true,
      }),
    });
    if (!secondRes.ok) {
      const secondPayload = await secondRes.json().catch(() => ({}));
      throw new Error(secondPayload.error || "Failed to force unassign card");
    }
  } else if (!firstRes.ok) {
    throw new Error(firstPayload.error || "Failed to force unassign card");
  }

  setData((prev) =>
    prev.map((card) =>
      card.id === cardId
        ? {
            ...card,
            status: "Unattributed",
            passRecipient: "",
            currentUserId: null,
          }
        : card,
    ),
  );
};

const saveMonthlyUnloadSchedule = async () => {
  const parsedDay = Number(scheduleDayInput);
  if (!Number.isInteger(parsedDay) || parsedDay < 1 || parsedDay > 31) {
    setError("Monthly unload day must be between 1 and 31.");
    return;
  }
  if (!/^([01]\d|2[0-3]):([0-5]\d)$/.test(scheduleTimeInput)) {
    setError("Monthly unload time must be in HH:mm format.");
    return;
  }

  try {
    setError(null);
    setIsSavingSchedule(true);
    const response = await fetch("/api/cards", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "UPDATE_MONTHLY_UNLOAD_SCHEDULE",
        dayOfMonth: parsedDay,
        time24: scheduleTimeInput,
        enabled: true,
      }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload.error || "Failed to save monthly unload schedule");
    }
    if (payload?.monthlyUnloadSchedule) {
      setMonthlyUnloadSchedule(payload.monthlyUnloadSchedule as MonthlyUnloadSchedule);
      setScheduleDayInput(String(payload.monthlyUnloadSchedule.dayOfMonth));
      setScheduleTimeInput(String(payload.monthlyUnloadSchedule.time24));
    }
  } catch (err) {
    setError(err instanceof Error ? err.message : "Failed to save monthly unload schedule");
  } finally {
    setIsSavingSchedule(false);
  }
};

  // Hide the sticky search/pagination bars on scroll-down; reveal on scroll-up or tap.
  useEffect(() => {
    let lastY = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      // Only hide once the toolbar is actually pinned at the top, so it never
      // translates while still scrolling into place (the partial-state glitch).
      const pinned = (toolbarRef.current?.getBoundingClientRect().top ?? 1) <= 0;
      if (y > lastY && pinned) setBarsHidden(true);
      else if (y < lastY) setBarsHidden(false);
      lastY = y;
    };
    const reveal = () => setBarsHidden(false);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("touchstart", reveal, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("touchstart", reveal);
    };
  }, []);

  useEffect(() => {
    fetchCards()
      .then((payload) => {
        setData(payload.cards);
        setMonthlyUnloadSchedule(payload.monthlyUnloadSchedule);
        setScheduleDayInput(String(payload.monthlyUnloadSchedule.dayOfMonth));
        setScheduleTimeInput(String(payload.monthlyUnloadSchedule.time24));
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  // Filter and search logic
  const filteredData = useMemo(() => {
    let result = data;

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter((card) =>
        card.passRecipient.toLowerCase().includes(query) ||
        card.final7Digits.toLowerCase().includes(query) ||
        card.securityCode.toLowerCase().includes(query) ||
        card.notes.toLowerCase().includes(query) ||
        card.department.toLowerCase().includes(query)
      );
    }

    // Apply status filter
    if (statusFilters.length > 0) {
      result = result.filter((card) => statusFilters.includes(card.status));
    }

    // Apply department filter
    if (departmentFilters.length > 0) {
      result = result.filter((card) => departmentFilters.includes(card.department));
    }

    return result;
  }, [data, searchQuery, statusFilters, departmentFilters]);

  const toggleStatusFilter = (status: CardStatus) => {
    setStatusFilters((prev) =>
      prev.includes(status) ? prev.filter((s) => s !== status) : [...prev, status]
    );
  };

  const toggleDepartmentFilter = (dept: CardDepartment) => {
    setDepartmentFilters((prev) =>
      prev.includes(dept) ? prev.filter((d) => d !== dept) : [...prev, dept]
    );
  };

  const clearAllFilters = () => {
    setStatusFilters([]);
    setDepartmentFilters([]);
    setSearchQuery("");
  };

  const activeFilterCount = statusFilters.length + departmentFilters.length;

  // Column Definitions
  const columns = useMemo<ColumnDef<CardRow>[]>(
    () => [
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
          <span className="text-gray-500 font-medium pl-2">{row.index + 1}</span>
        ),
        size: 50,
      },
      {
        accessorKey: "status",
        header: () => <span className="text-xs font-bold text-gray-900">Status</span>,
        cell: ({ row, getValue }) => (
          <StatusSelect
            value={getValue<CardStatus>()}
            onChange={(next) => void updateCardStatus(row.original.id, next)}
            disabled={isViewOnly}
            disabledReason={VIEW_ONLY_CARDS_TIP}
          />
        ),
      },
      {
        accessorKey: "department",
        header: () => <span className="text-xs font-bold text-gray-900">Department</span>,
        cell: ({ getValue }) => {
          const value = getValue<CardDepartment>();
          return <Chip label={value} tone={deptStyles[value]} />;
        },
      },
      {
        accessorKey: "final7Digits",
        header: ({ column }) => (
          <SortableHeader
            label="Final 7 Digits"
            sorted={column.getIsSorted()}
            onClick={column.getToggleSortingHandler()}
          />
        ),
        cell: ({ getValue }) => (
          <span className="text-gray-700">{getValue<string>()}</span>
        ),
      },
      {
        accessorKey: "securityCode",
        header: ({ column }) => (
          <SortableHeader
            label="Security Code"
            sorted={column.getIsSorted()}
            onClick={column.getToggleSortingHandler()}
          />
        ),
        cell: ({ getValue }) => <span className="text-gray-700">{getValue<string>()}</span>,
      },
      {
        accessorKey: "passRecipient",
        header: () => <span className="text-xs font-bold text-gray-900">Pass Recipient</span>,
        cell: ({ getValue }) => (
          <span className="font-medium text-gray-900">{getValue<string>() || "No recipient"}</span>
        ),
      },
      {
        id: "allocationDateDisplay",
        accessorKey: "allocationDate",
        header: () => <span className="text-xs font-bold text-gray-900">Allocation Date</span>,
        cell: ({ getValue }) => (
          <span className="text-gray-700">{formatDate(getValue<string>()) || "—"}</span>
        ),
      },
      {
        accessorKey: "notes",
        header: () => <span className="text-xs font-bold text-gray-900">Notes</span>,
        cell: ({ getValue }) => <span className="text-gray-500">{getValue<string>()}</span>,
      },
      {
        id: "actions",
        header: () => <span className="text-xs font-bold text-gray-900">Actions</span>,
        cell: ({ row }) => {
          const card = row.original;
          const canForceUnassign = Boolean(card.currentUserId);
          return (
            <button
              type="button"
              disabled={!canForceUnassign}
              onClick={() =>
                void forceUnassignCard(
                  card.id,
                  `${card.final7Digits || "Unknown"} (${card.passRecipient || "No recipient"})`,
                )
              }
              className="rounded-md border border-rose-200 bg-rose-50 px-2 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-100 disabled:cursor-not-allowed disabled:border-gray-200 disabled:bg-gray-100 disabled:text-gray-400"
            >
              Force Unassign
            </button>
          );
        },
      },
    ],
    [isViewOnly]
  );

  const table = useReactTable({
    data: filteredData,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      pagination: {
        pageSize: 15,
      },
    },
  });

  const rows = table.getRowModel().rows;
  const selectedCard = data.find((c) => c.id === selectedCardId) ?? null;
  const { pageIndex, pageSize } = table.getState().pagination;
  const start = pageIndex * pageSize + 1;
  const end = Math.min(start + rows.length - 1, filteredData.length);
  
  // Hardcoded width based on the screenshot column distribution
  const columnWidths: Record<string, string> = {
    rowNumber: "60px",
    status: "130px",
    department: "180px",
    final7Digits: "120px",
    securityCode: "120px",
    passRecipient: "200px",
    allocationDateDisplay: "180px",
    notes: "100px",
    actions: "130px",
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px] bg-gray-50">
        <div className="text-gray-500">Loading cards...</div>
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
      <BackNavigation href="/dashboard" label="Back to Staff Dashboard" />
      {/* --- Title --- */}
      <h1 className="text-2xl font-bold text-gray-900">ARC Card Master List</h1>
      <p className="rounded-lg border border-cyan-100 bg-cyan-50 px-3 py-2 text-xs sm:text-sm text-cyan-900">
        Card statuses: <strong>Active</strong> = assigned and usable, <strong>Unloaded</strong> = assigned or unassigned but not loaded, <strong>Unattributed</strong> = unassigned, <strong>Expired</strong> = no longer valid, <strong>Cancelled</strong> = retired card.
      </p>

      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">
              Monthly Auto-Unload Schedule (Edmonton Time)
            </h2>
            <p className="text-xs text-gray-500">
              On the chosen day/time each month, all cards automatically become Unloaded. Assigned users stay linked unless Force Unassign is used.
            </p>
            <p className="mt-1 text-xs text-gray-500">
              Last run: {monthlyUnloadSchedule.lastRunAt ? formatDateTime(monthlyUnloadSchedule.lastRunAt) : "Never"}
            </p>
            <p className="mt-0.5 text-xs text-gray-500">
              Saved schedule: Day {monthlyUnloadSchedule.dayOfMonth} at {monthlyUnloadSchedule.time24} ({monthlyUnloadSchedule.timezone})
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <label className="flex flex-col">
              <span className="text-xs text-gray-600">Day of month</span>
              <input
                type="number"
                min={1}
                max={31}
                value={scheduleDayInput}
                onChange={(e) => setScheduleDayInput(e.target.value)}
                className="w-24 rounded-md border border-gray-300 px-2 py-1.5 text-sm"
              />
            </label>
            <label className="flex flex-col">
              <span className="text-xs text-gray-600">Time (24h)</span>
              <input
                type="time"
                value={scheduleTimeInput}
                onChange={(e) => setScheduleTimeInput(e.target.value)}
                className="w-28 rounded-md border border-gray-300 px-2 py-1.5 text-sm"
              />
            </label>
            <button
              type="button"
              onClick={() => void saveMonthlyUnloadSchedule()}
              disabled={isSavingSchedule}
              className="rounded-md bg-primary px-3 py-2 text-xs font-semibold text-white hover:bg-cyan-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSavingSchedule ? "Saving..." : "Save Schedule"}
            </button>
          </div>
        </div>
      </div>

      {/* --- Toolbar: full-width search + actions (sticky, hide-on-scroll on mobile) --- */}
      <div
        ref={toolbarRef}
        className={`sticky top-0 z-30 -mx-2 bg-gray-50 px-2 pb-3 pt-1 transition-transform duration-200 sm:static sm:mx-0 sm:bg-transparent sm:px-0 sm:pb-4 sm:pt-0 ${
          barsHidden ? "-translate-y-full sm:translate-y-0" : "translate-y-0"
        }`}
      >
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative w-full sm:flex-1">
            <input
              type="search"
              placeholder="Search cards..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-md border border-gray-300 bg-white pl-4 pr-10 py-2 text-sm placeholder-gray-400 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
            />
            {searchQuery ? (
              <button
                onClick={() => setSearchQuery("")}
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

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowFilterDropdown(true)}
              className={`flex flex-1 items-center justify-center gap-2 rounded-md border px-4 py-2 text-sm font-semibold transition-colors sm:flex-none ${
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

            {isViewOnly ? (
              <button
                type="button"
                disabled
                title={VIEW_ONLY_NEW_ALLOCATION_TIP}
                className="flex flex-1 items-center justify-center gap-2 rounded-md bg-gray-300 px-4 py-2 text-sm font-semibold text-white shadow-sm cursor-not-allowed sm:flex-none"
              >
                <Plus className="h-4 w-4" strokeWidth={3} />
                New Allocation
              </button>
            ) : (
              <Link
                href="/cards/new"
                className="flex flex-1 items-center justify-center gap-2 rounded-md bg-[#00BDD6] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-cyan-600 transition-colors sm:flex-none"
              >
                <Plus className="h-4 w-4" strokeWidth={3} />
                New Allocation
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* --- Table Wrapper --- */}
      <div className="hidden md:block overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-sm">
            <thead>
              {/* Header Row Color: Light Cyan/Blue from screenshot */}
              <tr className="bg-[#E0F7FA] border-b border-gray-200">
                {table.getFlatHeaders().map((header) => (
                  <th
                    key={header.id}
                    className="px-4 py-4 text-left align-middle"
                    style={{ width: columnWidths[header.id] ?? "auto" }}
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {rows.map((row, index) => (
                <tr
                  key={row.id}
                  // Zebra Striping: Even rows (index 1, 3...) are gray in standard CSS 0-index logic
                  // But visually row 1 is white, row 2 is gray.
                  className={`transition-colors hover:bg-blue-50/50 ${
                    index % 2 === 0 ? "bg-white" : "bg-gray-100"
                  }`}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td
                      key={cell.id}
                      className="px-4 py-3.5 align-top"
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))}
              {/* Fill empty space if needed */}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={columns.length} className="p-8 text-center text-gray-500">
                    No records found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* --- Mobile Card List (dense, read-only; tap a row to edit) --- */}
      <div className="md:hidden">
        {rows.length > 0 && (
          <p className="px-1 pb-2 text-xs text-gray-400">
            Tap a card to view details · edit status
          </p>
        )}
        <div className="space-y-2">
          {rows.length === 0 ? (
            <div className="rounded-lg border border-gray-200 bg-white p-8 text-center text-gray-500">
              No records found.
            </div>
          ) : (
            rows.map((row) => {
              const card = row.original;
              const isSelected = selectedCardId === card.id;
              return (
                <button
                  key={row.id}
                  onClick={() => setSelectedCardId(card.id)}
                  className={`flex w-full items-center gap-3 rounded-lg border px-4 py-3 text-left shadow-sm transition hover:bg-gray-50 active:scale-[0.99] active:bg-gray-100 ${
                    isSelected
                      ? "border-cyan-400 bg-cyan-50 ring-1 ring-cyan-300"
                      : "border-gray-200 bg-white"
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="min-w-0 flex-1 truncate font-semibold text-gray-900">
                        {card.passRecipient || "No recipient"}
                      </span>
                      <span
                        className={`w-24 shrink-0 rounded-full px-2 py-0.5 text-center text-xs font-semibold ${statusStyles[card.status]}`}
                      >
                        {card.status}
                      </span>
                    </div>
                    <p className="mt-0.5 truncate text-xs text-gray-500">
                      {card.department} · •••• {card.final7Digits || "—"} ·{" "}
                      {formatDate(card.allocationDate) || "—"}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-gray-300" />
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* --- Pagination Footer (sticky, hide-on-scroll on mobile) --- */}
      <div
        className={`sticky bottom-0 z-30 -mx-2 flex items-center justify-end gap-4 border-t border-gray-200 bg-gray-50 px-2 py-3 pr-2 transition-transform duration-200 sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:py-4 ${
          barsHidden ? "translate-y-full sm:translate-y-0" : "translate-y-0"
        }`}
      >
        <button
          onClick={() => table.previousPage()}
          disabled={!table.getCanPreviousPage()}
          className="flex h-8 w-8 items-center justify-center rounded-full bg-cyan-500 text-white hover:bg-cyan-600 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        
        <span className="text-sm font-medium text-gray-600">
          {filteredData.length === 0 ? "0" : `${start}-${end}`} of {filteredData.length}
          {filteredData.length !== data.length && (
            <span className="text-gray-400"> (filtered from {data.length})</span>
          )}
        </span>

        <button
          onClick={() => table.nextPage()}
          disabled={!table.getCanNextPage()}
          className="flex h-8 w-8 items-center justify-center rounded-full bg-cyan-500 text-white hover:bg-cyan-600 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>

      {/* --- Detail Sheet (mobile): the place to edit --- */}
      <Dialog
        open={selectedCard !== null}
        onClose={() => setSelectedCardId(null)}
        className="relative z-50 md:hidden"
      >
        <DialogBackdrop
          transition
          className="fixed inset-0 bg-black/30 transition-opacity duration-200 data-[closed]:opacity-0"
        />
        <div className="fixed inset-0 flex items-end justify-center">
          <DialogPanel
            transition
            className="w-full max-w-lg rounded-t-2xl bg-white p-5 shadow-xl transition duration-200 ease-out data-[closed]:translate-y-full"
          >
            {selectedCard && (
              <>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <DialogTitle className="truncate text-lg font-bold text-gray-900">
                      {selectedCard.passRecipient || "No recipient"}
                    </DialogTitle>
                    <p className="text-xs text-gray-500">
                      Allocated {formatDate(selectedCard.allocationDate) || "—"}
                    </p>
                  </div>
                  <button
                    onClick={() => setSelectedCardId(null)}
                    className="rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                  >
                    <X size={20} />
                  </button>
                </div>

                {/* Editable status — the edit lives here, not in the list */}
                <div className="mt-4">
                  <label className="text-xs font-medium text-gray-500">Status</label>
                  <div className="mt-1">
                    <StatusSelect
                      value={selectedCard.status}
                      onChange={(next) =>
                        void updateCardStatus(selectedCard.id, next)
                      }
                      className="w-full"
                      disabled={isViewOnly}
                      disabledReason={VIEW_ONLY_CARDS_TIP}
                    />
                  </div>
                </div>
                <div className="mt-3">
                  <button
                    type="button"
                    disabled={!selectedCard.currentUserId}
                    onClick={() =>
                      void forceUnassignCard(
                        selectedCard.id,
                        `${selectedCard.final7Digits || "Unknown"} (${selectedCard.passRecipient || "No recipient"})`,
                      )
                    }
                    className="w-full rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-100 disabled:cursor-not-allowed disabled:border-gray-200 disabled:bg-gray-100 disabled:text-gray-400"
                  >
                    Force Unassign User
                  </button>
                </div>

                <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
                  <dt className="text-gray-500">Department</dt>
                  <dd>
                    <Chip
                      label={selectedCard.department}
                      tone={deptStyles[selectedCard.department]}
                    />
                  </dd>
                  <dt className="text-gray-500">Card</dt>
                  <dd className="text-gray-700">
                    •••• {selectedCard.final7Digits || "—"}
                  </dd>
                  <dt className="text-gray-500">Security</dt>
                  <dd className="text-gray-700">
                    {selectedCard.securityCode || "—"}
                  </dd>
                  <dt className="text-gray-500">Allocation Date</dt>
                  <dd className="text-gray-700">
                    {formatDate(selectedCard.allocationDate) || "—"}
                  </dd>
                  <dt className="text-gray-500">Notes</dt>
                  <dd className="text-gray-500">{selectedCard.notes || "—"}</dd>
                </dl>
              </>
            )}
          </DialogPanel>
        </div>
      </Dialog>

      {/* --- Filter Drawer --- */}
      <Dialog
        open={showFilterDropdown}
        onClose={() => setShowFilterDropdown(false)}
        className="relative z-50"
      >
        <DialogBackdrop
          transition
          className="fixed inset-0 bg-black/30 transition-opacity duration-200 data-[closed]:opacity-0"
        />
        <div className="fixed inset-0 flex justify-end">
          <DialogPanel
            transition
            className="flex h-full w-full max-w-sm flex-col overflow-y-auto bg-white p-5 shadow-xl transition duration-200 ease-out data-[closed]:translate-x-full"
          >
            <div className="mb-4 flex items-center justify-between">
              <DialogTitle className="text-lg font-semibold text-gray-900">
                Filters
              </DialogTitle>
              <div className="flex items-center gap-3">
                {activeFilterCount > 0 && (
                  <button
                    onClick={clearAllFilters}
                    className="text-xs text-cyan-600 hover:text-cyan-700"
                  >
                    Clear all
                  </button>
                )}
                <button
                  onClick={() => setShowFilterDropdown(false)}
                  className="rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Status Filter */}
            <div className="mb-6">
              <h4 className="mb-2 text-sm font-medium text-gray-700">Status</h4>
              <div className="flex flex-wrap gap-2">
                {STATUS_OPTIONS.map((status) => (
                  <button
                    key={status}
                    onClick={() => toggleStatusFilter(status)}
                    className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                      statusFilters.includes(status)
                        ? STATUS_STYLES[status] + " ring-2 ring-offset-1 ring-cyan-500"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    {status}
                  </button>
                ))}
              </div>
            </div>

            {/* Department Filter */}
            <div>
              <h4 className="mb-2 text-sm font-medium text-gray-700">Department</h4>
              <div className="flex flex-wrap gap-2">
                {DEPARTMENT_OPTIONS.map((dept) => (
                  <button
                    key={dept}
                    onClick={() => toggleDepartmentFilter(dept)}
                    className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                      departmentFilters.includes(dept)
                        ? DEPARTMENT_STYLES[dept] + " ring-2 ring-offset-1 ring-cyan-500"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    {dept}
                  </button>
                ))}
              </div>
            </div>
          </DialogPanel>
        </div>
      </Dialog>
    </div>
  );
}