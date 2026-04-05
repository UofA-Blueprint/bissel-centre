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
  Download,
  Filter,
  Search,
  ShieldAlert,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type {
  UserReportRow,
  CardHistoryEntry,
  ActivityEntry,
} from "./types";
import { STATUS_OPTIONS, DEPARTMENT_OPTIONS } from "@/app/cards/types";
import type { CardStatus, CardDepartment } from "@/app/cards/types";

// --- API ---

async function fetchReportData(): Promise<UserReportRow[]> {
  const res = await fetch("/api/reports/data");
  if (!res.ok) throw new Error("Failed to fetch report data");
  const json = await res.json();
  return json.users;
}

// --- Helpers ---

function formatDate(dateStr: string): string {
  if (!dateStr) return "—";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

function formatDateTime(dateStr: string): string {
  if (!dateStr) return "—";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return dateStr;
  }
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
      className="group flex items-center gap-1 text-left text-xs font-bold text-gray-900 hover:text-black"
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

function FlagBadge({ banned, bannedAt }: { banned: boolean; bannedAt: string | null }) {
  if (!banned) return <span className="text-green-600 text-xs font-medium">No</span>;
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-bold text-red-700">
      <ShieldAlert className="h-3 w-3" />
      Flagged
      {bannedAt && (
        <span className="font-normal text-red-500 ml-0.5">
          ({formatDate(bannedAt)})
        </span>
      )}
    </span>
  );
}

function StatusChip({ status }: { status: string }) {
  const styles: Record<string, string> = {
    Active: "bg-green-100 text-green-700",
    Inactive: "bg-gray-200 text-gray-600",
    Unknown: "bg-yellow-100 text-yellow-700",
  };
  return (
    <span
      className={`inline-flex items-center justify-center rounded-full px-3 py-1 text-xs font-bold shadow-sm min-w-[70px] text-center ${styles[status] || styles.Unknown}`}
    >
      {status}
    </span>
  );
}

