"use client";

import React from "react";

export interface RecipientHistoryRow {
  id: string;
  dateModified: string | null;
  modifiedBy: string;
  actionTaken: string;
  reason: string;
}

type Props = {
  rows: RecipientHistoryRow[];
};

function formatDateTime(value: string | null): string {
  if (!value) return "N/A";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Edmonton",
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(parsed);
}

export default function HistorySection({ rows }: Props) {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-medium text-gray-700">Recipient History</h1>
      <p className="text-sm text-gray-500">
        This section shows key actions related to this recipient profile.
      </p>
      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">
                Date Modified
              </th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">
                Modified By
              </th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">
                Action Taken
              </th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">
                Reason
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                  No history available for this recipient yet.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="border-t border-gray-100">
                  <td className="px-4 py-3 text-gray-700">
                    {formatDateTime(row.dateModified)}
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    {row.modifiedBy || "Unknown"}
                  </td>
                  <td className="px-4 py-3 text-gray-700">{row.actionTaken}</td>
                  <td className="px-4 py-3 text-gray-700">{row.reason || "N/A"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
