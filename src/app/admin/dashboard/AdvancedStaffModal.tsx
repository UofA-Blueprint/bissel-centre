"use client";

import { Fragment, useEffect, useState } from "react";
import {
    Dialog,
    DialogBackdrop,
    DialogPanel,
    DialogTitle,
    Popover,
    PopoverButton,
    PopoverPanel,
    Transition,
} from "@headlessui/react";
import {
    ChevronLeft,
    CreditCard,
    History as HistoryIcon,
    Loader2,
    MoreHorizontal,
    ShieldAlert,
    Trash2,
    User as UserIcon,
    Users,
    X,
} from "lucide-react";
import Link from "next/link";
import {
    getAdministrativeStaffSummary,
    getStaffAuditEntries,
    getStaffBans,
    getStaffIssues,
    getStaffRecipients,
    updateAdministrativeStaff,
    type AdministrativeStaffSummary,
    type StaffAuditRow,
    type StaffBanRow,
    type StaffIssueRow,
    type StaffRecipientRow,
} from "../actions";

export interface StaffRow {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
}

type Section = "overview" | "recipients" | "cards" | "audit" | "bans";

const SECTIONS: Array<{
    id: Section;
    label: string;
    icon: React.ComponentType<{ size?: number; className?: string }>;
}> = [
    { id: "overview", label: "Overview", icon: UserIcon },
    { id: "recipients", label: "Recipients", icon: Users },
    { id: "cards", label: "Cards", icon: CreditCard },
    { id: "audit", label: "Audit log", icon: HistoryIcon },
    { id: "bans", label: "Banned users", icon: ShieldAlert },
];

// URL query param each section maps to on its "Open in another view" link.
const SECTION_LINKS: Record<Section, ((uid: string) => string) | null> = {
    overview: null,
    recipients: (uid) => `/dashboard?createdBy=${encodeURIComponent(uid)}`,
    cards: (uid) => `/cards?issuedBy=${encodeURIComponent(uid)}`,
    audit: (uid) => `/reports?modifiedBy=${encodeURIComponent(uid)}`,
    bans: (uid) => `/reports?bannedBy=${encodeURIComponent(uid)}`,
};

function formatDate(iso: string | null): string {
    if (!iso) return "—";
    try {
        return new Intl.DateTimeFormat("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
        }).format(new Date(iso));
    } catch {
        return iso;
    }
}

function StatCard({ label, value }: { label: string; value: number }) {
    return (
        <div className="rounded-xl border border-gray-100 bg-white px-4 py-3 shadow-sm">
            <div className="text-2xl font-bold text-gray-900">{value}</div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                {label}
            </div>
        </div>
    );
}

