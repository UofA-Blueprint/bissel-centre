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
import { useEffect, useMemo, useRef, useState } from "react";

// --- Types ---

type CardStatus =
  | "Active"
  | "Unattributed"
  | "Expired"
  | "Unloaded"
  | "Cancelled";

type CardDepartment =
  | "Mental Health"
  | "Emergency"
  | "Case MCT"
  | "Newcomer Volunteer"
  | "Reception"
  | "Housing"
  | "FE/Comm Bridge"
  | "FASS"
  | "Child Care"
  | "Employment"
  | "HELP Program";

type CardRow = {
  id: number;
  allocationDate: string;
  status: CardStatus;
  department: CardDepartment;
  final7Digits: string;
  securityCode: string;
  passRecipient: string;
  issueDates: string[];
  notes: string;
};

// --- Data ---

const sampleRows: CardRow[] = [
  {
    id: 1,
    allocationDate: "4/17/2024",
    status: "Active",
    department: "Mental Health",
    final7Digits: "6879001",
    securityCode: "789",
    passRecipient: "Ervin Badam",
    issueDates: ["4/17/2024"],
    notes: "Notes",
  },
  {
    id: 2,
    allocationDate: "4/17/2024",
    status: "Unattributed",
    department: "Emergency",
    final7Digits: "6879001",
    securityCode: "789",
    passRecipient: "Gerald Maryniak",
    issueDates: ["4/17/2024", "4/10/2024"],
    notes: "Notes",
  },
  {
    id: 3,
    allocationDate: "4/17/2024",
    status: "Expired",
    department: "Case MCT",
    final7Digits: "6879001",
    securityCode: "789",
    passRecipient: "Shayla Daniels-Lewis",
    issueDates: ["4/17/2024", "4/10/2024", "4/01/2024", "3/25/2024", "3/18/2024", "3/11/2024"],
    notes: "Notes",
  },
  {
    id: 4,
    allocationDate: "4/17/2024",
    status: "Unloaded",
    department: "Newcomer Volunteer",
    final7Digits: "6879001",
    securityCode: "789",
    passRecipient: "",
    issueDates: [],
    notes: "",
  },
  {
    id: 5,
    allocationDate: "4/17/2024",
    status: "Active",
    department: "Reception",
    final7Digits: "6879001",
    securityCode: "789",
    passRecipient: "Tayna Dequaine",
    issueDates: ["4/17/2024"],
    notes: "Notes",
  },
  {
    id: 6,
    allocationDate: "4/17/2024",
    status: "Active",
    department: "Housing",
    final7Digits: "6879001",
    securityCode: "789",
    passRecipient: "Augustine Tourangeau",
    issueDates: ["4/17/2024", "4/10/2024", "4/03/2024", "3/20/2024"],
    notes: "Notes",
  },
  {
    id: 7,
    allocationDate: "4/17/2024",
    status: "Active",
    department: "FE/Comm Bridge",
    final7Digits: "6879001",
    securityCode: "789",
    passRecipient: "Unknown",
    issueDates: ["4/17/2024", "4/10/2024", "4/03/2024", "3/20/2024", "3/10/2024", "3/01/2024", "2/20/2024", "2/10/2024", "2/01/2024", "1/20/2024", "1/10/2024", "1/01/2024"],
    notes: "Notes",
  },
  {
    id: 8,
    allocationDate: "4/17/2024",
    status: "Unattributed",
    department: "FASS",
    final7Digits: "6879001",
    securityCode: "789",
    passRecipient: "Trevor Kootenay",
    issueDates: ["4/17/2024"],
    notes: "Notes",
  },
  {
    id: 9,
    allocationDate: "4/17/2024",
    status: "Expired",
    department: "Child Care",
    final7Digits: "6879001",
    securityCode: "789",
    passRecipient: "Anthony Gordon Cardinal",
    issueDates: ["4/17/2024", "4/10/2024"],
    notes: "Notes",
  },
  {
    id: 10,
    allocationDate: "4/17/2024",
    status: "Unattributed",
    department: "Employment",
    final7Digits: "6879001",
    securityCode: "789",
    passRecipient: "Rehema Mutsei",
    issueDates: ["4/17/2024", "4/10/2024", "4/01/2024", "3/25/2024", "3/18/2024", "3/11/2024", "3/04/2024", "2/26/2024", "2/19/2024", "2/12/2024"],
    notes: "Notes",
  },
  {
    id: 11,
    allocationDate: "4/17/2024",
    status: "Active",
    department: "HELP Program",
    final7Digits: "6879001",
    securityCode: "789",
    passRecipient: "Ken Toma",
    issueDates: ["4/17/2024"],
    notes: "",
  },
  {
    id: 12,
    allocationDate: "4/17/2024",
    status: "Expired",
    department: "Emergency",
    final7Digits: "6879001",
    securityCode: "789",
    passRecipient: "Jason Holman",
    issueDates: ["4/17/2024", "4/10/2024", "4/01/2024"],
    notes: "Notes",
  },
];

// --- Styles ---

const statusStyles: Record<CardStatus, string> = {
  Active: "bg-green-100 text-green-700",
  Unattributed: "bg-yellow-100 text-yellow-800",
  Expired: "bg-red-100 text-red-700",
  Unloaded: "bg-gray-200 text-gray-700",
  Cancelled: "bg-red-100 text-red-700",
};

const deptStyles: Record<CardDepartment, string> = {
  "Mental Health": "bg-green-100 text-green-800",
  Emergency: "bg-red-100 text-red-800",
  "Case MCT": "bg-sky-100 text-sky-800",
  "Newcomer Volunteer": "bg-purple-100 text-purple-800",
  Reception: "bg-pink-100 text-pink-800",
  Housing: "bg-orange-100 text-orange-800",
  "FE/Comm Bridge": "bg-teal-100 text-teal-800",
  FASS: "bg-fuchsia-100 text-fuchsia-800",
  "Child Care": "bg-yellow-100 text-yellow-800",
  Employment: "bg-gray-200 text-gray-700",
  "HELP Program": "bg-gray-800 text-white", // Dark pill as seen in Row 11
};

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
  const [data] = useState<CardRow[]>(sampleRows);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [expandedDates, setExpandedDates] = useState<Record<number, boolean>>({});

  // Column Definitions
  const columns = useMemo<ColumnDef<CardRow>[]>(
    () => [
      {
        accessorKey: "id",
        header: ({ column }) => (
          <SortableHeader
            label="No."
            sorted={column.getIsSorted()}
            onClick={column.getToggleSortingHandler()}
          />
        ),
        cell: ({ getValue }) => (
          <span className="text-gray-500 font-medium pl-2">{getValue<number>()}</span>
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
    id: "60px",
    allocationDate: "130px",
    status: "130px",
    department: "180px",
    final7Digits: "120px",
    securityCode: "120px",
    passRecipient: "200px",
    issueDates: "180px",
    notes: "100px",
  };

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
          
          <button className="flex items-center gap-2 rounded-md bg-[#00BDD6] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-cyan-600 transition-colors">
            <Plus className="h-4 w-4" strokeWidth={3} />
            New Allocation
          </button>
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
          {start}-{end} of 1238
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