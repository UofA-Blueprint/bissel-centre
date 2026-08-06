"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import BackNavigation from "@/app/components/BackNavigation";
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

type PendingStatusChange = {
  rowId: number;
  nextStatus: CardStatus;
};

const STATUS_WARNING_PREF_KEY = "arc_card_new_status_warning_hide_v1";
const EDMONTON_TIMEZONE = "America/Edmonton";

const STATUS_MEANINGS: Record<CardStatus, string> = {
  Active: "Card is being used by someone.",
  Unattributed: "Card is ready to be issued and not currently assigned.",
  Unloaded: "Card is created but not loaded with money yet.",
  Expired: "Card is no longer valid.",
  Cancelled: "Card has been cancelled and should not be used.",
};

function getEdmontonTodayDateString(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: EDMONTON_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  if (!year || !month || !day) return "";
  return `${year}-${month}-${day}`;
}



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

  const [statusWarningOpen, setStatusWarningOpen] = useState(false);
  const [pendingStatusChange, setPendingStatusChange] = useState<PendingStatusChange | null>(null);
  const [dontShowStatusWarningAgain, setDontShowStatusWarningAgain] =
    useState(false);

  const nextId = useMemo(() => rows.length + 1, [rows.length]);

  const updateRow = <K extends keyof DraftCard>(id: number, key: K, value: DraftCard[K]) => {
    setRows((prev) => prev.map((row) => (row.id === id ? { ...row, [key]: value } : row)));
  };

  const addRow = () => {
    setRows((prev) => [
      ...prev,
      {
        id: nextId,
        allocationDate: getEdmontonTodayDateString(),
        status: "Unloaded",
        department: "Mental Health",
        final7Digits: "",
        securityCode: "",
      },
    ]);
  };

  const shouldSkipStatusWarning = (): boolean => {
    try {
      return localStorage.getItem(STATUS_WARNING_PREF_KEY) === "1";
    } catch {
      // If localStorage is blocked/unavailable, default to showing warning
      return false;
    }
  };

  const handleStatusChangeAttempt = (rowId: number, nextStatus: CardStatus) => {
    // No warning for default/safe initial state
    if (nextStatus === "Unloaded") {
      updateRow(rowId, "status", nextStatus);
      return;
    }
    // Respect "don't show again"
    if (shouldSkipStatusWarning()) {
      updateRow(rowId, "status", nextStatus);
      return;
    }
    // Show warning modal before applying risky status
    setPendingStatusChange({ rowId, nextStatus });
    setDontShowStatusWarningAgain(false);
    setStatusWarningOpen(true);
  };

  const confirmStatusChange = () => {
    if (!pendingStatusChange) return;
    if (dontShowStatusWarningAgain) {
      try {
        localStorage.setItem(STATUS_WARNING_PREF_KEY, "1");
      } catch {
        // ignore localStorage write failures
      }
    }
    updateRow(
      pendingStatusChange.rowId,
      "status",
      pendingStatusChange.nextStatus,
    );
    setStatusWarningOpen(false);
    setPendingStatusChange(null);
    setDontShowStatusWarningAgain(false);
  };

  const cancelStatusChange = () => {
    setStatusWarningOpen(false);
    setPendingStatusChange(null);
    setDontShowStatusWarningAgain(false);
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
      <BackNavigation href="/cards" label="Back to ARC Card List" />
      <header className="flex items-center justify-between">
        <div className="text-primary text-sm font-medium">New Allocation</div>
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
                    onChange={(e) => handleStatusChangeAttempt(row.id, e.target.value as CardStatus)}
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
      {/* Status warning modal */}
      {statusWarningOpen && pendingStatusChange && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-2xl rounded-lg bg-white p-5 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900">
              Warning: Non-default status selected
            </h3>
            <p className="mt-2 text-sm text-gray-700">
              New cards should normally start as <strong>Unloaded</strong>.
              You selected <strong>{pendingStatusChange.nextStatus}</strong>.
            </p>
            <div className="mt-4 rounded border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700">
              <p className="font-semibold mb-2">Status meanings:</p>
              <ul className="space-y-1">
                {STATUS_OPTIONS.map((status) => (
                  <li key={status}>
                    <strong>{status}:</strong> {STATUS_MEANINGS[status]}
                  </li>
                ))}
              </ul>
            </div>
            <label className="mt-4 flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={dontShowStatusWarningAgain}
                onChange={(e) => setDontShowStatusWarningAgain(e.target.checked)}
              />
              Do not show this warning again on this browser
            </label>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                className="rounded border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                onClick={cancelStatusChange}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-opacity-90"
                onClick={confirmStatusChange}
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