function OverviewPane({
    staff,
    summary,
    summaryError,
    onSaved,
}: {
    staff: StaffRow;
    summary: AdministrativeStaffSummary | null;
    summaryError: string | null;
    onSaved: (next: StaffRow) => void;
}) {
    const [firstName, setFirstName] = useState(staff.firstName);
    const [lastName, setLastName] = useState(staff.lastName);
    const [email, setEmail] = useState(staff.email);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [savedFlash, setSavedFlash] = useState(false);

    useEffect(() => {
        setFirstName(staff.firstName);
        setLastName(staff.lastName);
        setEmail(staff.email);
        setError(null);
    }, [staff.firstName, staff.lastName, staff.email]);

    const dirty =
        firstName.trim() !== staff.firstName ||
        lastName.trim() !== staff.lastName ||
        email.trim().toLowerCase() !== staff.email.toLowerCase();
    const canSave = dirty && !saving && firstName.trim() && lastName.trim();

    const handleSave = async () => {
        setSaving(true);
        setError(null);
        try {
            await updateAdministrativeStaff(staff.id, {
                firstName: firstName.trim(),
                lastName: lastName.trim(),
                email: email.trim().toLowerCase(),
            });
            onSaved({
                ...staff,
                firstName: firstName.trim(),
                lastName: lastName.trim(),
                email: email.trim().toLowerCase(),
            });
            setSavedFlash(true);
            setTimeout(() => setSavedFlash(false), 2000);
        } catch (e) {
            setError(e instanceof Error ? e.message : "Failed to save");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="flex h-full flex-col">
            <div className="mb-6">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-500">
                    Personal Details
                </h3>
                <div className="mt-3 h-px bg-gray-200" />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <label className="block">
                    <span className="mb-1 block text-xs font-medium text-gray-600">
                        First name
                    </span>
                    <input
                        type="text"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        disabled={saving}
                        className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-60"
                    />
                </label>
                <label className="block">
                    <span className="mb-1 block text-xs font-medium text-gray-600">
                        Last name
                    </span>
                    <input
                        type="text"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        disabled={saving}
                        className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-60"
                    />
                </label>
                <label className="block sm:col-span-2">
                    <span className="mb-1 block text-xs font-medium text-gray-600">
                        Email
                    </span>
                    <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        disabled={saving}
                        className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-60"
                    />
                </label>
            </div>

            {error && (
                <div className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
                    {error}
                </div>
            )}

            <div className="mt-4 flex items-center justify-end gap-3">
                {savedFlash && (
                    <span className="text-xs text-green-600">Saved ✓</span>
                )}
                <button
                    type="button"
                    onClick={handleSave}
                    disabled={!canSave}
                    className={`inline-flex items-center gap-2 rounded-lg px-4 py-1.5 text-sm font-semibold text-white transition-colors ${
                        canSave
                            ? "bg-primary hover:bg-cyan-600"
                            : "cursor-not-allowed bg-gray-300"
                    }`}
                >
                    {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    {saving ? "Saving…" : "Save changes"}
                </button>
            </div>

            <div className="mt-8">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-500">
                    Activity summary
                </h3>
                <div className="mt-3 h-px bg-gray-200" />
                {summary ? (
                    <>
                        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                            <StatCard
                                label="Recipients"
                                value={summary.counts.recipientsRegistered}
                            />
                            <StatCard
                                label="Cards issued"
                                value={summary.counts.cardsIssued}
                            />
                            <StatCard
                                label="Bans placed"
                                value={summary.counts.bansPlaced}
                            />
                            <StatCard
                                label="Audit entries"
                                value={summary.counts.auditEntries}
                            />
                        </div>

                        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <div className="rounded-lg border border-gray-100 bg-white p-4 shadow-sm">
                                <div className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                                    Onboarding
                                </div>
                                <div className="mt-1 text-sm font-medium capitalize text-gray-900">
                                    {summary.onboardingStatus}
                                </div>
                            </div>
                            <div className="rounded-lg border border-gray-100 bg-white p-4 shadow-sm">
                                <div className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                                    Member since
                                </div>
                                <div className="mt-1 text-sm font-medium text-gray-900">
                                    {formatDate(summary.createdAt)}
                                </div>
                            </div>
                        </div>
                    </>
                ) : summaryError ? (
                    <div className="mt-4 text-sm text-red-600">
                        {summaryError}
                    </div>
                ) : (
                    <div className="mt-4 flex items-center gap-2 text-sm text-gray-400">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Loading activity…
                    </div>
                )}
            </div>
        </div>
    );
}

function TablePaneShell({
    title,
    linkHref,
    icon: Icon,
    loading,
    error,
    empty,
    children,
}: {
    title: string;
    linkHref: string | null;
    icon: React.ComponentType<{ size?: number; className?: string }>;
    loading: boolean;
    error: string | null;
    empty: boolean;
    children: React.ReactNode;
}) {
    return (
        <div className="flex h-full flex-col">
            <div className="mb-4 flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-500">
                    {title}
                </h3>
                {linkHref && (
                    <Link
                        href={linkHref}
                        className="shrink-0 rounded-lg border border-primary/40 px-3 py-1.5 text-sm font-medium text-primary hover:bg-primary/5"
                    >
                        Open in another view →
                    </Link>
                )}
            </div>

            {loading ? (
                <div className="flex flex-1 flex-col items-center justify-center gap-2 rounded-xl border border-gray-100 bg-white text-sm text-gray-400">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Loading…
                </div>
            ) : error ? (
                <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {error}
                </div>
            ) : empty ? (
                <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-gray-200 bg-white p-10 text-center">
                    <Icon className="text-gray-300" size={48} />
                    <div className="text-sm font-medium text-gray-600">
                        Nothing to show
                    </div>
                    <div className="max-w-sm text-xs text-gray-500">
                        This staff member has no {title.toLowerCase()} on
                        record.
                    </div>
                </div>
            ) : (
                <div className="overflow-x-auto rounded-xl border border-gray-100 bg-white shadow-sm">
                    {children}
                </div>
            )}
        </div>
    );
}

function TinyTable<T>({
    rows,
    columns,
    rowKey,
}: {
    rows: T[];
    columns: Array<{
        header: string;
        cell: (row: T) => React.ReactNode;
        className?: string;
    }>;
    rowKey: (row: T) => string;
}) {
    return (
        <table className="min-w-full divide-y divide-gray-100 text-sm">
            <thead className="bg-gray-50">
                <tr>
                    {columns.map((c) => (
                        <th
                            key={c.header}
                            className={`px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500 ${
                                c.className ?? ""
                            }`}
                        >
                            {c.header}
                        </th>
                    ))}
                </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
                {rows.map((row) => (
                    <tr key={rowKey(row)} className="hover:bg-gray-50">
                        {columns.map((c) => (
                            <td
                                key={c.header}
                                className={`px-3 py-2 text-gray-700 ${c.className ?? ""}`}
                            >
                                {c.cell(row)}
                            </td>
                        ))}
                    </tr>
                ))}
            </tbody>
        </table>
    );
}

function formatShortDate(iso: string | null): string {
    if (!iso) return "—";
    try {
        return new Intl.DateTimeFormat("en-US", {
            month: "short",
            day: "numeric",
            year: "2-digit",
        }).format(new Date(iso));
    } catch {
        return iso ?? "—";
    }
}

function RecipientsPane({
    staffId,
    linkHref,
}: {
    staffId: string;
    linkHref: string | null;
}) {
    const [rows, setRows] = useState<StaffRecipientRow[] | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        getStaffRecipients(staffId)
            .then((r) => {
                if (!cancelled) setRows(r);
            })
            .catch((e) => {
                if (!cancelled)
                    setError(e instanceof Error ? e.message : "Failed to load");
            });
        return () => {
            cancelled = true;
        };
    }, [staffId]);

    return (
        <TablePaneShell
            title="Recipients registered"
            linkHref={linkHref}
            icon={Users}
            loading={rows === null && !error}
            error={error}
            empty={rows !== null && rows.length === 0}
        >
            {rows && (
                <TinyTable
                    rows={rows}
                    rowKey={(r) => r.id}
                    columns={[
                        {
                            header: "Name",
                            cell: (r) => (
                                <span className="font-medium text-gray-900">
                                    {r.firstName} {r.lastName}
                                </span>
                            ),
                        },
                        {
                            header: "Email",
                            cell: (r) => r.email || "—",
                        },
                        {
                            header: "Registered",
                            cell: (r) => formatShortDate(r.createdAt),
                        },
                        {
                            header: "Status",
                            cell: (r) =>
                                r.banned ? (
                                    <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-medium text-red-700">
                                        Flagged
                                    </span>
                                ) : (
                                    <span className="inline-flex items-center rounded-full bg-green-50 px-2 py-0.5 text-[11px] font-medium text-green-700">
                                        Active
                                    </span>
                                ),
                        },
                    ]}
                />
            )}
        </TablePaneShell>
    );
}

