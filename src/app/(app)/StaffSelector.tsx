"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronDown, Users } from "lucide-react";
import { getAdministrativeStaff } from "@/app/admin/actions";
import { useIsViewOnly } from "./ViewModeContext";

type StaffOption = {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
};

/**
 * "Viewing as" staff dropdown shown only to IT admins on staff pages. Selecting
 * a staff member updates the URL query param that the surrounding page filters
 * on (e.g. `?createdBy=UID` on /dashboard). Selecting "All staff" removes the
 * param.
 */
export default function StaffSelector({
    queryParam,
    label = "Viewing as",
}: {
    /** Which URL query param to write to (e.g. "createdBy", "issuedBy"). */
    queryParam: string;
    label?: string;
}) {
    const isViewOnly = useIsViewOnly();
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const currentValue = searchParams.get(queryParam) ?? "";

    const [staff, setStaff] = useState<StaffOption[] | null>(null);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [open, setOpen] = useState(false);

    useEffect(() => {
        if (!isViewOnly) return;
        let cancelled = false;
        getAdministrativeStaff()
            .then((rows) => {
                if (cancelled) return;
                setStaff(
                    rows.map((r) => ({
                        id: r.id,
                        firstName: r.firstName,
                        lastName: r.secondName,
                        email: r.email,
                    })),
                );
            })
            .catch((err) => {
                if (cancelled) return;
                setLoadError(
                    err instanceof Error ? err.message : "Failed to load staff",
                );
            });
        return () => {
            cancelled = true;
        };
    }, [isViewOnly]);

    // Close on outside click.
    useEffect(() => {
        if (!open) return;
        function onClick(e: MouseEvent) {
            const target = e.target as Element;
            if (!target.closest(".staff-selector")) setOpen(false);
        }
        document.addEventListener("mousedown", onClick);
        return () => document.removeEventListener("mousedown", onClick);
    }, [open]);

    if (!isViewOnly) return null;

    const selected =
        staff?.find((s) => s.id === currentValue) ?? null;

    function setFilter(nextValue: string | null) {
        const params = new URLSearchParams(searchParams.toString());
        if (!nextValue) {
            params.delete(queryParam);
        } else {
            params.set(queryParam, nextValue);
        }
        const search = params.toString();
        router.replace(search ? `${pathname}?${search}` : pathname);
        setOpen(false);
    }

    const displayLabel = selected
        ? `${selected.firstName} ${selected.lastName}`.trim() || selected.email
        : "All staff";

    return (
        <div className="staff-selector relative inline-block">
            <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                className="inline-flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-sm font-medium text-amber-900 shadow-sm hover:bg-amber-100"
            >
                <Users size={14} />
                <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-700">
                    {label}
                </span>
                <span className="max-w-[160px] truncate">{displayLabel}</span>
                <ChevronDown
                    size={14}
                    className={`transition-transform ${open ? "rotate-180" : ""}`}
                />
            </button>

            {open && (
                <div className="absolute left-0 top-full z-40 mt-1 max-h-80 w-72 overflow-y-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
                    <button
                        type="button"
                        onClick={() => setFilter(null)}
                        className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm ${
                            !currentValue
                                ? "bg-lightBlue text-primary"
                                : "text-gray-700 hover:bg-gray-50"
                        }`}
                    >
                        <span className="font-medium">All staff</span>
                        <span className="text-xs text-gray-400">Clear</span>
                    </button>
                    <div className="my-1 h-px bg-gray-100" />

                    {staff === null && !loadError && (
                        <div className="px-3 py-2 text-xs text-gray-400">
                            Loading…
                        </div>
                    )}
                    {loadError && (
                        <div className="px-3 py-2 text-xs text-red-600">
                            {loadError}
                        </div>
                    )}
                    {staff?.map((s) => {
                        const isSelected = s.id === currentValue;
                        const name =
                            `${s.firstName} ${s.lastName}`.trim() || s.email;
                        return (
                            <button
                                key={s.id}
                                type="button"
                                onClick={() => setFilter(s.id)}
                                className={`flex w-full flex-col gap-0.5 px-3 py-2 text-left text-sm ${
                                    isSelected
                                        ? "bg-lightBlue text-primary"
                                        : "text-gray-700 hover:bg-gray-50"
                                }`}
                            >
                                <span className="font-medium">{name}</span>
                                <span className="truncate text-xs text-gray-500">
                                    {s.email}
                                </span>
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
