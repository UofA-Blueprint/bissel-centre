"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
    getAdminSession,
    getAdministrativeStaff,
    deleteAdministrativeStaff,
} from "../actions";
import Fuse from "fuse.js"; // Import Fuse.js for fuzzy search
import React from "react";
import Image from "next/image";
import TopNav from "@/app/components/TopNav";
import SearchBar from "@/app/components/SearchBar";

interface User {
    id: string;
    createdAt: Date;
    createdBy: string;
    email: string;
    firstName: string;
    secondName: string;
}

interface Session {
    name?: string;
    email?: string;
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
    // const isSuperAdmin = user.customClaims?.admin === true;

    return (
        <div className="bg-white rounded-lg shadow-md px-6 py-4 w-full flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            {/* Left: Avatar + Info */}
            <div className="flex items-center gap-4 min-w-0">
                {" "}
                {/* min-w-0 helps truncation work */}
                {/* Avatar */}
                <div className="shrink-0 w-12 h-12 rounded-full overflow-hidden bg-gray-100 flex items-center justify-center">
                    <span className="text-lg font-semibold text-gray-700">
                        {user.firstName?.[0] || user.email?.[0]?.toUpperCase()}
                    </span>
                </div>
                {/* Name + Email */}
                <div className="flex flex-col min-w-0">
                    <span className="text-lg font-semibold text-gray-900 truncate">
                        {user.firstName + " " + user.secondName}
                    </span>
                    <span className="text-sm text-gray-500 truncate">
                        {user.email || "N/A"}
                    </span>
                </div>
            </div>

            {/* Right: Action buttons */}
            {/* sm:self-center keeps buttons aligned when row-mode, 
        self-end or self-start looks better in column-mode */}
            <div className="flex items-center gap-3 sm:justify-end border-t sm:border-t-0 pt-3 sm:pt-0">
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
                const users = await getAdministrativeStaff();
                // if (!usersResponse.ok) {
                //   throw new Error("Failed to fetch users");
                // }
                // const usersData = await usersResponse.json();
                setUsers(users);
                setSearchResults(users);
            } catch (err) {
                setError(
                    err instanceof Error ? err.message : "An error occurred",
                );
                // On error, redirect to home
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
            keys: ["firstName", "secondName"],
            threshold: 0.3,
        });

        const results = fuse.search(searchQuery).map((r) => r.item);
        setSearchResults(results);
    }, [searchQuery, users]);

    async function handleDeleteUser(uid: string) {
        if (!confirm("Are you sure you want to delete this user?")) {
            return;
        }
        setLoading(true);
        try {
            await deleteAdministrativeStaff(uid);

            // Remove user from local state
            setUsers(users.filter((user) => user.id !== uid));
        } catch (err) {
            setError(
                err instanceof Error ? err.message : "Failed to delete user",
            );
        }
        setLoading(false);
    }

    // const handleSearch = () => {
    //     if (!searchQuery) {
    //         setSearchResults(users);
    //         return;
    //     }
    //     const fuse = new Fuse(users, {
    //         keys: ["email", "firstName", "secondName"],
    //         threshold: 0.3,
    //     });
    //     const results = fuse.search(searchQuery).map((result) => result.item);
    //     setSearchResults(results);
    // };

    if (loading) {
        return (
            <div className="min-h-screen bg-white flex items-center justify-center">
              <div className="h-14 w-14 rounded-full border-4 border-cyan-100 border-t-cyan-500 animate-spin" />
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
        return null; // Will redirect
    }

    return (
        <main>
            <TopNav
                user={{ name: session.name, email: session.email ?? "" }}
                navItems={[{ label: "Dashboard", href: "/admin/dashboard" }]}
                homeHref="/admin/dashboard"
                logoutRedirect="/admin/login"
            />
            <div className="p-6 bg-gray-100 min-h-screen px-4 sm:px-8 md:px-16 lg:px-24">
                {/* Search Bar */}
                <SearchBar
                    value={searchQuery}
                    onChange={setSearchQuery}
                    placeholder="Search administrative staff..."
                    className="max-w-7xl mx-auto mb-6"
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

                {/* Search Results */}
                <div className="flex flex-wrap gap-4 justify-center max-w-7xl mx-auto">
                    {searchResults.map((user) => (
                        <AdminUserCard
                            key={user.id}
                            user={user}
                            onDelete={() => handleDeleteUser(user.id)}
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
            </div>
        </main>
    );
}

// <div className="p-6 bg-gray-100 min-h-screen px-24">
//     {/* Search Bar */}
//     <div className="bg-[#979793] rounded-xl shadow-md max-w-7xl mx-auto mb-6 px-2 py-2">
//         {/* Search input row */}
//         <div className="flex items-center bg-white rounded-lg px-4 py-2 mb-3">
//             <input
//                 type="text"
//                 placeholder="Search recipients..."
//                 className="flex-1 outline-none text-gray-700 text-base bg-white"
//                 value={searchQuery}
//                 onChange={(e) => setSearchQuery(e.target.value)}
//             />
//             <button
//                 className="p-2 bg-cyan-500 hover:bg-cyan-600 rounded-full"
//                 // onClick={handleSearch}
//             >
//                 <Image
//                     src="/search-enter.svg"
//                     alt="Search"
//                     width={20}
//                     height={20}
//                 />
//             </button>
//         </div>
//     </div>

//     {/* Search Results */}
//     <div className="flex flex-wrap gap-4 justify-center max-w-7xl mx-auto">
//         {searchResults.map((user) => (
//             <AdminUserCard
//                 key={user.id}
//                 user={user}
//                 onDelete={() => handleDeleteUser(user.id)}
//                 onEdit={() => {}}
//             />
//         ))}
//     </div>

//     {/* Placeholder for Illustration - only show if no user cards */}
//     {searchResults.length === 0 && (
//         <div className="flex justify-center items-center p-10 rounded-lg">
//             <Image
//                 src="/no-results.svg"
//                 alt="Illustration"
//                 width={370}
//                 height={370}
//             />
//         </div>
//     )}
// </div>;