function CardStatusChip({ status }: { status: string }) {
  const styles: Record<string, string> = {
    Active: "bg-green-100 text-green-700",
    Unattributed: "bg-yellow-100 text-yellow-800",
    Expired: "bg-red-100 text-red-700",
    Unloaded: "bg-gray-200 text-gray-700",
    Cancelled: "bg-red-100 text-red-700",
  };
  return (
    <span
      className={`inline-flex items-center justify-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${styles[status] || "bg-gray-100 text-gray-600"}`}
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
        <tr className="bg-cyan-50 text-left">
          <th className="px-3 py-2 font-semibold text-gray-700">Card #</th>
          <th className="px-3 py-2 font-semibold text-gray-700">Department</th>
          <th className="px-3 py-2 font-semibold text-gray-700">Status</th>
          <th className="px-3 py-2 font-semibold text-gray-700">Allocated</th>
          <th className="px-3 py-2 font-semibold text-gray-700">Issue Dates</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-100">
        {cards.map((card, idx) => (
          <tr key={idx} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}>
            <td className="px-3 py-2 font-mono text-gray-800">{card.cardNumber || "—"}</td>
            <td className="px-3 py-2 text-gray-600">{card.department}</td>
            <td className="px-3 py-2">
              <CardStatusChip status={card.status} />
            </td>
            <td className="px-3 py-2 text-gray-600">{card.allocationDate || "—"}</td>
            <td className="px-3 py-2 text-gray-600">
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
    return <p className="text-gray-400 text-xs italic py-2">No activity history</p>;
  }
  return (
    <table className="w-full text-xs border-collapse">
      <thead>
        <tr className="bg-amber-50 text-left">
          <th className="px-3 py-2 font-semibold text-gray-700">Date</th>
          <th className="px-3 py-2 font-semibold text-gray-700">Event</th>
          <th className="px-3 py-2 font-semibold text-gray-700">Details</th>
          <th className="px-3 py-2 font-semibold text-gray-700">Modified By</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-100">
        {entries.map((entry, idx) => (
          <tr key={idx} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}>
            <td className="px-3 py-2 text-gray-600 whitespace-nowrap">
              {formatDateTime(entry.date)}
            </td>
            <td className="px-3 py-2">
              <EventBadge event={entry.event} />
            </td>
            <td className="px-3 py-2 text-gray-600">
              {entry.notes}
              {entry.reason && (
                <span className="ml-1 text-orange-600 italic">({entry.reason})</span>
              )}
            </td>
            <td className="px-3 py-2 text-gray-500">{entry.modifiedBy || "—"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function EventBadge({ event }: { event: string }) {
  const styles: Record<string, string> = {
    Ban: "bg-red-100 text-red-700",
    Unban: "bg-green-100 text-green-700",
    Override: "bg-orange-100 text-orange-700",
    "Issue Card": "bg-blue-100 text-blue-700",
    "Renew Card": "bg-cyan-100 text-cyan-700",
    "Status Change": "bg-purple-100 text-purple-700",
  };
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${styles[event] || "bg-gray-100 text-gray-600"}`}
    >
      {event}
    </span>
  );
}

// --- Expanded Row Content ---

function ExpandedRowContent({ row }: { row: Row<UserReportRow> }) {
  const user = row.original;
  const [activeTab, setActiveTab] = useState<"cards" | "activity">("cards");

  return (
    <div className="bg-slate-50 border-t border-b border-gray-200">
      <div className="px-6 py-4 space-y-4">
        {/* User detail summary strip */}
        <div className="flex flex-wrap gap-x-8 gap-y-2 text-sm">
          <div>
            <span className="text-gray-500">Gender:</span>{" "}
            <span className="font-medium text-gray-800">{user.genderIdentity || "—"}</span>
          </div>
          <div>
            <span className="text-gray-500">DOB:</span>{" "}
            <span className="font-medium text-gray-800">{user.dateOfBirth || "—"}</span>
          </div>
          <div>
            <span className="text-gray-500">Address:</span>{" "}
            <span className="font-medium text-gray-800">
              {user.address ? `${user.address}, ${user.postalCode}` : "—"}
            </span>
          </div>
          <div>
            <span className="text-gray-500">Registered:</span>{" "}
            <span className="font-medium text-gray-800">{formatDate(user.createdAt)}</span>
          </div>
          {user.notes && (
            <div>
              <span className="text-gray-500">Notes:</span>{" "}
              <span className="font-medium text-gray-800">{user.notes}</span>
            </div>
          )}
          {user.banned && user.banReason && (
            <div>
              <span className="text-gray-500">Flag Reason:</span>{" "}
              <span className="font-medium text-red-700">{user.banReason}</span>
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-gray-200">
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
  const [data, setData] = useState<UserReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sorting, setSorting] = useState<SortingState>([]);

  // Search / filter
  const [searchQuery, setSearchQuery] = useState("");
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [flagFilter, setFlagFilter] = useState<"all" | "flagged" | "not_flagged">("all");
  const [statusFilter, setStatusFilter] = useState<("Active" | "Inactive")[]>([]);
  const filterRef = useRef<HTMLDivElement>(null);

  // Export state
  const [exporting, setExporting] = useState(false);
  const [exportStartDate, setExportStartDate] = useState(() => {
    const d = new Date(Date.now() - 30 * 86400000);
    return d.toISOString().split("T")[0];
  });
  const [exportEndDate, setExportEndDate] = useState(() => {
    return new Date().toISOString().split("T")[0];
  });
  const [showExportPanel, setShowExportPanel] = useState(false);
  const [exportStatuses, setExportStatuses] = useState<CardStatus[]>([]);
  const [exportDepartments, setExportDepartments] = useState<CardDepartment[]>([]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (filterRef.current && !filterRef.current.contains(event.target as Node)) {
        setShowFilterDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    fetchReportData()
      .then((users) => {
        setData(users);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  const filteredData = useMemo(() => {
    let result = data;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (u) =>
          u.firstName.toLowerCase().includes(q) ||
          u.lastName.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q) ||
          u.phoneNumber.toLowerCase().includes(q) ||
          `${u.firstName} ${u.lastName}`.toLowerCase().includes(q)
      );
    }

    if (flagFilter === "flagged") {
      result = result.filter((u) => u.banned);
    } else if (flagFilter === "not_flagged") {
      result = result.filter((u) => !u.banned);
    }

    if (statusFilter.length > 0) {
      result = result.filter((u) => statusFilter.includes(u.status as "Active" | "Inactive"));
    }

    return result;
  }, [data, searchQuery, flagFilter, statusFilter]);

  const activeFilterCount =
    (flagFilter !== "all" ? 1 : 0) + statusFilter.length;

  const clearAllFilters = () => {
    setFlagFilter("all");
    setStatusFilter([]);
    setSearchQuery("");
  };

  const toggleStatusFilter = (s: "Active" | "Inactive") => {
    setStatusFilter((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]
    );
  };

  // Export handler
  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await fetch("/api/reports/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startDate: exportStartDate,
          endDate: exportEndDate,
          filters: {
            ...(exportStatuses.length && { statuses: exportStatuses }),
            ...(exportDepartments.length && { departments: exportDepartments }),
          },
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "Export failed");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `arc-cards-export-${exportStartDate}-to-${exportEndDate}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Export failed");
    } finally {
      setExporting(false);
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
              <ChevronDown className="h-4 w-4 text-gray-600" />
            ) : (
              <ChevronRight className="h-4 w-4 text-gray-400" />
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
          <span className="text-gray-500 font-medium">{row.index + 1}</span>
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
          <span className="font-medium text-gray-900">{getValue<string>()}</span>
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
          <span className="font-medium text-gray-900">{getValue<string>()}</span>
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
          <span className="text-gray-600 text-xs">{getValue<string>() || "—"}</span>
        ),
      },
      {
        accessorKey: "phoneNumber",
        header: () => (
          <span className="text-xs font-bold text-gray-900">Phone</span>
        ),
        cell: ({ getValue }) => (
          <span className="text-gray-600">{getValue<string>() || "—"}</span>
        ),
      },
      {
        accessorKey: "status",
        header: () => (
          <span className="text-xs font-bold text-gray-900">Status</span>
        ),
        cell: ({ getValue }) => <StatusChip status={getValue<string>()} />,
      },
      {
        accessorKey: "banned",
        header: ({ column }) => (
          <SortableHeader
            label="Flagged"
            sorted={column.getIsSorted()}
            onClick={column.getToggleSortingHandler()}
          />
        ),
        cell: ({ row }) => (
          <FlagBadge banned={row.original.banned} bannedAt={row.original.bannedAt} />
        ),
        sortingFn: (rowA, rowB) => {
          const a = rowA.original.banned ? 1 : 0;
          const b = rowB.original.banned ? 1 : 0;
          return a - b;
        },
      },
      {
        accessorKey: "totalCardsIssued",
        header: ({ column }) => (
          <SortableHeader
            label="Cards"
            sorted={column.getIsSorted()}
            onClick={column.getToggleSortingHandler()}
          />
        ),
        cell: ({ getValue }) => {
          const count = getValue<number>();
          return (
            <span
              className={`inline-flex items-center justify-center rounded-full px-2.5 py-0.5 text-xs font-bold ${
                count > 0 ? "bg-cyan-100 text-cyan-700" : "bg-gray-100 text-gray-500"
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
          <span className="text-xs font-bold text-gray-900">History</span>
        ),
        cell: ({ row }) => {
          const count = row.original.activityHistory.length;
          return (
            <span className="text-gray-500 text-xs">
              {count} event{count !== 1 ? "s" : ""}
            </span>
          );
        },
        size: 80,
      },
    ],
    []
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
    banned: "140px",
    totalCardsIssued: "70px",
    activityCount: "80px",
  };

  // Summary stats
  const totalUsers = filteredData.length;
  const flaggedCount = filteredData.filter((u) => u.banned).length;
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
    <div className="space-y-4 p-6 bg-gray-50 font-sans">
      {/* Header */}
      <header className="flex items-end justify-between pb-2">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">User Reports</h1>
          <p className="text-sm text-gray-500 mt-1">
            Comprehensive view of all recipients — card history, flags, and activity
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Search */}
          <div className="relative">
            <input
              type="search"
              placeholder="Search by name, email, phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-72 rounded-md border border-gray-300 bg-white pl-4 pr-10 py-2 text-sm placeholder-gray-400 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
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
              <div className="absolute right-0 top-full mt-2 w-72 rounded-lg border border-gray-200 bg-white shadow-lg z-50">
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

                  {/* Flagged filter */}
                  <div className="mb-4">
                    <h4 className="text-sm font-medium text-gray-700 mb-2">
                      Flagged Status
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {(["all", "flagged", "not_flagged"] as const).map((opt) => (
                        <button
                          key={opt}
                          onClick={() => setFlagFilter(opt)}
                          className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                            flagFilter === opt
                              ? opt === "flagged"
                                ? "bg-red-100 text-red-700 ring-2 ring-offset-1 ring-cyan-500"
                                : "bg-cyan-100 text-cyan-700 ring-2 ring-offset-1 ring-cyan-500"
                              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                          }`}
                        >
                          {opt === "all"
                            ? "All"
                            : opt === "flagged"
                              ? "Flagged"
                              : "Not Flagged"}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Account Status filter */}
                  <div>
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
                </div>
              </div>
            )}
          </div>

          {/* Export toggle */}
          <button
            onClick={() => setShowExportPanel(!showExportPanel)}
            className="flex items-center gap-2 rounded-md bg-[#00BDD6] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-cyan-600 transition-colors"
          >
            <Download className="h-4 w-4" />
            Export
          </button>
        </div>
      </header>

      {/* Export Panel */}
      {showExportPanel && (
        <div className="rounded-lg border border-gray-200 bg-white shadow-sm p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-900">Export ARC Card Data (.xlsx)</h3>
            <button
              onClick={() => setShowExportPanel(false)}
              className="text-gray-400 hover:text-gray-600"
            >
              <X size={18} />
            </button>
          </div>
          <div className="flex flex-wrap gap-4 items-end">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Start Date
              </label>
              <input
                type="date"
                value={exportStartDate}
                onChange={(e) => setExportStartDate(e.target.value)}
                className="border border-gray-300 rounded-md px-3 py-1.5 text-sm"
              />
            </div>
            <span className="text-gray-400 pb-1.5">to</span>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                End Date
              </label>
              <input
                type="date"
                value={exportEndDate}
                onChange={(e) => setExportEndDate(e.target.value)}
                className="border border-gray-300 rounded-md px-3 py-1.5 text-sm"
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-6">
            <div>
              <p className="text-xs font-medium text-gray-600 mb-1.5">Card Status</p>
              <div className="flex flex-wrap gap-1.5">
                {STATUS_OPTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() =>
                      setExportStatuses((prev) =>
                        prev.includes(s)
                          ? prev.filter((x) => x !== s)
                          : [...prev, s]
                      )
                    }
                    className={`px-2.5 py-1 rounded-full text-xs border ${
                      exportStatuses.includes(s)
                        ? "bg-cyan-500 text-white border-cyan-500"
                        : "bg-white text-gray-600 border-gray-300 hover:border-gray-400"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-600 mb-1.5">Department</p>
              <div className="flex flex-wrap gap-1.5">
                {DEPARTMENT_OPTIONS.map((d) => (
                  <button
                    key={d}
                    onClick={() =>
                      setExportDepartments((prev) =>
                        prev.includes(d)
                          ? prev.filter((x) => x !== d)
                          : [...prev, d]
                      )
                    }
                    className={`px-2.5 py-1 rounded-full text-xs border ${
                      exportDepartments.includes(d)
                        ? "bg-cyan-500 text-white border-cyan-500"
                        : "bg-white text-gray-600 border-gray-300 hover:border-gray-400"
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <button
            onClick={handleExport}
            disabled={exporting}
            className="bg-[#00BDD6] text-white px-5 py-2 rounded-md text-sm font-medium hover:bg-cyan-600 disabled:opacity-50"
          >
            {exporting ? "Exporting..." : "Download Export"}
          </button>
        </div>
      )}

      {/* Summary stats bar */}
      <div className="flex gap-4">
        <div className="flex-1 rounded-lg border border-gray-200 bg-white px-4 py-3 flex items-center gap-3">
          <div className="h-9 w-9 rounded-full bg-cyan-100 flex items-center justify-center">
            <span className="text-cyan-700 font-bold text-sm">{totalUsers}</span>
          </div>
          <div>
            <p className="text-xs text-gray-500">Total Recipients</p>
            <p className="text-sm font-semibold text-gray-800">
              {filteredData.length !== data.length
                ? `${totalUsers} of ${data.length}`
                : `${totalUsers}`}
            </p>
          </div>
        </div>
        <div className="flex-1 rounded-lg border border-gray-200 bg-white px-4 py-3 flex items-center gap-3">
          <div className="h-9 w-9 rounded-full bg-red-100 flex items-center justify-center">
            <ShieldAlert className="h-4 w-4 text-red-600" />
          </div>
          <div>
            <p className="text-xs text-gray-500">Flagged Users</p>
            <p className="text-sm font-semibold text-gray-800">{flaggedCount}</p>
          </div>
        </div>
        <div className="flex-1 rounded-lg border border-gray-200 bg-white px-4 py-3 flex items-center gap-3">
          <div className="h-9 w-9 rounded-full bg-blue-100 flex items-center justify-center">
            <span className="text-blue-700 font-bold text-sm">{totalCards}</span>
          </div>
          <div>
            <p className="text-xs text-gray-500">Total Cards Issued</p>
            <p className="text-sm font-semibold text-gray-800">{totalCards}</p>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-sm">
            <thead>
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
                <>
                  <tr
                    key={row.id}
                    className={`transition-colors hover:bg-blue-50/50 cursor-pointer ${
                      row.getIsExpanded()
                        ? "bg-cyan-50/40"
                        : index % 2 === 0
                          ? "bg-white"
                          : "bg-gray-50"
                    }`}
                    onClick={row.getToggleExpandedHandler()}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="px-4 py-3.5 align-top">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                  {row.getIsExpanded() && (
                    <tr key={`${row.id}-expanded`}>
                      <td colSpan={columns.length} className="p-0">
                        <ExpandedRowContent row={row} />
                      </td>
                    </tr>
                  )}
                </>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={columns.length} className="p-8 text-center text-gray-500">
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
    </div>
  );
}
