"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
    getAdminSession,
    getAdministrativeStaff,
    deleteAdministrativeStaff,
    updateAdministrativeStaff,
    getAdministrativeStaffSummary,
    type AdministrativeStaffSummary,
} from "../actions";
import Fuse from "fuse.js";
import React from "react";
import Image from "next/image";
import { ChevronDown, Loader2, Pencil, Trash2, X } from "lucide-react";
import TopNav from "@/app/components/TopNav";
import SearchBar from "@/app/components/SearchBar";
import { AdvancedStaffModal, type StaffRow } from "./AdvancedStaffModal";

interface User {
    id: string;
    createdAt: Date;
    createdBy: string;
    email: string;
    firstName: string;
    lastName: string;
}

interface Session {
    name?: string;
    email?: string;
}

function StatPill({ label, value }: { label: string; value: number }) {
    return (
        <div className="rounded-lg bg-lightBlue/50 px-3 py-2 text-center">
            <div className="text-xl font-bold text-gray-900">{value}</div>
            <div className="text-[11px] font-medium uppercase tracking-wide text-gray-600">
                {label}
            </div>
        </div>
    );
}

function FieldInput({
    label,
    value,
    onChange,
    type = "text",
    disabled = false,
}: {
    label: string;
    value: string;
    onChange: (v: string) => void;
    type?: string;
    disabled?: boolean;
}) {
    return (
        <label className="block">
            <span className="mb-1 block text-xs font-medium text-gray-600">
                {label}
            </span>
            <input
                type={type}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                disabled={disabled}
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-60"
            />
        </label>
    );
}

function formatMemberSince(iso: string | null): string {
    if (!iso) return "—";
    try {
        return new Intl.DateTimeFormat("en-US", {
            month: "short",
            year: "numeric",
        }).format(new Date(iso));
    } catch {
        return "—";
    }
}

