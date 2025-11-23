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
import { useEffect, useMemo, useRef, useState } from "react";

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
  | "FEComm Bridge"
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
    issueDates: ["4/17/2024", "4/10/2024", "4/01/2024", "3/25/2024", "3/18/2024", "3/11/2024"],
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
    issueDates: ["4/17/2024", "4/10/2024"],
    notes: "Notes",
  },
  {
    id: 4,
    allocationDate: "4/17/2024",
    status: "Unloaded",
    department: "Newcomer Volunteer",
    final7Digits: "6879001",
    securityCode: "789",
    passRecipient: "Unknown",
    issueDates: ["4/17/2024"],
    notes: "Notes",
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
    issueDates: ["4/17/2024"],
    notes: "Notes",
  },
  {
    id: 7,
    allocationDate: "4/17/2024",
    status: "Active",
    department: "FEComm Bridge",
    final7Digits: "6879001",
    securityCode: "789",
    passRecipient: "Unknown",
    issueDates: ["4/17/2024"],
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
    status: "Unattributed",
    department: "Child Care",
    final7Digits: "6879001",
    securityCode: "789",
    passRecipient: "Anthony Gordon Cardinal",
    issueDates: ["4/17/2024"],
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
    issueDates: ["4/17/2024"],
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
    notes: "Notes",
  },
  {
    id: 12,
    allocationDate: "4/17/2024",
    status: "Cancelled",
    department: "Emergency",
    final7Digits: "6879001",
    securityCode: "789",
    passRecipient: "Jason Holman",
    issueDates: ["4/17/2024"],
    notes: "Notes",
  },
];

const statusStyles: Record<CardStatus, string> = {
  Active: "bg-green-100 text-green-700",
  Unattributed: "bg-yellow-100 text-yellow-700",
  Expired: "bg-red-100 text-red-700",
  Unloaded: "bg-gray-100 text-gray-700",
  Cancelled: "bg-red-100 text-red-700",
};

const deptStyles: Partial<Record<CardDepartment, string>> = {
  "Mental Health": "bg-green-100 text-green-700",
  Emergency: "bg-red-100 text-red-700",
  "Case MCT": "bg-teal-100 text-teal-700",
  "Newcomer Volunteer": "bg-violet-100 text-violet-700",
  Reception: "bg-rose-100 text-rose-700",
  Housing: "bg-orange-100 text-orange-700",
  "FEComm Bridge": "bg-sky-100 text-sky-700",
  FASS: "bg-pink-100 text-pink-700",
  "Child Care": "bg-amber-100 text-amber-700",
  Employment: "bg-blue-100 text-blue-700",
  "HELP Program": "bg-gray-100 text-gray-700",
};

