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
import { ArrowLeft, ArrowRight, ChevronDown, ChevronUp, Filter, Plus, Search } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  CardStatus,
  CardDepartment,
  STATUS_STYLES,
  DEPARTMENT_STYLES,
} from "./types";

// --- Types ---

type CardRow = {
  id: string;
  allocationDate: string;
  status: CardStatus;
  department: CardDepartment;
  final7Digits: string;
  securityCode: string;
  passRecipient: string;
  issueDates: string[];
  notes: string;
};

// --- API Fetch Function ---

async function fetchCards(): Promise<CardRow[]> {
  const response = await fetch("/api/cards");
  if (!response.ok) {
    throw new Error("Failed to fetch cards");
  }
  const data = await response.json();
  return data.cards.map((card: {
    id: string;
    allocationDate: string;
    status: CardStatus;
    department: CardDepartment;
    arcCardNumber: string;
    securityCode: string;
    passRecipient: string;
    issueDates: string[];
    notes: string;
  }) => ({
    id: card.id,
    allocationDate: card.allocationDate,
    status: card.status,
    department: card.department,
    final7Digits: card.arcCardNumber,
    securityCode: card.securityCode,
    passRecipient: card.passRecipient,
    issueDates: card.issueDates,
    notes: card.notes,
  }));
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
  onClick?: () => void;
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

export default function CardsPage() {
  const [data, setData] = useState<CardRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [expandedDates, setExpandedDates] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetchCards()
      .then((cards) => {
        setData(cards);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

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
        accessorKey: "allocationDate",
        header: ({ column }) => (
          <SortableHeader
            label="Allocation Date"
            sorted={column.getIsSorted()}
            onClick={column.getToggleSortingHandler()}
          />
        ),
        cell: ({ getValue }) => <span className="text-gray-700">{getValue<string>()}</span>,
      },
      {
        accessorKey: "status",
        header: () => <span className="text-xs font-bold text-gray-900">Status</span>,
        cell: ({ getValue }) => {
          const value = getValue<CardStatus>();
          return <Chip label={value} tone={statusStyles[value]} />;
        },
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
        cell: ({ getValue }) => <span className="font-medium text-gray-900">{getValue<string>()}</span>,
      },
      {
        accessorKey: "issueDates",
        header: () => <span className="text-xs font-bold text-gray-900">Issue Dates</span>,
        cell: ({ getValue, row }) => {
          const dates = getValue<string[]>();
          const isExpanded = expandedDates[row.original.id];
          const toggle = () =>
            setExpandedDates((prev) => ({ ...prev, [row.original.id]: !isExpanded }));

          if (!dates || dates.length === 0) return <span className="text-gray-400"></span>;

          if (dates.length === 1) {
            return <span className="text-gray-700">{dates[0]}</span>;
          }

          if (isExpanded) {
            return (
              <button onClick={toggle} className="flex flex-col text-left text-gray-700">
                {dates.map((d) => (
                  <span key={d} className="block">{d}</span>
                ))}
                <span className="text-xs text-cyan-600 font-medium mt-1">Show less</span>
              </button>
            );
          }

          return (
            <div className="flex items-center gap-1 text-gray-700">
              <span>{dates[0]}</span>
              <button
                onClick={toggle}
                className="text-gray-500 hover:text-gray-700 text-sm font-medium whitespace-nowrap"
              >
                +{dates.length - 1} more
              </button>
            </div>
          );
        },
      },
      {
        accessorKey: "notes",
        header: () => <span className="text-xs font-bold text-gray-900">Notes</span>,
        cell: ({ getValue }) => <span className="text-gray-500">{getValue<string>()}</span>,
      },
    ],
    [expandedDates]
  );

  const table = useReactTable({
    data,
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
  const { pageIndex, pageSize } = table.getState().pagination;
  const start = pageIndex * pageSize + 1;
  const end = Math.min(start + rows.length - 1, data.length);
  
  // Hardcoded width based on the screenshot column distribution
  const columnWidths: Record<string, string> = {
    rowNumber: "60px",
    allocationDate: "130px",
    status: "130px",
    department: "180px",
    final7Digits: "120px",
    securityCode: "120px",
    passRecipient: "200px",
    issueDates: "180px",
    notes: "100px",
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
    <div className="space-y-4 p-6 bg-gray-50 font-sans">
      {/* --- Header Actions --- */}
      <header className="flex items-end justify-between pb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">ARC Card Master List</h1>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <input
              type="search"
              placeholder="Search cards..."
              className="w-64 rounded-md border border-gray-300 bg-white pl-4 pr-10 py-2 text-sm placeholder-gray-400 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
            />
            <button className="absolute right-1 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-white bg-cyan-400 hover:bg-cyan-500">
               <ArrowRight size={14} strokeWidth={3} />
            </button>
          </div>
          
          <button className="flex items-center gap-2 rounded-md border border-cyan-500 px-4 py-2 text-sm font-semibold text-cyan-600 hover:bg-cyan-50 transition-colors">
            <Filter className="h-4 w-4" />
            Filter
          </button>
          
          <Link
            href="/cards/new"
            className="flex items-center gap-2 rounded-md bg-[#00BDD6] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-cyan-600 transition-colors"
          >
            <Plus className="h-4 w-4" strokeWidth={3} />
            New Allocation
          </Link>
        </div>
      </header>

      {/* --- Table Wrapper --- */}
      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
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

      {/* --- Pagination Footer --- */}
      <div className="flex items-center justify-end gap-4 py-4 pr-2">
        <button
          onClick={() => table.previousPage()}
          disabled={!table.getCanPreviousPage()}
          className="flex h-8 w-8 items-center justify-center rounded-full bg-cyan-500 text-white hover:bg-cyan-600 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        
        <span className="text-sm font-medium text-gray-600">
          {start}-{end} of {data.length}
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