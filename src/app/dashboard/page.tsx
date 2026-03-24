"use client";

import { useState, useEffect } from "react";
import { auth, db } from "../services/firebase";
import Image from "next/image";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Fuse from "fuse.js";
import { collection, getDocs } from "firebase/firestore";
import { signOut } from "firebase/auth";
import { getAllUsers } from "@/app/services/userService";
import { getAllArcCards } from "@/app/services/arcCardService";
import RegisterRecipientModal from "@/app/components/register_recipient/RegisterRecipientModal";

interface StatCardProps {
  icon: string;
  number: number;
  label: string;
}

interface User {
  id: string;
  firstName: string;
  secondName: string;
  picture?: string;
  genderIdentity: string;
  aliases: string[];
  dateOfBirth: string;
  arcCardNumber?: string;
  address: string;
  postalCode: string;
  passesIssued: string[];
  banned: boolean;
  banReason?: string;
  notes?: string;
  status?: "Active" | "Inactive"; // Account status (different from banned)
  createdAt: Date | string;
  createdBy: string;
  updatedAt?: Date | string;
  email?: string;
  phoneNumber?: string;
  arcCardStatus: "Active" | "Unattributed" | "Expired" | "Unloaded" | undefined;
  lastIssued: string;
}

interface SessionUser {
  name?: string;
  email: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const [sessionUser, setSessionUser] = useState<SessionUser | null>(null);
  const [stats, setStats] = useState([
    { icon: "/card.svg", number: 0, label: "Available Cards" },
    { icon: "/checkmark.svg", number: 0, label: "Active Cards" },
    {
      icon: "/caution.svg",
      number: 0,
      label: "Expired Cards",
    },
    { icon: "/flag.svg", number: 0, label: "Flagged Users" },
  ]);
  const [users, setUsers] = useState<User[]>([]);
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const sessionResponse = await fetch("/api/user-session");
        if (!sessionResponse.ok) {
          router.replace("/login");
          return;
        }

        const sessionData = await sessionResponse.json();
        if (sessionData.admin) {
          router.replace("/admin/dashboard");
          return;
        }

        setSessionUser({
          name: sessionData.name,
          email: sessionData.email,
        });

        // Fetch ARC Cards
        const arcCards = await getAllArcCards();

        const availableCards = arcCards.length;
        const activeCards = arcCards.filter(
          (c) => c.status === "Active",
        ).length;
        const expiredCards = arcCards.filter(
          (c) => c.status === "Expired",
        ).length;

        // Create lookup: cardNumber → card object
        const arcCardMap = Object.fromEntries(
          arcCards.map((card) => [card.arcCardNumber, card]),
        );

        // Fetch banned users count
        const bannedSnapshot = await getDocs(collection(db, "banned_users"));
        const flaggedUsers = bannedSnapshot.size;

        //f etch users
        const users = await getAllUsers();

        // Attach computed fields: lastIssued + arcCardStatus
        const usersData = users.map((user) => {
          const card = user.arcCardNumber
            ? arcCardMap[user.arcCardNumber]
            : null;

          // ARC Card Status
          const arcCardStatus = card?.status ?? undefined;

          // Last issued pass date (mm/dd/yy)
          let lastIssued = "N/A";
          if (card?.issuedAt instanceof Date) {
            const mm = String(card.issuedAt.getMonth() + 1).padStart(2, "0");
            const dd = String(card.issuedAt.getDate()).padStart(2, "0");
            const yy = String(card.issuedAt.getFullYear()).slice(-2);
            lastIssued = `${mm}/${dd}/${yy}`;
          }

          return {
            ...user,
            // id: user.id,
            // firstName: user.firstName,
            // secondName: user.secondName,
            // picture: user.picture,
            // banned: user.banned,
            arcCardStatus,
            lastIssued,
          };
        });

        // Update Dashboard Stats
        setStats([
          {
            icon: "/card.svg",
            number: availableCards,
            label: "Available Cards",
          },
          {
            icon: "/checkmark.svg",
            number: activeCards,
            label: "Active Cards",
          },
          {
            icon: "/caution.svg",
            number: expiredCards,
            label: "Expired Cards",
          },
          {
            icon: "/flag.svg",
            number: flaggedUsers,
            label: "Flagged Users",
          },
        ]);

        // Update Users Table
        setUsers(usersData);
      } catch (error) {
        console.error("Error fetching dashboard data:", error);
      }
    };

    fetchData();
  }, [router]);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults(users);
      return;
    }

    const fuse = new Fuse(users, {
      keys: ["firstName", "secondName", "email"],
      threshold: 0.3,
    });

    const results = fuse.search(searchQuery).map((r) => r.item);
    setSearchResults(results);
  }, [searchQuery, users]);

  const handleGoToCards = () => {
    document.cookie = "cards_access=1; Path=/; Max-Age=600; SameSite=Lax";
    router.push("/cards");
  };

  const handleLogout = async () => {
    try {
      await fetch("/api/logout", { method: "POST" });
      await signOut(auth);
      router.replace("/login");
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  return (
    <main>
      <div className="bg-white shadow mb-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <h1 className="text-2xl font-bold text-gray-900">
              Welcome, {sessionUser?.name || sessionUser?.email || "Staff"}
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
        <div className="bg-[#979793] rounded-xl shadow-md max-w-7xl mx-auto mb-6 px-2 py-2">
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
              // onClick={handleSearch}
            >
              <Image
                src="/search-enter.svg"
                alt="Search"
                width={20}
                height={20}
              />
            </button>
          </div>

          {/* Button row inside gray container */}
          <div className="flex justify-between items-center text-white text-sm">
            <button
              className="flex items-center gap-1"
              onClick={() => setIsModalOpen(true)}
            >
              <span className="text-xl">＋</span> New Recipient
            </button>
            <div className="flex items-center gap-4">
              <Link
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  handleGoToCards();
                }}
                className="flex items-center gap-2 rounded-lg border border-white/40 px-3 py-1.5 hover:bg-white/10 transition-colors"
              >
                <Image src="/card.svg" alt="ARC Cards" width={16} height={16} />
                ARC Cards
              </Link>
              <button className="flex items-center gap-2">
                <Image src="/filter.svg" alt="Filter" width={16} height={16} />
                Filters
              </button>
            </div>
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
              src="/no-results.svg"
              alt="Illustration"
              width={370}
              height={370}
            />
          </div>
        )}
      </div>
      <RegisterRecipientModal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </main>
  );
}

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
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = "none";
            }}
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
                src="/flag.svg"
                alt="Flagged"
                width={15}
                height={15}
                className="mr-2"
              />
            )}
            {arcCardStatus === "Expired" ? (
              <>
                <Image
                  src="/caution.svg"
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