function CardsPane({
    staffId,
    linkHref,
}: {
    staffId: string;
    linkHref: string | null;
}) {
    const [rows, setRows] = useState<StaffIssueRow[] | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        getStaffIssues(staffId)
            .then((r) => {
                if (!cancelled) setRows(r);
            })
            .catch((e) => {
                if (!cancelled)
                    setError(e instanceof Error ? e.message : "Failed to load");
            });
        return () => {
            cancelled = true;
        };
    }, [staffId]);

    return (
        <TablePaneShell
            title="Cards issued"
            linkHref={linkHref}
            icon={CreditCard}
            loading={rows === null && !error}
            error={error}
            empty={rows !== null && rows.length === 0}
        >
            {rows && (
                <TinyTable
                    rows={rows}
                    rowKey={(r) => r.id}
                    columns={[
                        {
                            header: "Card #",
                            cell: (r) => (
                                <span className="font-mono text-xs">
                                    {r.cardNumber || "—"}
                                </span>
                            ),
                        },
                        {
                            header: "Recipient",
                            cell: (r) => r.userName || "—",
                        },
                        {
                            header: "Department",
                            cell: (r) => r.department || "—",
                        },
                        {
                            header: "Issued",
                            cell: (r) => formatShortDate(r.issueDate),
                        },
                        {
                            header: "Returned",
                            cell: (r) =>
                                r.returnedAt ? (
                                    <span className="text-gray-500">
                                        {formatShortDate(r.returnedAt)}
                                    </span>
                                ) : (
                                    <span className="text-green-700">
                                        Still out
                                    </span>
                                ),
                        },
                    ]}
                />
            )}
        </TablePaneShell>
    );
}