function Chip({ label, tone }: { label: string; tone?: string }) {
  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-sm font-medium ${tone ?? "bg-gray-100 text-gray-700"}  cursor-default `}
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
  const indicator = sorted === "asc" ? "↑" : sorted === "desc" ? "↓" : "";
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 hover:text-gray-700"
    >
      {label}
      {indicator && <span>{indicator}</span>}
    </button>
  );
}

export default function CardsPage() {
  const [data] = useState<CardRow[]>(sampleRows);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [expandedDates, setExpandedDates] = useState<Record<number, boolean>>({});

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
          <span className="font-semibold text-gray-900">{getValue<number>()}</span>
        ),
        size: 60,
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
        header: () => <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Status</span>,
        cell: ({ getValue }) => {
          const value = getValue<CardStatus>();
          return <Chip label={value} tone={statusStyles[value]} />;
        },
      },
      {
        accessorKey: "department",
        header: () => <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Department</span>,
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
          <span className="font-semibold text-gray-900">{getValue<string>()}</span>
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
        header: () => (
          <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            Pass Recipient
          </span>
        ),
        cell: ({ getValue }) => <span className="text-gray-700">{getValue<string>()}</span>,
      },
      {
        accessorKey: "issueDates",
        header: () => (
          <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            Issue Dates
          </span>
        ),
        cell: ({ getValue, row }) => {
          const dates = getValue<string[]>();
          const isExpanded = expandedDates[row.original.id];
          const toggle = () =>
            setExpandedDates((prev) => ({ ...prev, [row.original.id]: !isExpanded }));

          if (!dates?.length) {
            return <span className="text-gray-500">—</span>;
          }

          if (dates.length === 1) {
            return <span className="text-gray-700 cursor-pointer">{dates[0]}</span>;
          }

          if (isExpanded) {
            return (
              <button
                type="button"
                onClick={toggle}
                className="flex w-full flex-col gap-1 text-left text-gray-700 hover:text-gray-900"
              >
                {dates.map((d) => (
                  <span key={d}>{d}</span>
                ))}
                <span className="text-xs font-bold">Show less</span>
              </button>
            );
          }

          const [first, ...rest] = dates;
          const remainingCount = rest.length;

          return (
            <button
              type="button"
              onClick={toggle}
              className="flex w-full items-center gap-2 text-left text-gray-700 hover:text-gray-900 hover:underline"
            >
              <span>{first}...</span>
              <span className="text-xs font-bold">
                +{remainingCount} more
              </span>
            </button>
          );
        },
      },
      {
        accessorKey: "notes",
        header: () => (
          <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Notes</span>
        ),
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
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showFade, setShowFade] = useState(false);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const update = () => {
      const hasOverflow = el.scrollHeight > el.clientHeight + 2;
      const notAtBottom = el.scrollTop + el.clientHeight < el.scrollHeight - 2;
      setShowFade(hasOverflow && notAtBottom);
    };
    update();
    el.addEventListener("scroll", update);
    return () => el.removeEventListener("scroll", update);
  }, [rows]);
  const columnWidths: Record<string, string> = {
    id: "64px",
    allocationDate: "140px",
    status: "140px",
    department: "200px",
    final7Digits: "140px",
    securityCode: "120px",
    passRecipient: "200px",
    issueDates: "180px",
    notes: "160px",
  };

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">ARC Card Master List</h1>
          <p className="text-sm text-gray-500">Track allocation and status for ARC cards.</p>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="search"
            placeholder="Search cards..."
            className="w-56 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none"
          />
          <button className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100">
            Filter
          </button>
          <button className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white shadow-md hover:bg-opacity-90">
            New Allocation
          </button>
        </div>
      </header>

      <div className="relative overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div ref={scrollRef} className="max-h-[85vh] min-h-[70vh] overflow-auto pr-2">
          <table className="min-w-full table-fixed border-separate border-spacing-y-3">
            <thead className="bg-sky-100">
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <th
                      key={header.id}
                      className="px-4 py-3 text-gray-700"
                      style={{ width: columnWidths[header.column.id] ?? "auto" }}
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody className="text-sm">
              {rows.map((row, index) => (
                <tr
                  key={row.id}
                  className={`hover:bg-gray-100 transition-colors shadow-sm rounded-2xl border border-gray-200`}
                  style={{ backgroundColor: index % 2 === 0 ? "#ffffff" : "#E4E4E4" }}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td
                      key={cell.id}
                      className="px-4 py-3"
                      style={{ width: columnWidths[cell.column.id] ?? "auto" }}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {showFade && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-white via-white/80 to-white/0" />
        )}
      </div>

      <div className="fixed inset-x-0 bottom-0 z-20 flex justify-center px-4 w-full">
        <div className="flex items-center gap-3 rounded-full border border-gray-300 bg-white/90 px-4 py-2 text-sm text-gray-700 shadow-lg backdrop-blur w-full">
          <div className="flex items-center gap-2 justify-center w-full">
            <button
              className="rounded border border-gray-300 px-10 py-1 hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              Prev
            </button>
            <span className="font-semibold text-gray-800">
              {start}–{end} of {data.length}
            </span>
            <button
              className="rounded border border-gray-300 px-10 py-1 hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