function AdminStaffRow({
    user,
    expanded,
    onToggle,
    onDelete,
    onSaved,
    onOpenAdvanced,
}: {
    user: User;
    expanded: boolean;
    onToggle: () => void;
    onDelete: () => void;
    onSaved: (next: User) => void;
    onOpenAdvanced: (user: User) => void;
}) {
    const [firstName, setFirstName] = useState(user.firstName);
    const [lastName, setLastName] = useState(user.lastName);
    const [email, setEmail] = useState(user.email);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [summary, setSummary] = useState<AdministrativeStaffSummary | null>(
        null,
    );
    const [summaryError, setSummaryError] = useState<string | null>(null);

    // Reset local edit state whenever the underlying user changes (e.g. after save
    // the parent replaces the row's data).
    useEffect(() => {
        setFirstName(user.firstName);
        setLastName(user.lastName);
        setEmail(user.email);
        setError(null);
    }, [user.firstName, user.lastName, user.email]);

    useEffect(() => {
        if (!expanded || summary) return;
        let cancelled = false;
        getAdministrativeStaffSummary(user.id)
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
    }, [expanded, summary, user.id]);

    const dirty =
        firstName.trim() !== user.firstName ||
        lastName.trim() !== user.lastName ||
        email.trim().toLowerCase() !== user.email.toLowerCase();

    const canSave = dirty && !saving && firstName.trim() && lastName.trim();

    const handleSave = async () => {
        setSaving(true);
        setError(null);
        try {
            await updateAdministrativeStaff(user.id, {
                firstName: firstName.trim(),
                lastName: lastName.trim(),
                email: email.trim().toLowerCase(),
            });
            onSaved({
                ...user,
                firstName: firstName.trim(),
                lastName: lastName.trim(),
                email: email.trim().toLowerCase(),
            });
        } catch (e) {
            setError(e instanceof Error ? e.message : "Failed to save");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="w-full overflow-hidden rounded-lg bg-white shadow-md transition-shadow">
            {/* Header row (clickable) */}
            <div className="flex items-center justify-between gap-4 px-4 py-3 sm:px-6 sm:py-4">
                <button
                    type="button"
                    onClick={onToggle}
                    className="flex min-w-0 flex-1 items-center gap-4 text-left"
                    aria-expanded={expanded}
                >
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-lightBlue">
                        <span className="text-lg font-semibold text-primary">
                            {user.firstName?.[0]?.toUpperCase() ||
                                user.email?.[0]?.toUpperCase() ||
                                "?"}
                        </span>
                    </div>
                    <div className="min-w-0 flex-1">
                        <div className="truncate text-base font-semibold text-gray-900 sm:text-lg">
                            {user.firstName} {user.lastName}
                        </div>
                        <div className="truncate text-xs text-gray-500 sm:text-sm">
                            {user.email || "No email"}
                        </div>
                    </div>
                    <ChevronDown
                        size={20}
                        className={`shrink-0 text-gray-400 transition-transform ${
                            expanded ? "rotate-180" : ""
                        }`}
                    />
                </button>

                <div className="flex shrink-0 items-center gap-2">
                    <button
                        type="button"
                        onClick={onToggle}
                        className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-50 text-blue-600 hover:bg-blue-100"
                        title="Edit"
                    >
                        <Pencil size={16} />
                    </button>
                    <button
                        type="button"
                        onClick={onDelete}
                        className="flex h-9 w-9 items-center justify-center rounded-full bg-red-50 text-red-600 hover:bg-red-100"
                        title="Delete"
                    >
                        <Trash2 size={16} />
                    </button>
                </div>
            </div>

            {/* Expanded panel */}
            {expanded && (
                <div className="border-t border-gray-100 bg-lightGrey px-4 py-4 sm:px-6">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                        <FieldInput
                            label="First name"
                            value={firstName}
                            onChange={setFirstName}
                            disabled={saving}
                        />
                        <FieldInput
                            label="Last name"
                            value={lastName}
                            onChange={setLastName}
                            disabled={saving}
                        />
                        <FieldInput
                            label="Email"
                            value={email}
                            onChange={setEmail}
                            type="email"
                            disabled={saving}
                        />
                    </div>

                    {/* Stats */}
                    <div className="mt-4">
                        {summary ? (
                            <>
                                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                                    <StatPill
                                        label="Recipients"
                                        value={summary.counts.recipientsRegistered}
                                    />
                                    <StatPill
                                        label="Cards issued"
                                        value={summary.counts.cardsIssued}
                                    />
                                    <StatPill
                                        label="Bans placed"
                                        value={summary.counts.bansPlaced}
                                    />
                                    <StatPill
                                        label="Audit entries"
                                        value={summary.counts.auditEntries}
                                    />
                                </div>
                                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500">
                                    <span>
                                        Status:{" "}
                                        <span className="font-medium capitalize text-gray-700">
                                            {summary.onboardingStatus}
                                        </span>
                                    </span>
                                    <span>
                                        Member since{" "}
                                        <span className="font-medium text-gray-700">
                                            {formatMemberSince(summary.createdAt)}
                                        </span>
                                    </span>
                                </div>
                            </>
                        ) : summaryError ? (
                            <div className="text-xs text-red-600">
                                {summaryError}
                            </div>
                        ) : (
                            <div className="flex items-center gap-2 text-xs text-gray-400">
                                <Loader2 className="h-3 w-3 animate-spin" />
                                Loading activity…
                            </div>
                        )}
                    </div>

                    {error && (
                        <div className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
                            {error}
                        </div>
                    )}

                    {/* Footer buttons */}
                    <div className="mt-4 flex items-center justify-between gap-3">
                        <button
                            type="button"
                            onClick={() => onOpenAdvanced(user)}
                            className="rounded-lg border border-primary/40 px-3 py-1.5 text-sm font-medium text-primary hover:bg-primary/5"
                        >
                            Advanced edit
                        </button>
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
                            {saving && (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            )}
                            {saving ? "Saving…" : "Confirm"}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

function DeleteConfirmModal({
    user,
    onCancel,
    onConfirm,
    busy,
    error,
}: {
    user: User;
    onCancel: () => void;
    onConfirm: () => void;
    busy: boolean;
    error: string | null;
}) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
                <div className="mb-4 flex items-start justify-between">
                    <h3 className="text-lg font-semibold text-red-600">
                        Delete staff account
                    </h3>
                    <button
                        type="button"
                        onClick={onCancel}
                        disabled={busy}
                        className="text-gray-400 hover:text-gray-600 disabled:opacity-50"
                    >
                        <X size={20} />
                    </button>
                </div>
                <div className="mb-4 rounded-md bg-red-50 px-4 py-3 text-sm text-red-800">
                    ⚠️ This is permanent. It removes the login and their profile.
                    Records they created (recipients, card issues, audit
                    entries) stay in place but their references become
                    unresolved.
                </div>
                <p className="mb-6 text-sm text-gray-600">
                    Delete{" "}
                    <span className="font-semibold text-gray-900">
                        {user.firstName} {user.lastName}
                    </span>{" "}
                    ({user.email || "no email"})?
                </p>
                {error && (
                    <div className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
                        {error}
                    </div>
                )}
                <div className="flex justify-end gap-3">
                    <button
                        type="button"
                        onClick={onCancel}
                        disabled={busy}
                        className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={onConfirm}
                        disabled={busy}
                        className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                    >
                        {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                        {busy ? "Deleting…" : "Delete account"}
                    </button>
                </div>
            </div>
        </div>
    );
}

export default function AdminDashboardPage() {
    const [session, setSession] = useState<Session | null>(null);
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchResults, setSearchResults] = useState<User[]>([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [pendingDelete, setPendingDelete] = useState<User | null>(null);
    const [deleteBusy, setDeleteBusy] = useState(false);
    const [deleteError, setDeleteError] = useState<string | null>(null);
    const [advancedStaff, setAdvancedStaff] = useState<User | null>(null);
    const router = useRouter();

    useEffect(() => {
        async function fetchData() {
            try {
                const sessionResponse = await getAdminSession();
                if (!sessionResponse) {
                    router.replace("/");
                    return;
                }
                setSession(sessionResponse);

                const users = await getAdministrativeStaff();
                setUsers(users);
                setSearchResults(users);
            } catch (err) {
                setError(
                    err instanceof Error ? err.message : "An error occurred",
                );
                router.replace("/");
            } finally {
                setLoading(false);
            }
        }

        fetchData();
    }, [router]);

    useEffect(() => {
        if (!searchQuery.trim()) {
            setSearchResults(users);
            return;
        }

        const fuse = new Fuse(users, {
            keys: ["firstName", "lastName", "email"],
            threshold: 0.3,
        });

        const results = fuse.search(searchQuery).map((r) => r.item);
        setSearchResults(results);
    }, [searchQuery, users]);

    const handleSavedUser = useCallback((next: StaffRow) => {
        setUsers((prev) =>
            prev.map((u) =>
                u.id === next.id
                    ? {
                          ...u,
                          firstName: next.firstName,
                          lastName: next.lastName,
                          email: next.email,
                      }
                    : u,
            ),
        );
        setAdvancedStaff((prev) =>
            prev && prev.id === next.id
                ? {
                      ...prev,
                      firstName: next.firstName,
                      lastName: next.lastName,
                      email: next.email,
                  }
                : prev,
        );
    }, []);

    const handleOpenAdvanced = useCallback((user: User) => {
        setAdvancedStaff(user);
    }, []);

    const handleConfirmDelete = useCallback(async () => {
        if (!pendingDelete) return;
        setDeleteBusy(true);
        setDeleteError(null);
        try {
            await deleteAdministrativeStaff(pendingDelete.id);
            setUsers((prev) => prev.filter((u) => u.id !== pendingDelete.id));
            setExpandedId((prev) =>
                prev === pendingDelete.id ? null : prev,
            );
            setPendingDelete(null);
        } catch (err) {
            setDeleteError(
                err instanceof Error ? err.message : "Failed to delete",
            );
        } finally {
            setDeleteBusy(false);
        }
    }, [pendingDelete]);

    if (loading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-white">
                <div className="h-14 w-14 animate-spin rounded-full border-4 border-cyan-100 border-t-cyan-500" />
            </div>
        );
    }

    if (error) {
        return (
            <main>
                <p style={{ color: "red" }}>Error: {error}</p>
            </main>
        );
    }

    if (!session) {
        return null;
    }

    return (
        <main>
            <TopNav
                user={{ name: session.name, email: session.email ?? "" }}
                activeHref="/it-admin"
                homeHref="/admin/dashboard"
                logoutRedirect="/admin/login"
            />
            <div className="min-h-screen bg-gray-100 p-6 px-4 sm:px-8 md:px-16 lg:px-24">
                <SearchBar
                    value={searchQuery}
                    onChange={setSearchQuery}
                    placeholder="Search administrative staff..."
                    className="mx-auto mb-6 max-w-7xl"
                >
                    <button className="flex items-center gap-2">
                        <Image
                            src="/filter.svg"
                            alt="Filter"
                            width={16}
                            height={16}
                        />
                        Filters
                    </button>
                </SearchBar>

                <div className="mx-auto flex max-w-7xl flex-col gap-3">
                    {searchResults.map((user) => (
                        <AdminStaffRow
                            key={user.id}
                            user={user}
                            expanded={expandedId === user.id}
                            onToggle={() =>
                                setExpandedId((prev) =>
                                    prev === user.id ? null : user.id,
                                )
                            }
                            onDelete={() => {
                                setDeleteError(null);
                                setPendingDelete(user);
                            }}
                            onSaved={handleSavedUser}
                            onOpenAdvanced={handleOpenAdvanced}
                        />
                    ))}
                </div>

                {searchResults.length === 0 && (
                    <div className="flex items-center justify-center rounded-lg p-10">
                        <Image
                            src="/no-results.svg"
                            alt="No results"
                            width={370}
                            height={370}
                        />
                    </div>
                )}
            </div>

            <AdvancedStaffModal
                open={advancedStaff !== null}
                staff={advancedStaff}
                onClose={() => setAdvancedStaff(null)}
                onSaved={handleSavedUser}
                onDeleteRequested={(s) => {
                    setDeleteError(null);
                    setPendingDelete({
                        id: s.id,
                        firstName: s.firstName,
                        lastName: s.lastName,
                        email: s.email,
                        createdAt: new Date(),
                        createdBy: "",
                    });
                    setAdvancedStaff(null);
                }}
            />

            {pendingDelete && (
                <DeleteConfirmModal
                    user={pendingDelete}
                    busy={deleteBusy}
                    error={deleteError}
                    onCancel={() => {
                        if (deleteBusy) return;
                        setPendingDelete(null);
                        setDeleteError(null);
                    }}
                    onConfirm={handleConfirmDelete}
                />
            )}
        </main>
    );
}
