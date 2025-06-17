"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import { db } from "../services/firebase"; // Import Firestore instance
import { collection, getDocs } from "firebase/firestore";
import Fuse from "fuse.js"; // Import Fuse.js for fuzzy search

interface StatCardProps {
    icon: string;
    number: number;
    label: string;
}

interface User {
    id: string;
    firstName: string;
    secondName: string;
    picture?: string; // URL for the profile picture
    arcCardStatus?: string; // e.g., "Active", "Expired", or undefined
    lastIssued?: string; // e.g., "11/09/24"
    banned?: boolean;
}

const AdminDashboard = () => {
    const [stats, setStats] = useState([
        { icon: "/icons/creditCard.svg", number: 0, label: "Available Cards" },
        { icon: "/icons/check-mark.svg", number: 0, label: "Active Cards" },
        {
            icon: "/icons/alert-triangle.svg",
            number: 0,
            label: "Expired Cards",
        },
        { icon: "/icons/flag.svg", number: 0, label: "Flagged Users" },
    ]);
    const [users, setUsers] = useState<User[]>([]);
    const [searchResults, setSearchResults] = useState<User[]>([]);
    const [searchQuery, setSearchQuery] = useState("");

    useEffect(() => {
        const fetchData = async () => {
            try {
                // Fetch ARC cards
                const arcCardsSnapshot = await getDocs(
                    collection(db, "arc_cards")
                );
                let activeCards = 0;
                let expiredCards = 0;
                const availableCards = arcCardsSnapshot.size; // Total ARC cards

                // Build a lookup for arcCardNumber -> issuedAt
                const arcCardIssuedAtMap: Record<string, unknown> = {};

                arcCardsSnapshot.forEach((doc) => {
                    const card = doc.data();
                    if (card.status === "Active") activeCards++;
                    if (card.status === "Expired") expiredCards++;
                    arcCardIssuedAtMap[card.arcCardNumber] = card.issuedAt;
                });

                // Fetch banned users
                const bannedUsersSnapshot = await getDocs(
                    collection(db, "banned_users")
                );
                const flaggedUsers = bannedUsersSnapshot.size;

                // Update state with new Firestore data
                setStats([
                    {
                        icon: "/icons/creditCard.svg",
                        number: availableCards,
                        label: "Available Cards",
                    },
                    {
                        icon: "/icons/check-mark.svg",
                        number: activeCards,
                        label: "Active Cards",
                    },
                    {
                        icon: "/icons/alert-triangle.svg",
                        number: expiredCards,
                        label: "Expired Cards",
                    },
                    {
                        icon: "/icons/flag.svg",
                        number: flaggedUsers,
                        label: "Flagged Users",
                    },
                ]);

                // Fetch users
                const usersSnapshot = await getDocs(collection(db, "users"));
                const usersData: User[] = usersSnapshot.docs.map((doc) => {
                    const data = doc.data();
                    let lastIssued = "N/A";
                    let arcCardStatus: string | undefined = undefined;
                    if (
                        data.arcCardNumber &&
                        arcCardIssuedAtMap[data.arcCardNumber]
                    ) {
                        const issuedAt = arcCardIssuedAtMap[data.arcCardNumber];
                        if (
                            issuedAt &&
                            typeof (issuedAt as { toDate?: () => Date })
                                .toDate === "function"
                        ) {
                            // Firestore Timestamp object
                            const dateObj = (
                                issuedAt as { toDate: () => Date }
                            ).toDate();
                            // Format: mm/dd/yy
                            const mm = String(dateObj.getMonth() + 1).padStart(
                                2,
                                "0"
                            );
                            const dd = String(dateObj.getDate()).padStart(
                                2,
                                "0"
                            );
                            const yy = String(dateObj.getFullYear()).slice(-2);
                            lastIssued = `${mm}/${dd}/${yy}`;
                        } else if (issuedAt instanceof Date) {
                            const mm = String(issuedAt.getMonth() + 1).padStart(
                                2,
                                "0"
                            );
                            const dd = String(issuedAt.getDate()).padStart(
                                2,
                                "0"
                            );
                            const yy = String(issuedAt.getFullYear()).slice(-2);
                            lastIssued = `${mm}/${dd}/${yy}`;
                        }
                    }
                    // Find arc card status
                    if (data.arcCardNumber) {
                        const arcCardDoc = arcCardsSnapshot.docs.find(
                            (arcDoc) =>
                                arcDoc.data().arcCardNumber ===
                                data.arcCardNumber
                        );
                        arcCardStatus = arcCardDoc
                            ? arcCardDoc.data().status
                            : undefined;
                    }
                    return {
                        id: doc.id,
                        firstName: data.firstName,
                        secondName: data.secondName,
                        picture: data.picture, // Profile picture URL
                        arcCardStatus: arcCardStatus, // Status from arc card
                        lastIssued: lastIssued, // Last issued pass
                        banned: data.banned,
                    };
                });
                setUsers(usersData);
                setSearchResults(usersData); // Initialize search results
            } catch (error) {
                console.error("Error fetching Firestore data:", error);
            }
        };

        fetchData();
    }, []);

    const handleSearch = () => {
        if (!searchQuery) {
            setSearchResults(users);
            return;
        }

        const fuse = new Fuse(users, {
            keys: ["firstName", "secondName"],
            threshold: 0.3, // Adjust for fuzzy matching sensitivity
        });

        const results = fuse.search(searchQuery).map((result) => result.item);
        setSearchResults(results);
    };

    return (
        <div className="p-6 bg-gray-100 min-h-screen px-24">
            {/* Stats Section */}
            <div className="flex flex-wrap gap-4 mb-6 px-6 sm:px-12 lg:px-24 justify-center max-w-7xl mx-auto">
                {stats.map((stat, index) => (
                    <StatCard
                        key={index}
                        icon={stat.icon}
                        number={stat.number}
                        label={stat.label}
                    />
                ))}
            </div>

            {/* Search Bar */}
            <div className="bg-[#979793] rounded-xl shadow-md max-w-7xl mx-auto mb-6 px-4 py-3">
                {/* Search input row */}
                <div className="flex items-center bg-white rounded-lg px-4 py-2 mb-3">
                    <input
                        type="text"
                        placeholder="Search recipients..."
                        className="flex-1 outline-none text-gray-700 text-base bg-white"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                    <button
                        className="p-2 bg-cyan-500 hover:bg-cyan-600 rounded-full"
                        onClick={handleSearch}
                    >
                        <Image
                            src="/icons/searchEnter.svg"
                            alt="Search"
                            width={20}
                            height={20}
                        />
                    </button>
                </div>

                {/* Button row inside gray container */}
                <div className="flex justify-between items-center text-white text-sm">
                    <button className="flex items-center gap-1">
                        <span className="text-xl">＋</span> New Recipient
                    </button>
                    <button className="flex items-center gap-2">
                        <Image
                            src="/icons/filter.svg"
                            alt="Filter"
                            width={16}
                            height={16}
                        />
                        Filters
                    </button>
                </div>
            </div>

            {/* Search Results */}
            <div className="flex flex-wrap gap-4 justify-center max-w-7xl mx-auto">
                {searchResults.map((user) => (
                    <UserCard key={user.id} user={user} />
                ))}
            </div>

            {/* Placeholder for Illustration - only show if no user cards */}
            {searchResults.length === 0 && (
                <div className="flex justify-center items-center p-10 rounded-lg">
                    <Image
                        src="/icons/blankSearchPlaceholder.svg"
                        alt="Illustration"
                        width={370}
                        height={370}
                    />
                </div>
            )}
        </div>
    );
};