function AuditPane({
    staffId,
    linkHref,
}: {
    staffId: string;
    linkHref: string | null;
}) {
    const [rows, setRows] = useState<StaffAuditRow[] | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        getStaffAuditEntries(staffId)
            .then((r) => {
                if (!cancelled) setRows(r);
            })
            .catch((e) => {
                if (!cancelled)
                    setError(e instanceof Error ? e.message : "Failed to load");
            });
        return () => {
            cancelled = true;
        };
    }, [staffId]);

    return (
        <TablePaneShell
            title="Audit log entries"
            linkHref={linkHref}
            icon={HistoryIcon}
            loading={rows === null && !error}
            error={error}
            empty={rows !== null && rows.length === 0}
        >
            {rows && (
                <TinyTable
                    rows={rows}
                    rowKey={(r) => r.id}
                    columns={[
                        {
                            header: "When",
                            cell: (r) => formatShortDate(r.date),
                        },
                        {
                            header: "Event",
                            cell: (r) => (
                                <span className="font-medium text-gray-900">
                                    {r.event || "—"}
                                </span>
                            ),
                        },
                        {
                            header: "User",
                            cell: (r) => r.userName || "—",
                        },
                        {
                            header: "Notes",
                            cell: (r) => (
                                <span className="line-clamp-2 text-xs text-gray-600">
                                    {r.notes || r.reason || "—"}
                                </span>
                            ),
                        },
                    ]}
                />
            )}
        </TablePaneShell>
    );
}

function BansPane({
    staffId,
    linkHref,
}: {
    staffId: string;
    linkHref: string | null;
}) {
    const [rows, setRows] = useState<StaffBanRow[] | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        getStaffBans(staffId)
            .then((r) => {
                if (!cancelled) setRows(r);
            })
            .catch((e) => {
                if (!cancelled)
                    setError(e instanceof Error ? e.message : "Failed to load");
            });
        return () => {
            cancelled = true;
        };
    }, [staffId]);

    return (
        <TablePaneShell
            title="Bans placed"
            linkHref={linkHref}
            icon={ShieldAlert}
            loading={rows === null && !error}
            error={error}
            empty={rows !== null && rows.length === 0}
        >
            {rows && (
                <TinyTable
                    rows={rows}
                    rowKey={(r) => r.id}
                    columns={[
                        {
                            header: "User",
                            cell: (r) => (
                                <span className="font-medium text-gray-900">
                                    {r.userName || "—"}
                                </span>
                            ),
                        },
                        {
                            header: "Reason",
                            cell: (r) => r.banReason || "—",
                        },
                        {
                            header: "When",
                            cell: (r) => formatShortDate(r.bannedAt),
                        },
                        {
                            header: "Notes",
                            cell: (r) => (
                                <span className="line-clamp-2 text-xs text-gray-600">
                                    {r.notes || "—"}
                                </span>
                            ),
                        },
                    ]}
                />
            )}
        </TablePaneShell>
    );
}

