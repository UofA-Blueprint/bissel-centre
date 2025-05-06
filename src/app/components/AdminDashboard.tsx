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
                    />
                    <button className="p-2 bg-cyan-500 hover:bg-cyan-600 rounded-full">
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

export default AdminDashboard;
