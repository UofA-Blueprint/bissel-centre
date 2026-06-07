"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  X,
  Save,
  Upload,
  Search,
  ChevronDown,
  AlertTriangle,
  Trash2,
} from "lucide-react";
import {
  CardStatus,
  CardDepartment,
  STATUS_OPTIONS,
  DEPARTMENT_OPTIONS,
} from "./types";

type DraftCard = {
  id: number;
  allocationDate: string;
  status: CardStatus;
  department: CardDepartment;
  arcCardNumber: string;
  securityCode: string;
};

type CsvError = {
  row: number;
  field: string;
  message: string;
};

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

function SearchableSelect({
  options,
  value,
  onChange,
}: {
  options: readonly string[];
  value: string;
  onChange: (value: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({
    position: "fixed",
    visibility: "hidden",
  });

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        ref.current &&
        !ref.current.contains(event.target as Node) &&
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
        setSearch("");
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useLayoutEffect(() => {
    if (isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const dropUp = spaceBelow < 300;
      setDropdownStyle({
        position: "fixed",
        left: rect.left,
        width: Math.max(rect.width, 200),
        ...(dropUp
          ? { bottom: window.innerHeight - rect.top + 4 }
          : { top: rect.bottom + 4 }),
      });
    }
  }, [isOpen]);

  const filteredOptions = options.filter((opt) =>
    opt.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="relative" ref={ref}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-left focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
      >
        <span className="truncate">{value}</span>
        <ChevronDown
          className={`h-4 w-4 text-gray-400 transition-transform flex-shrink-0 ${isOpen ? "rotate-180" : ""}`}
        />
      </button>

      {isOpen && (
        <div
          ref={dropdownRef}
          style={dropdownStyle}
          className="z-[9999] rounded-md border border-gray-200 bg-white shadow-lg"
        >
          <div className="p-2 border-b border-gray-100">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search..."
                className="w-full rounded-md border border-gray-200 bg-gray-50 pl-7 pr-3 py-1.5 text-sm placeholder-gray-400 focus:border-cyan-500 focus:outline-none"
                autoFocus
              />
            </div>
          </div>
          <div className="max-h-72 overflow-y-auto py-1">
            {filteredOptions.length === 0 ? (
              <div className="px-3 py-2 text-sm text-gray-500">No matches</div>
            ) : (
              filteredOptions.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => {
                    onChange(opt);
                    setIsOpen(false);
                    setSearch("");
                  }}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-cyan-50 ${
                    opt === value
                      ? "bg-cyan-50 font-medium text-cyan-700"
                      : "text-gray-700"
                  }`}
                >
                  {opt}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

interface NewCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export default function NewCardModal({
  isOpen,
  onClose,
  onSaved,
}: NewCardModalProps) {
  const [rows, setRows] = useState<DraftCard[]>([]);
  const [nextId, setNextId] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [csvErrors, setCsvErrors] = useState<CsvError[]>([]);
  const [shakingRows, setShakingRows] = useState<Set<number>>(new Set());
  const modalRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const triggerShake = (id: number) => {
    setShakingRows((prev) => new Set(prev).add(id));
    setTimeout(() => {
      setShakingRows((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }, 500);
  };

  const hasUnsavedChanges = rows.length > 0;

  useEffect(() => {
    if (!isOpen || !hasUnsavedChanges) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isOpen, hasUnsavedChanges]);

  const resetAndClose = () => {
    setRows([]);
    setNextId(1);
    setError(null);
    setCsvErrors([]);
    onClose();
  };

  const confirmClose = () => {
    if (hasUnsavedChanges) {
      if (
        !window.confirm(
          "You have unsaved changes. Are you sure you want to close?"
        )
      ) {
        return;
      }
    }
    resetAndClose();
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
      confirmClose();
    }
  };

  const updateRow = <K extends keyof DraftCard>(
    id: number,
    key: K,
    value: DraftCard[K]
  ) => {
    setRows((prev) =>
      prev.map((row) => (row.id === id ? { ...row, [key]: value } : row))
    );
  };

  const removeRow = (id: number) => {
    setRows((prev) => prev.filter((row) => row.id !== id));
  };

  const addRow = () => {
    setRows((prev) => [
      ...prev,
      {
        id: nextId,
        allocationDate: new Date().toLocaleDateString("en-US"),
        status: "Unloaded" as CardStatus,
        department: "Mental Health" as CardDepartment,
        arcCardNumber: "",
        securityCode: "",
      },
    ]);
    setNextId((prev) => prev + 1);
  };

  const validateRows = (): string | null => {
    if (rows.length === 0) return "Please add at least one card before saving.";
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (row.arcCardNumber.length !== 7) {
        return `Card #${i + 1}: ARC Card Number must be the last 7 digits (got ${row.arcCardNumber.length}).`;
      }
      if (row.securityCode.length !== 3) {
        return `Card #${i + 1}: Security Code must be exactly 3 characters (got ${row.securityCode.length}).`;
      }
    }

    const seen = new Map<string, number>();
    for (let i = 0; i < rows.length; i++) {
      const num = rows[i].arcCardNumber;
      if (seen.has(num)) {
        return `Card #${i + 1} has the same ARC Card Number as Card #${seen.get(num)! + 1}.`;
      }
      seen.set(num, i);
    }

    return null;
  };

  const handleSave = async () => {
    const validationError = validateRows();
    if (validationError) {
      setError(validationError);
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const existingRes = await fetch("/api/cards");
      if (!existingRes.ok) {
        let serverMessage: string | undefined;
        try {
          const data = await existingRes.json();
          if (data && typeof data.error === "string") {
            serverMessage = data.error;
          }
        } catch {
          // response body wasn't JSON; fall through to generic message
        }
        throw new Error(
          serverMessage ||
            `Could not check for existing cards (HTTP ${existingRes.status}).`
        );
      }
      const existingData = await existingRes.json();
      const existingNumbers = new Set<string>(
        existingData.cards.map((c: { arcCardNumber: string }) => c.arcCardNumber)
      );
      const duplicates = rows.filter((r) => existingNumbers.has(r.arcCardNumber));
      if (duplicates.length > 0) {
        const indices = duplicates.map((d) => rows.indexOf(d) + 1);
        setError(
          `Card${duplicates.length > 1 ? "s" : ""} #${indices.join(", #")} already exist${duplicates.length === 1 ? "s" : ""} in the system.`
        );
        setSubmitting(false);
        return;
      }

      const cardsToCreate = rows.map((row) => ({
        allocationDate: row.allocationDate,
        status: row.status,
        department: row.department,
        arcCardNumber: row.arcCardNumber,
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
        let serverMessage: string | undefined;
        try {
          const data = await response.json();
          if (data && typeof data.error === "string") {
            serverMessage = data.error;
          }
        } catch {
          // response body wasn't JSON; fall through to generic message
        }
        throw new Error(
          serverMessage || `Failed to create cards (HTTP ${response.status})`
        );
      }

      onSaved();
      resetAndClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCsvUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      parseCsv(event.target?.result as string);
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const parseCsv = (text: string) => {
    const lines = text
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    if (lines.length < 2) {
      setCsvErrors([
        {
          row: 0,
          field: "file",
          message:
            "CSV must have a header row and at least one data row.",
        },
      ]);
      return;
    }

    const headers = parseCsvLine(lines[0]).map((h) => h.toLowerCase());
    const errors: CsvError[] = [];
    const newRows: DraftCard[] = [];
    let id = nextId;

    const dateIdx = headers.findIndex((h) =>
      ["allocationdate", "allocation_date", "allocation date", "date"].includes(
        h
      )
    );
    const statusIdx = headers.findIndex((h) => h === "status");
    const deptIdx = headers.findIndex((h) =>
      ["department", "dept"].includes(h)
    );
    const digitsIdx = headers.findIndex((h) =>
      [
        "final7digits",
        "final_7_digits",
        "final 7 digits",
        "arccardnumber",
        "arc_card_number",
        "card number",
        "cardnumber",
      ].includes(h)
    );
    const securityIdx = headers.findIndex((h) =>
      ["securitycode", "security_code", "security code"].includes(h)
    );

    if (digitsIdx === -1) {
      errors.push({
        row: 0,
        field: "header",
        message:
          'Missing required column: "arcCardNumber" (or "cardNumber", "final7Digits")',
      });
    }
    if (securityIdx === -1) {
      errors.push({
        row: 0,
        field: "header",
        message: 'Missing required column: "securityCode"',
      });
    }

    if (errors.length > 0) {
      setCsvErrors(errors);
      return;
    }

    for (let i = 1; i < lines.length; i++) {
      const values = parseCsvLine(lines[i]);
      const rowNum = i + 1;

      const allocationDate =
        dateIdx >= 0 && values[dateIdx]
          ? values[dateIdx]
          : new Date().toLocaleDateString("en-US");
      const statusRaw =
        statusIdx >= 0 && values[statusIdx] ? values[statusIdx] : "Unloaded";
      const deptRaw =
        deptIdx >= 0 && values[deptIdx] ? values[deptIdx] : "Mental Health";
      const digits = digitsIdx >= 0 ? (values[digitsIdx] || "").replace(/\s/g, "") : "";
      const security = securityIdx >= 0 ? values[securityIdx] || "" : "";

      let rowValid = true;

      const status = STATUS_OPTIONS.find(
        (s) => s.toLowerCase() === statusRaw.toLowerCase()
      );
      if (!status) {
        errors.push({
          row: rowNum,
          field: "status",
          message: `Invalid status "${statusRaw}". Must be one of: ${STATUS_OPTIONS.join(", ")}`,
        });
        rowValid = false;
      }

      const dept = DEPARTMENT_OPTIONS.find(
        (d) => d.toLowerCase() === deptRaw.toLowerCase()
      );
      if (!dept) {
        errors.push({
          row: rowNum,
          field: "department",
          message: `Invalid department "${deptRaw}". Must be one of: ${DEPARTMENT_OPTIONS.join(", ")}`,
        });
        rowValid = false;
      }

      if (digits.length !== 7) {
        errors.push({
          row: rowNum,
          field: "arcCardNumber",
          message: `Must be the last 7 digits (got ${digits.length}).`,
        });
        rowValid = false;
      }

      if (security.length !== 3) {
        errors.push({
          row: rowNum,
          field: "securityCode",
          message: `Must be exactly 3 characters (got ${security.length}).`,
        });
        rowValid = false;
      }

      if (rowValid && status && dept) {
        newRows.push({
          id: id++,
          allocationDate,
          status,
          department: dept,
          arcCardNumber: digits,
          securityCode: security,
        });
      }
    }

    setCsvErrors(errors);
    if (newRows.length > 0) {
      setRows((prev) => [...prev, ...newRows]);
      setNextId(id);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={handleOverlayClick}
    >
      <div
        ref={modalRef}
        className="bg-white rounded-xl w-full max-w-7xl max-h-[95vh] min-h-[75vh] flex flex-col shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-bold text-gray-900">
            New ARC Card Allocation
          </h2>
          <div className="flex items-center gap-3">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <Upload className="h-4 w-4" />
              Import CSV
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleCsvUpload}
              className="hidden"
            />
            <button
              onClick={handleSave}
              disabled={submitting || rows.length === 0}
              className="flex items-center gap-2 rounded-md bg-[#00BDD6] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-cyan-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save className="h-4 w-4" />
              {submitting ? "Saving..." : "Save"}
            </button>
            <button
              onClick={confirmClose}
              className="text-gray-400 hover:text-gray-600 p-1"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {error && (
            <div className="rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-700 flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {csvErrors.length > 0 && (
            <div className="rounded-md bg-amber-50 border border-amber-200 p-3 text-sm">
              <div className="flex items-center justify-between mb-1">
                <p className="font-medium text-amber-800">
                  CSV Import Errors:
                </p>
                <button
                  onClick={() => setCsvErrors([])}
                  className="text-amber-600 hover:text-amber-800 text-xs"
                >
                  Dismiss
                </button>
              </div>
              <ul className="list-disc list-inside text-amber-700 space-y-0.5">
                {csvErrors.map((err, i) => (
                  <li key={i}>
                    Row {err.row}, {err.field}: {err.message}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Staged Cards Table */}
          <div className="overflow-visible rounded-lg border border-gray-200 bg-white">
            <div className="overflow-x-auto overflow-y-visible">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-[#E0F7FA]">
                  <tr className="text-left text-xs font-bold text-gray-900">
                    <th className="px-3 py-3 w-12">#</th>
                    <th className="px-3 py-3 w-32">Allocation Date</th>
                    <th className="px-3 py-3 w-40">Status</th>
                    <th className="px-3 py-3 w-52">Department</th>
                    <th className="px-3 py-3 w-56">
                      ARC Card Number
                      <span className="ml-1 font-normal text-gray-500">
                        (last 7)
                      </span>
                    </th>
                    <th className="px-3 py-3 w-32">
                      Security Code
                      <span className="ml-1 font-normal text-gray-500">
                        (3)
                      </span>
                    </th>
                    <th className="px-3 py-3 w-12"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {rows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={7}
                        className="px-3 py-8 text-center text-gray-400"
                      >
                        No cards staged. Click &quot;+ Add Card&quot; or
                        &quot;Import CSV&quot; to begin.
                      </td>
                    </tr>
                  ) : (
                    rows.map((row, index) => (
                      <tr
                        key={row.id}
                        className={`${index % 2 === 0 ? "bg-white" : "bg-gray-50"} hover:bg-blue-50/50 transition-colors`}
                      >
                        <td className="px-3 py-2.5 font-medium text-gray-500">
                          {index + 1}
                        </td>
                        <td className="px-3 py-2.5 text-gray-700">
                          {row.allocationDate}
                        </td>
                        <td className="px-3 py-2.5">
                          <SearchableSelect
                            options={STATUS_OPTIONS}
                            value={row.status}
                            onChange={(val) =>
                              updateRow(row.id, "status", val as CardStatus)
                            }
                          />
                        </td>
                        <td className="px-3 py-2.5">
                          <SearchableSelect
                            options={DEPARTMENT_OPTIONS}
                            value={row.department}
                            onChange={(val) =>
                              updateRow(
                                row.id,
                                "department",
                                val as CardDepartment
                              )
                            }
                          />
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="relative">
                            <input
                              type="text"
                              inputMode="numeric"
                              maxLength={7}
                              placeholder="Last 7 digits"
                              className={`w-full rounded-md border px-3 py-2 pr-12 text-sm font-semibold text-gray-900 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 ${
                                row.arcCardNumber.length > 0 &&
                                row.arcCardNumber.length !== 7
                                  ? "border-red-300 bg-red-50"
                                  : "border-gray-300 bg-white"
                              } ${shakingRows.has(row.id) ? "animate-shake" : ""}`}
                              value={row.arcCardNumber}
                              onChange={(e) => {
                                const raw = e.target.value;
                                const digitsOnly = raw.replace(/[^0-9]/g, "");
                                if (raw !== digitsOnly) {
                                  triggerShake(row.id);
                                }
                                updateRow(row.id, "arcCardNumber", digitsOnly);
                              }}
                            />
                            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-400 pointer-events-none">
                              {7 - row.arcCardNumber.length}
                            </span>
                          </div>
                        </td>
                        <td className="px-3 py-2.5">
                          <input
                            type="text"
                            inputMode="numeric"
                            maxLength={3}
                            placeholder="3 digits"
                            className={`w-full rounded-md border px-3 py-2 text-sm text-gray-800 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 ${
                              row.securityCode.length > 0 &&
                              row.securityCode.length !== 3
                                ? "border-red-300 bg-red-50"
                                : "border-gray-300 bg-white"
                            }`}
                            value={row.securityCode}
                            onChange={(e) =>
                              updateRow(
                                row.id,
                                "securityCode",
                                e.target.value
                              )
                            }
                          />
                          {row.securityCode.length > 0 &&
                            row.securityCode.length !== 3 && (
                              <p className="text-xs text-red-500 mt-0.5">
                                {row.securityCode.length}/3
                              </p>
                            )}
                        </td>
                        <td className="px-3 py-2.5">
                          <button
                            onClick={() => removeRow(row.id)}
                            className="text-gray-400 hover:text-red-500 transition-colors"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <button
            type="button"
            onClick={addRow}
            className="flex items-center gap-2 text-[#00BDD6] text-sm font-semibold hover:underline"
          >
            <span className="text-lg">+</span>
            Add Card
          </button>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-gray-200 bg-gray-50 rounded-b-xl">
          <p className="text-sm text-gray-500">
            {rows.length} card{rows.length !== 1 ? "s" : ""} staged
          </p>
          <div className="flex items-center gap-3">
            <button
              onClick={confirmClose}
              className="px-4 py-2 border border-gray-300 rounded-md text-sm text-gray-700 hover:bg-gray-100"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={submitting || rows.length === 0}
              className="flex items-center gap-2 rounded-md bg-[#00BDD6] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-cyan-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save className="h-4 w-4" />
              {submitting ? "Saving..." : "Save Cards"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