const StatCard: React.FC<StatCardProps> = ({ icon, number, label }) => {
    return (
        <div className="bg-white rounded-xl shadow-md px-6 py-5 w-[220px] h-[110px] flex flex-col items-center justify-center text-center">
            {/* Icon + Number */}
            <div className="flex items-center gap-2">
                <Image src={icon} alt={label} width={28} height={28} />
                <h2 className="text-2xl font-bold">{number}</h2>
            </div>

            {/* Label */}
            <p className="text-gray-600 text-base mt-2 font-medium">{label}</p>
        </div>
    );
};

const UserCard: React.FC<{ user: User }> = ({ user }) => {
    const isBanned = user.banned;
    const arcCardStatus = user.arcCardStatus;
    return (
        <div className="bg-white rounded-lg shadow-md px-6 py-4 w-full flex items-center justify-between">
            {/* Avatar */}
            <div className="w-10 h-10 bg-gray-300 rounded-full overflow-hidden flex items-center justify-center mr-4">
                {user.picture ? (
                    <Image
                        src={user.picture}
                        alt={`${user.firstName} ${user.secondName}`}
                        width={40}
                        height={40}
                        className="rounded-full object-cover"
                    />
                ) : (
                    <span className="text-lg font-bold text-gray-700">
                        {user.firstName}
                    </span>
                )}
            </div>
            {/* Name and Info Row */}
            <div className="flex-1 flex flex-col sm:flex-row items-start sm:items-center min-w-0">
                <span className="text-xl font-bold text-gray-900 truncate">
                    {user.firstName} {user.secondName}
                </span>
                <div className="sm:ml-auto flex flex-row sm:flex-row flex-wrap items-center sm:items-center text-right min-w-[180px] gap-2 sm:gap-4 mt-2 sm:mt-0 w-full sm:w-auto">
                    {/* Status and Banned Flag */}
                    <span
                        className={`flex items-center text-base font-medium ${
                            arcCardStatus === "Expired"
                                ? "text-red-500"
                                : arcCardStatus === "Active"
                                ? "text-gray-500"
                                : "text-gray-500"
                        }`}
                    >
                        {isBanned && (
                            <Image
                                src="/icons/flag.svg"
                                alt="Flagged"
                                width={15}
                                height={15}
                                className="mr-2"
                            />
                        )}
                        {arcCardStatus === "Expired" ? (
                            <>
                                <Image
                                    src="/icons/alert-triangle.svg"
                                    alt="Expired"
                                    width={18}
                                    height={18}
                                    className="mr-1"
                                />
                                <span>Expired</span>
                            </>
                        ) : arcCardStatus === "Active" ? (
                            <span>Active</span>
                        ) : (
                            <span>N/A</span>
                        )}
                    </span>
                    {/* Last Issued Date */}
                    <span className="text-base text-gray-500 font-normal whitespace-nowrap">
                        Last issued:{" "}
                        <span className="text-gray-800 font-medium">
                            {user.lastIssued || "N/A"}
                        </span>
                    </span>
                </div>
            </div>
        </div>
    );
};

export default AdminDashboard;
