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
    status?: string; // e.g., "Active"
    lastIssued?: string; // e.g., "11/09/24"
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

                arcCardsSnapshot.forEach((doc) => {
                    const card = doc.data();
                    if (card.status === "Active") activeCards++;
                    if (card.status === "Expired") expiredCards++;
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
                    return {
                        id: doc.id,
                        firstName: data.firstName,
                        secondName: data.secondName,
                        picture: data.picture, // Profile picture URL
                        status: data.banned ? "Banned" : "Active", // Determine status
                        lastIssued: data.passesIssued?.length
                            ? data.passesIssued[data.passesIssued.length - 1]
                            : "N/A", // Last issued pass
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

            {/* Placeholder for Illustration */}
            <div className="flex justify-center items-center p-10 rounded-lg">
                <Image
                    src="/icons/blankSearchPlaceholder.svg"
                    alt="Illustration"
                    width={370}
                    height={370}
                />
            </div>
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
    return (
        <div className="bg-white rounded-lg shadow-md px-4 py-3 w-full flex items-center justify-between">
            {/* User Info */}
            <div className="flex items-center gap-4">
                {/* User Avatar */}
                <div className="w-10 h-10 bg-gray-300 rounded-full overflow-hidden flex items-center justify-center">
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
                            {user.firstName[0]}
                        </span>
                    )}
                </div>

                {/* User Name */}
                <div>
                    <h2 className="text-lg font-semibold text-gray-800">
                        {user.firstName} {user.secondName}
                    </h2>
                    <p className="text-sm text-gray-500">
                        {user.status || "Unknown"}
                    </p>
                </div>
            </div>

            {/* User Details */}
            <div className="text-right">
                <p className="text-sm text-gray-500">Last issued:</p>
                <p className="text-sm text-gray-800 font-medium">
                    {user.lastIssued || "N/A"}
                </p>
            </div>
        </div>
    );
};

export default AdminDashboard;
