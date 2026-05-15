/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Fuse from "fuse.js";
import RegisterRecipientModal from "@/app/components/register_recipient/RegisterRecipientModal";
import Header from "@/app/components/Header";

interface StatCardProps {
  icon: string;
  number: number;
  label: string;
}

interface StatCardComponentProps extends StatCardProps {
  isLoading?: boolean;
}

interface User {
  id: string;
  firstName: string;
  secondName: string;
  picture?: string;
  genderIdentity: string;
  aliases: string[];
  dateOfBirth: string;
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

interface DashboardSummaryResponse {
  viewer: {
    uid: string;
    email: string;
    name: string;

  };
  stats: StatCardProps[];
  users: User[];
}

export default function DashboardPage() {
  const router = useRouter();
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
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {

        const dashboardResponse = await fetch("/api/dashboard/summary", {
          cache: "no-store",
        });

        if (!dashboardResponse.ok) {
          if (dashboardResponse.status === 401) {
            router.replace("/login");
            return;
          }
          throw new Error("Failed to load dashboard summary");
        }

        const summary =
          (await dashboardResponse.json()) as DashboardSummaryResponse;

        setSessionUser({
          name: summary.viewer.name,
          email: summary.viewer.email
        })

        setStats(summary.stats);
        setUsers(summary.users);
      } catch (error) {
        console.error("Error fetching dashboard data:", error);
      } finally {
        setIsLoading(false);
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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="h-14 w-14 rounded-full border-4 border-cyan-100 border-t-cyan-500 animate-spin" />
      </div>
    );
  }

  return (
    <main>
      <Header title="" />
      <div className="p-6 bg-gray-100 min-h-screen px-24">
        {/* Stats Section */}
        <div className="grid grid-cols-4 gap-4 mb-6 max-w-7xl mx-auto">
          {stats.map((stat, index) => (
            <StatCard
              key={index}
              icon={stat.icon}
              number={stat.number}
              label={stat.label}
              isLoading={isLoading}
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
        {isLoading ? (
          <div className="flex flex-col gap-4 max-w-7xl mx-auto">
            {Array.from({ length: 5 }).map((_, i) => (
              <UserCardSkeleton key={i} />
            ))}
          </div>
        ) : (
          <>
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
          </>
        )}
      </div>
      <RegisterRecipientModal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </main>
  );
}

const StatCard: React.FC<StatCardComponentProps> = ({
  icon,
  number,
  label,
  isLoading,
}) => {
  if (isLoading) {
    return (
      <div className="bg-gray-200 rounded-xl shadow-sm w-full h-[120px] animate-pulse" />
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm px-5 py-4 w-full h-[120px] flex flex-col items-center justify-center text-center">
      {/* Icon + Number */}
      <div className="flex items-center gap-2">
        <Image src={icon} alt={label} width={24} height={24} />
        <h2 className="text-2xl font-bold">{number}</h2>
      </div>

      {/* Label */}
      <p className="text-gray-600 text-sm mt-2 font-medium">{label}</p>
    </div>
  );
};

const UserCardSkeleton: React.FC = () => {
  return (
    <div className="bg-white rounded-lg shadow-md px-6 py-4 w-full flex items-center justify-between animate-pulse">
      {/* Avatar */}
      <div className="w-10 h-10 bg-gray-200 rounded-full mr-4" />
      {/* Name + status placeholders */}
      <div className="flex-1 flex items-center justify-between">
        <div className="h-5 w-40 bg-gray-200 rounded" />
        <div className="flex items-center gap-4">
          <div className="h-4 w-16 bg-gray-200 rounded" />
          <div className="h-4 w-32 bg-gray-200 rounded" />
        </div>
      </div>
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
            className="rounded-full object-cover w-[40px] h-[40px]"
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
