"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type CardStatus = "Unloaded" | "Active" | "Unattributed" | "Expired" | "Cancelled";
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

type DraftCard = {
  id: number;
  allocationDate: string;
  status: CardStatus;
  department: CardDepartment;
  final7Digits: string;
  securityCode: string;
};

const statusOptions: CardStatus[] = ["Unloaded", "Active", "Unattributed", "Expired", "Cancelled"];
const departmentOptions: CardDepartment[] = [
  "Mental Health",
  "Emergency",
  "Case MCT",
  "Newcomer Volunteer",
  "Reception",
  "Housing",
  "FEComm Bridge",
  "FASS",
  "Child Care",
  "Employment",
  "HELP Program",
];

const deptTone: Partial<Record<CardDepartment, string>> = {
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

function DeptPill({ value }: { value: CardDepartment }) {
  return (
    <span
      className={`inline-flex min-w-[140px] justify-center rounded-full px-3 py-1 text-sm font-semibold ${
        deptTone[value] ?? "bg-gray-100 text-gray-700"
      }`}
    >
      {value}
    </span>
  );
}

export default function NewAllocationPage() {
  const router = useRouter();
  const [rows, setRows] = useState<DraftCard[]>(() =>
    Array.from({ length: 8 }).map((_, idx) => ({
      id: idx + 1,
      allocationDate: "4/17/2024",
      status: "Unloaded",
      department: departmentOptions[idx % departmentOptions.length],
      final7Digits: "6879001",
      securityCode: "789",
    }))
  );

  const nextId = useMemo(() => rows.length + 1, [rows.length]);

  const updateRow = <K extends keyof DraftCard>(id: number, key: K, value: DraftCard[K]) => {
    setRows((prev) => prev.map((row) => (row.id === id ? { ...row, [key]: value } : row)));
  };

  const addRow = () => {
    setRows((prev) => [
      ...prev,
      {
        id: nextId,
        allocationDate: "4/17/2024",
        status: "Unloaded",
        department: "Mental Health",
        final7Digits: "",
        securityCode: "",
      },
    ]);
  };

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="text-primary text-sm font-medium hover:underline"
            onClick={() => router.back()}
          >
            ← New Allocation
          </button>
        </div>
        <button className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white shadow-md hover:bg-opacity-90">
          Submit →
        </button>
      </header>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr className="text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
              <th className="px-4 py-3">No.</th>
              <th className="px-4 py-3">Allocation Date</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Department</th>
              <th className="px-4 py-3">Final 7 Digits</th>
              <th className="px-4 py-3">Security Code</th>
            </tr>
          </thead>
          <tbody className="text-sm">
            {rows.map((row, index) => (
              <tr
                key={row.id}
                className={`${
                  index % 2 === 0 ? "bg-white" : "bg-gray-50"
                } hover:bg-gray-100 transition-colors`}
              >
                <td className="px-4 py-3 font-semibold text-gray-900">{row.id}</td>
                <td className="px-4 py-3 text-gray-700">{row.allocationDate}</td>
                <td className="px-4 py-3">
                  <select
                    className="w-32 rounded-full border border-gray-300 bg-gray-50 px-3 py-1 text-sm text-gray-800 focus:border-primary focus:outline-none"
                    value={row.status}
                    onChange={(e) => updateRow(row.id, "status", e.target.value as CardStatus)}
                  >
                    {statusOptions.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <DeptPill value={row.department} />
                    <select
                      className="rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700 focus:border-primary focus:outline-none"
                      value={row.department}
                      onChange={(e) =>
                        updateRow(row.id, "department", e.target.value as CardDepartment)
                      }
                    >
                      {departmentOptions.map((dept) => (
                        <option key={dept} value={dept}>
                          {dept}
                        </option>
                      ))}
                    </select>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={7}
                    className="w-28 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-900 focus:border-primary focus:outline-none"
                    value={row.final7Digits}
                    onChange={(e) => updateRow(row.id, "final7Digits", e.target.value)}
                  />
                </td>
                <td className="px-4 py-3">
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={3}
                    className="w-20 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 focus:border-primary focus:outline-none"
                    value={row.securityCode}
                    onChange={(e) => updateRow(row.id, "securityCode", e.target.value)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <button
        type="button"
        onClick={addRow}
        className="flex items-center gap-2 text-primary text-sm font-semibold hover:underline"
      >
        <span className="text-lg">+</span>
        Add Card
      </button>
    </div>
  );
}
