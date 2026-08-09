"use client";

import { createContext, useContext } from "react";

export type ViewMode = "staff" | "admin";

const ViewModeContext = createContext<ViewMode>("staff");

export function ViewModeProvider({
    value,
    children,
}: {
    value: ViewMode;
    children: React.ReactNode;
}) {
    return (
        <ViewModeContext.Provider value={value}>
            {children}
        </ViewModeContext.Provider>
    );
}

/** Returns the viewer's current mode on staff pages. IT admins see everything
 *  in read-only "view as" mode; staff see the normal editable UI. */
export function useViewMode(): ViewMode {
    return useContext(ViewModeContext);
}

export function useIsViewOnly(): boolean {
    return useViewMode() === "admin";
}