export function AdvancedStaffModal({
    open,
    onClose,
    staff,
    onSaved,
    onDeleteRequested,
}: {
    open: boolean;
    onClose: () => void;
    staff: StaffRow | null;
    onSaved: (next: StaffRow) => void;
    onDeleteRequested: (staff: StaffRow) => void;
}) {
    const [section, setSection] = useState<Section>("overview");
    const [summary, setSummary] = useState<AdministrativeStaffSummary | null>(
        null,
    );
    const [summaryError, setSummaryError] = useState<string | null>(null);
    const [trackedStaffId, setTrackedStaffId] = useState<string | null>(
        staff?.id ?? null,
    );

    // Reset per-staff state when the modal is opened for a different staff
    // member. Doing this in render (React docs pattern) avoids the cascade of
    // renders that useEffect would cause and satisfies react-hooks/set-state-
    // in-effect.
    if (staff && staff.id !== trackedStaffId) {
        setTrackedStaffId(staff.id);
        setSection("overview");
        setSummary(null);
        setSummaryError(null);
    }

    // Lazy-load summary while the modal is open.
    useEffect(() => {
        if (!open || !staff || summary) return;
        let cancelled = false;
        getAdministrativeStaffSummary(staff.id)
            .then((s) => {
                if (!cancelled) setSummary(s);
            })
            .catch((err) => {
                if (!cancelled)
                    setSummaryError(
                        err instanceof Error ? err.message : "Failed to load",
                    );
            });
        return () => {
            cancelled = true;
        };
    }, [open, staff, summary]);

    const openLink = staff ? SECTION_LINKS[section]?.(staff.id) ?? null : null;

    return (
        <Dialog open={open} onClose={onClose} className="relative z-50">
            <DialogBackdrop
                transition
                className="fixed inset-0 bg-black/40 transition-opacity duration-200 data-[closed]:opacity-0"
            />
            <div className="fixed inset-0 flex items-end justify-center sm:items-center sm:p-4">
                <DialogPanel
                    transition
                    className="flex h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-t-2xl bg-white shadow-xl transition duration-200 ease-out data-[closed]:translate-y-full sm:h-[85vh] sm:rounded-2xl sm:data-[closed]:translate-y-0 sm:data-[closed]:scale-95 sm:data-[closed]:opacity-0"
                >
                    {staff && (
                    <>
                    {/* Header */}
                    <div className="flex items-center gap-3 border-b border-primary/20 px-4 py-3 sm:px-6 sm:py-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="rounded-full p-1 text-primary hover:bg-primary/10 sm:hidden"
                            aria-label="Back"
                        >
                            <ChevronLeft size={20} />
                        </button>
                        <DialogTitle className="flex-1 text-lg font-semibold text-gray-900">
                            Staff details
                        </DialogTitle>
                        <button
                            type="button"
                            onClick={onClose}
                            className="hidden rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 sm:block"
                            aria-label="Close"
                        >
                            <X size={20} />
                        </button>
                    </div>

                    {/* Body */}
                    <div className="flex flex-1 flex-col overflow-hidden md:flex-row">
                        {/* Sidebar */}
                        <aside className="flex shrink-0 flex-col border-b border-gray-100 bg-white md:w-64 md:border-b-0 md:border-r">
                            <nav className="flex overflow-x-auto p-3 md:flex-col md:overflow-visible">
                                {SECTIONS.map((s) => {
                                    const isActive = section === s.id;
                                    const Icon = s.icon;
                                    return (
                                        <button
                                            key={s.id}
                                            type="button"
                                            onClick={() => setSection(s.id)}
                                            className={`flex shrink-0 items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-colors md:whitespace-normal ${
                                                isActive
                                                    ? "bg-lightBlue text-primary"
                                                    : "text-gray-600 hover:bg-gray-100"
                                            }`}
                                        >
                                            <Icon size={16} />
                                            {s.label}
                                        </button>
                                    );
                                })}
                            </nav>

                            <div className="mt-auto hidden p-3 md:block">
                                <Popover className="relative">
                                    <PopoverButton className="flex w-full items-center justify-center gap-2 rounded-lg border border-primary/40 px-3 py-2 text-sm font-medium text-primary hover:bg-primary/5">
                                        <MoreHorizontal size={16} />
                                        Manage account
                                    </PopoverButton>
                                    <Transition
                                        as={Fragment}
                                        enter="transition ease-out duration-100"
                                        enterFrom="opacity-0 translate-y-1"
                                        enterTo="opacity-100 translate-y-0"
                                        leave="transition ease-in duration-75"
                                        leaveFrom="opacity-100 translate-y-0"
                                        leaveTo="opacity-0 translate-y-1"
                                    >
                                        <PopoverPanel className="absolute bottom-full left-0 mb-2 w-56 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg">
                                            {({ close }) => (
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        close();
                                                        onDeleteRequested(
                                                            staff,
                                                        );
                                                    }}
                                                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"
                                                >
                                                    <Trash2 size={14} />
                                                    Delete account
                                                </button>
                                            )}
                                        </PopoverPanel>
                                    </Transition>
                                </Popover>
                            </div>
                        </aside>

                        {/* Right pane */}
                        <section className="flex-1 overflow-y-auto bg-gray-50 p-4 sm:p-6">
                            {/* Staff header — big avatar + name (matches profile page look) */}
                            <div className="mb-6 flex items-center gap-4">
                                <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-lightBlue">
                                    <span className="text-2xl font-bold text-primary">
                                        {staff.firstName?.[0]?.toUpperCase() ||
                                            staff.email?.[0]?.toUpperCase() ||
                                            "?"}
                                    </span>
                                </div>
                                <div className="min-w-0 flex-1">
                                    <div className="truncate text-xl font-bold text-gray-900">
                                        {staff.firstName} {staff.lastName}
                                    </div>
                                    <div className="truncate text-sm text-gray-500">
                                        {staff.email || "No email"}
                                    </div>
                                </div>
                                {/* Section link header for lists */}
                                {openLink && (
                                    <Link
                                        href={openLink}
                                        className="hidden shrink-0 rounded-lg border border-primary/40 px-3 py-1.5 text-sm font-medium text-primary hover:bg-primary/5 md:inline-flex"
                                    >
                                        Open in another view →
                                    </Link>
                                )}
                            </div>

                            {section === "overview" && (
                                <OverviewPane
                                    staff={staff}
                                    summary={summary}
                                    summaryError={summaryError}
                                    onSaved={onSaved}
                                />
                            )}
                            {section === "recipients" && (
                                <RecipientsPane
                                    staffId={staff.id}
                                    linkHref={openLink}
                                />
                            )}
                            {section === "cards" && (
                                <CardsPane
                                    staffId={staff.id}
                                    linkHref={openLink}
                                />
                            )}
                            {section === "audit" && (
                                <AuditPane
                                    staffId={staff.id}
                                    linkHref={openLink}
                                />
                            )}
                            {section === "bans" && (
                                <BansPane
                                    staffId={staff.id}
                                    linkHref={openLink}
                                />
                            )}
                        </section>
                    </div>

                    {/* Mobile Manage account (footer strip) */}
                    <div className="border-t border-gray-100 p-3 md:hidden">
                        <button
                            type="button"
                            onClick={() => onDeleteRequested(staff)}
                            className="flex w-full items-center justify-center gap-2 rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
                        >
                            <Trash2 size={14} />
                            Delete account
                        </button>
                    </div>
                    </>
                    )}
                </DialogPanel>
            </div>
        </Dialog>
    );
}
