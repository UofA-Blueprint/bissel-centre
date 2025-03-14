"use client";

import React, { useEffect, useState } from "react"
import Image from "next/image";
import { db } from "../services/firebase"; // Import Firestore instance
import { collection, getDocs } from "firebase/firestore";


interface StatCardProps {
    icon: string;
    number: number;
    label: string;
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
          } catch (error) {
              console.error("Error fetching Firestore data:", error);
          }
      };

      fetchData();
  }, []);

    return (
        <div className="p-6 bg-gray-100 min-h-screen px-24">
            {/* Stats Section */}
            <div className="grid grid-cols-4 gap-4 mb-6 px-24">
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
            <div className="flex items-center bg-white rounded-lg shadow-md p-4 mb-6">
                <input
                    type="text"
                    placeholder="Search recipients..."
                    className="flex-1 outline-none text-gray-700 px-2"
                />
                <button className="p-2 text-blue-500">
                    <Image
                        src="/icons/searchEnter.svg"
                        alt="Search"
                        width={20}
                        height={20}
                    />
                </button>
            </div>

            {/* Buttons Section */}
            <div className="flex justify-between mb-6">
                <button className="bg-gray-600 text-white px-4 py-2 rounded-md flex items-center">
                    + New Recipient
                </button>
                <button className="flex items-center text-gray-600 px-4 py-2">
                    <Image
                        src="/icons/filter.svg"
                        alt="Filter"
                        width={20}
                        height={20}
                        className="mr-2"
                    />{" "}
                    Filters
                </button>
            </div>

            {/* Placeholder for Illustration */}
            <div className="flex justify-center items-center bg-white p-10 rounded-lg shadow-md">
                <Image
                    src="/icons/blankSearchPlaceholder.svg"
                    alt="Illustration"
                    width={160}
                    height={160}
                />
            </div>
        </div>
    );
};

const StatCard: React.FC<StatCardProps> = ({ icon, number, label }) => {
    return (
        <div className="bg-white rounded-lg shadow-md p-6 flex flex-col items-center text-center w-full max-w-xs mx-auto">
            <Image
                src={icon}
                alt={label}
                width={48}
                height={48}
                className="mb-2 w-12 h-12"
            />
            <h2 className="text-3xl font-bold">{number}</h2>
            <p className="text-gray-500 text-md mt-2">{label}</p>
        </div>
    );
};

export default AdminDashboard;
