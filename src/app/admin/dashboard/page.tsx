"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import { auth } from "../../services/firebase";
import { deleteUser, getAdminSession, listUsers } from "../actions";
import Fuse from "fuse.js"; // Import Fuse.js for fuzzy search
import React from "react";
import Image from "next/image";

interface User {
    uid: string;
    email: string | undefined;
    displayName: string | undefined;
    customClaims: Record<string, unknown> | undefined;
}

interface Session {
    name?: string;
    email: string;
}

function AdminUserCard({
    user,
    onDelete,
    onEdit,
}: {
    user: User;
    onDelete: () => void;
    onEdit: () => void;
}) {
    const isSuperAdmin = user.customClaims?.admin === true;

    return (
        <div className="bg-white rounded-xl shadow-sm px-6 py-4 flex items-center justify-between w-full max-w-3xl hover:shadow-md transition">
            {/* Left: Avatar + Info */}
            <div className="flex items-center gap-4">
                {/* Avatar */}
                <div className="w-12 h-12 rounded-full overflow-hidden bg-gray-100 flex items-center justify-center">
                    <span className="text-lg font-semibold text-gray-700">
                        {user.displayName?.[0] ||
                            user.email?.[0]?.toUpperCase()}
                    </span>
                </div>

                {/* Name + Email */}
                <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                        <span className="text-lg font-semibold text-gray-900 truncate">
                            {user.displayName || "Unnamed Admin"}
                        </span>
                        {isSuperAdmin && (
                            <span className="bg-green-100 text-green-700 text-xs font-medium px-2 py-0.5 rounded-full">
                                IT Admin
                            </span>
                        )}
                    </div>
                    <span className="text-sm text-gray-500 truncate">
                        {user.email || "N/A"}
                    </span>
                </div>
            </div>

            {/* Right: Action buttons */}
            <div className="flex items-center gap-3">
                {/* Edit Button */}
                <button
                    onClick={onEdit}
                    className="flex items-center justify-center w-9 h-9 rounded-full bg-blue-50 hover:bg-blue-100 transition"
                    title="Edit"
                >
                    <Image
                        src="/pencil-create.svg"
                        alt="Edit"
                        width={16}
                        height={16}
                    />
                </button>

                {/* Delete Button */}
                <button
                    onClick={onDelete}
                    className="flex items-center justify-center w-9 h-9 rounded-full bg-red-50 hover:bg-red-100 transition"
                    title="Delete"
                >
                    <Image
                        src="/trash-empty.svg"
                        alt="Delete"
                        width={16}
                        height={16}
                        className="text-red-500"
                    />
                </button>
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
    const router = useRouter();

    useEffect(() => {
        async function fetchData() {
            try {
                // First check if there's a valid session
                const sessionCheckResponse = await fetch("/api/user-session");
                if (!sessionCheckResponse.ok) {
                    router.replace("/");
                    return;
                }

                // Fetch session data
                const sessionResponse = await getAdminSession();
                console.log("Session response:", sessionResponse);
                if (!sessionResponse) {
                    router.replace("/");
                    return;
                }
                const sessionData = sessionResponse;

                setSession(sessionData);

                // Fetch users data
                const users = await listUsers();
                // if (!usersResponse.ok) {
                //   throw new Error("Failed to fetch users");
                // }
                // const usersData = await usersResponse.json();
                setUsers(users);
                setSearchResults(users);
            } catch (err) {
                setError(
                    err instanceof Error ? err.message : "An error occurred"
                );
                // On error, redirect to home
                router.replace("/");
            } finally {
                setLoading(false);
            }
        }

        fetchData();
    }, [router]);

    const handleLogout = async () => {
        try {
            await fetch("/api/logout", { method: "POST" });
            await signOut(auth);
            router.replace("/admin/login");
        } catch (error) {
            console.error("Logout failed:", error);
        }
    };

    async function handleDeleteUser(uid: string) {
        if (!confirm("Are you sure you want to delete this user?")) {
            return;
        }
        setLoading(true);
        try {
            await deleteUser(uid);

            // Remove user from local state
            setUsers(users.filter((user) => user.uid !== uid));
        } catch (err) {
            setError(
                err instanceof Error ? err.message : "Failed to delete user"
            );
        }
        setLoading(false);
    }

    const handleSearch = () => {
        if (!searchQuery) {
            setSearchResults(users);
            return;
        }
        const fuse = new Fuse(users, {
            keys: ["email", "displayName"],
            threshold: 0.3,
        });
        const results = fuse.search(searchQuery).map((result) => result.item);
        setSearchResults(results);
    };

    if (loading) {
        return (
            <main>
                <p>Loading...</p>
            </main>
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
        return null; // Will redirect
    }

    return (
        <main>
            <div className="bg-white shadow mb-6">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center py-6">
                        <h1 className="text-2xl font-bold text-gray-900">
                            Welcome, Admin {session.name || session.email}
                        </h1>
                        <button
                            onClick={handleLogout}
                            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-medium"
                        >
                            Logout
                        </button>
                    </div>
                </div>
            </div>

            {/* Search Bar */}
            <div className="bg-[#979793] rounded-xl shadow-md w-full max-w-3xl mx-auto mb-6 px-2 py-2">
                {/* Search input row */}
                <div className="flex items-center bg-white rounded-lg px-4 py-2 ">
                    <input
                        type="text"
                        placeholder="Search recipients..."
                        className="flex-1 outline-none text-gray-00 text-base bg-white"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                    <button
                        className="p-2 bg-cyan-500 hover:bg-cyan-600 rounded-full"
                        onClick={handleSearch}
                    >
                        <Image
                            src="/search-enter.svg"
                            alt="Search"
                            width={20}
                            height={20}
                        />
                    </button>
                </div>
            </div>

            {/* Search Results */}
            <div className="flex flex-wrap gap-4 justify-center max-w-7xl mx-auto">
                {searchResults.map((user) => (
                    <AdminUserCard
                        key={user.uid}
                        user={user}
                        onDelete={() => handleDeleteUser(user.uid)}
                        onEdit={() => {}}
                    />
                ))}
            </div>

            {/* Placeholder for Illustration - only show if no user cards */}
            {searchResults.length === 0 && (
                <div className="flex justify-center items-center p-10 rounded-lg">
                    <Image
                        src="/no-results.svg"
                        alt="Illustration"
                        width={370}
                        height={370}
                    />
                </div>
            )}
        </main>
    );
}
