import React from "react";
import { render, screen, act } from "@testing-library/react";
import AdminDashboard from "@/app/components/AdminDashboard";
// Mock Firestore
jest.mock("firebase/firestore", () => ({
    collection: jest.fn(),
    getDocs: jest.fn((colRef) => {
        if (colRef === "banned_users") {
            return { size: 3, forEach: () => {} };
        }
        return {
            size: 3,
            forEach: (
                callback: (doc: { data: () => { status: string } }) => void
            ) => {
                callback({ data: () => ({ status: "Active" }) });
                callback({ data: () => ({ status: "Expired" }) });
                callback({ data: () => ({ status: "Active" }) });
            },
        };
    }),
}));

jest.mock("../app/services/firebase", () => ({
    db: {},
}));

describe("AdminDashboard component", () => {
    test("renders all four stat card labels", () => {
        render(React.createElement(AdminDashboard));

        expect(screen.getByText("Available Cards")).toBeInTheDocument();
        expect(screen.getByText("Active Cards")).toBeInTheDocument();
        expect(screen.getByText("Expired Cards")).toBeInTheDocument();
        expect(screen.getByText("Flagged Users")).toBeInTheDocument();
    });

    test("renders correct mocked card values", async () => {
        await act(async () => {
            render(React.createElement(AdminDashboard));
        });

        const numberElements = await screen.findAllByRole("heading", {
            level: 2,
        });

        // Should find exactly 4 stat numbers
        expect(numberElements).toHaveLength(4);

        // Validate contents
        const values = numberElements.map((el) => el.textContent);
        expect(values).toEqual(expect.arrayContaining(["3", "2", "1"]));
    });
});
