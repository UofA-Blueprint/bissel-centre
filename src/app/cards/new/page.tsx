"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CardStatus,
  CardDepartment,
  STATUS_OPTIONS,
  DEPARTMENT_OPTIONS,
  DEPARTMENT_STYLES,
} from "../types";

type DraftCard = {
  id: number;
  allocationDate: string;
  status: CardStatus;
  department: CardDepartment;
  final7Digits: string;
  securityCode: string;
};

function DeptPill({ value }: { value: CardDepartment }) {
  return (
    <span
      className={`inline-flex min-w-[140px] justify-center rounded-full px-3 py-1 text-sm font-semibold ${
        DEPARTMENT_STYLES[value] ?? "bg-gray-100 text-gray-700"
      }`}
    >
      {value}
    </span>
  );
}

export default function NewAllocationPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<DraftCard[]>([]);

  const nextId = useMemo(() => rows.length + 1, [rows.length]);

  const updateRow = <K extends keyof DraftCard>(id: number, key: K, value: DraftCard[K]) => {
    setRows((prev) => prev.map((row) => (row.id === id ? { ...row, [key]: value } : row)));
  };

  const addRow = () => {
    setRows((prev) => [
      ...prev,
      {
        id: nextId,
        allocationDate: new Date().toLocaleDateString("en-US"),
        status: "Unloaded",
        department: "Mental Health",
        final7Digits: "",
        securityCode: "",
      },
    ]);
  };

  const handleSubmit = async () => {
    // Validate that there are rows to submit
    if (rows.length === 0) {
      setError("Please add at least one card before submitting");
      return;
    }

    // Validate that all rows have required fields
    const invalidRows = rows.filter(
      (row) => !row.final7Digits || !row.securityCode
    );
    if (invalidRows.length > 0) {
      setError("Please fill in all required fields (Final 7 Digits and Security Code)");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const cardsToCreate = rows.map((row) => ({
        allocationDate: row.allocationDate,
        status: row.status,
        department: row.department,
        arcCardNumber: row.final7Digits,
        securityCode: row.securityCode,
        passRecipient: "",
        issueDates: [row.allocationDate],
        notes: "",
      }));

      const response = await fetch("/api/cards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cards: cardsToCreate }),
      });

      if (!response.ok) {
        throw new Error("Failed to create cards");
      }

      // Navigate back to cards list
      router.push("/cards");
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setSubmitting(false);
    }
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
        <button 
          onClick={handleSubmit}
          disabled={submitting}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white shadow-md hover:bg-opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? "Submitting..." : "Submit →"}
        </button>
      </header>

      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

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
                    {STATUS_OPTIONS.map((s) => (
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
                      {DEPARTMENT_OPTIONS.map((dept) => (
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
