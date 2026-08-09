/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Fuse from "fuse.js";
import { Flag } from "lucide-react";
import RegisterRecipientModal from "@/app/components/register_recipient/RegisterRecipientModal";
import SearchBar from "@/app/components/SearchBar";
import StaffOnlyNotice from "@/app/components/StaffOnlyNotice";
import StaffSelector from "../StaffSelector";
import { useIsViewOnly } from "../ViewModeContext";

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
  stats: StatCardProps[];
  users: User[];
}

const DASHBOARD_CACHE_TTL_MS = 30_000;
let dashboardSummaryCache: {
  data: DashboardSummaryResponse;
  timestampMs: number;
} | null = null;

export default function DashboardPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isViewOnly = useIsViewOnly();
  const createdByFilter = searchParams.get("createdBy");
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
  const [forbidden, setForbidden] = useState(false);
  const [refreshNonce, setRefreshNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const fetchData = async () => {
      const cachedSummary = dashboardSummaryCache;
      const now = Date.now();
      const hasWarmCache =
        refreshNonce === 0 &&
        cachedSummary !== null &&
        now - cachedSummary.timestampMs < DASHBOARD_CACHE_TTL_MS;

      if (hasWarmCache) {
        setStats(cachedSummary.data.stats);
        setUsers(cachedSummary.data.users);
        setIsLoading(false);
      } else {
        setIsLoading(true);
      }

      try {
        setForbidden(false);

        const dashboardResponse = await fetch("/api/dashboard/summary", {
          cache: "no-store",
        });

        if (!dashboardResponse.ok) {
          if (dashboardResponse.status === 401) {
            router.replace("/login");
            return;
          }
          if (dashboardResponse.status === 403) {
            // Signed in, but not administrative staff (e.g. an IT admin).
            setForbidden(true);
            return;
          }
          throw new Error("Failed to load dashboard summary");
        }

        const summary =
          (await dashboardResponse.json()) as DashboardSummaryResponse;

        if (cancelled) return;

        setStats(summary.stats);
        setUsers(summary.users);
        dashboardSummaryCache = {
          data: summary,
          timestampMs: Date.now(),
        };
      } catch (error) {
        if (cancelled) return;
        console.error("Error fetching dashboard data:", error);
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    fetchData();
    return () => {
      cancelled = true;
    };
  }, [router, refreshNonce]);

  useEffect(() => {
    const filtered = createdByFilter
      ? users.filter((u) => u.createdBy === createdByFilter)
      : users;

    if (!searchQuery.trim()) {
      setSearchResults(filtered);
      return;
    }

    const fuse = new Fuse(filtered, {
      keys: ["firstName", "secondName", "email"],
      threshold: 0.3,
    });

    const results = fuse.search(searchQuery).map((r) => r.item);
    setSearchResults(results);
  }, [searchQuery, users, createdByFilter]);

  const handleGoToCards = () => {
    router.push("/cards");
  };

  if (forbidden) {
    return (
      <main className="bg-gray-100 min-h-screen">
        <StaffOnlyNotice />
      </main>
    );
  }

  return (
    <main className="lg:h-screen lg:flex lg:flex-col">
      <div className="p-6 bg-gray-100 min-h-screen px-4 sm:px-8 md:px-16 lg:px-24 lg:min-h-0 lg:flex-1 lg:flex lg:flex-col lg:overflow-hidden">
        {isViewOnly && (
          <div className="max-w-7xl mx-auto w-full mb-3 flex items-center justify-between gap-3">
            <StaffSelector queryParam="createdBy" label="Recipients by" />
            {createdByFilter && (
              <span className="text-xs text-gray-500">
                {searchResults.length} recipient
                {searchResults.length === 1 ? "" : "s"} match this filter
              </span>
            )}
          </div>
        )}

        {/* Stats Section */}
        <div className="flex gap-3 overflow-x-auto snap-x snap-mandatory [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:grid sm:grid-cols-4 sm:gap-4 sm:overflow-visible mb-4 sm:mb-6 max-w-7xl mx-auto w-full lg:shrink-0">
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
        <SearchBar
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Search recipients..."
          className="max-w-7xl mx-auto mb-4 sm:mb-6 sticky top-0 z-20 lg:static lg:z-auto lg:shrink-0"
        >
          <button
            className="flex items-center gap-1 whitespace-nowrap hover:opacity-75 transition-opacity"
            onClick={() => setIsModalOpen(true)}
          >
            <span className="text-sm">＋ New Recipient </span>
          </button>
          <div className="flex items-center gap-2 sm:gap-4 ml-2">
            <Link
              href="#"
              onClick={(e) => {
                e.preventDefault();
                handleGoToCards();
              }}
              className="flex items-center gap-2 whitespace-nowrap rounded-lg bg-primary text-white font-medium px-2.5 py-1 sm:px-3 sm:py-1.5 hover:bg-cyan-600 transition-colors"
            >
              <Image
                src="/card.svg"
                alt="ARC Cards"
                width={16}
                height={16}
                className="brightness-0 invert"
              />
              ARC Cards
            </Link>
            <button className="flex items-center gap-2 whitespace-nowrap rounded-lg px-2.5 py-1 sm:px-3 sm:py-1.5 hover:bg-white/10 transition-colors">
              <Image src="/filter.svg" alt="Filter" width={16} height={16} />
              Filters
            </button>
          </div>
        </SearchBar>
        <div className="max-w-7xl mx-auto w-full -mt-2 mb-4 sm:mb-6 flex justify-center">
          <span className="inline-flex items-center rounded-full bg-primary px-3 py-1 text-sm font-medium text-white shadow-sm text-center">
            If the dashboard doesn&apos;t reflect the latest updates, please refresh.
          </span>
        </div>

        {/* Search Results - scrollable region on lg+ */}
        <div className="max-w-7xl mx-auto w-full lg:flex-1 lg:min-h-0 lg:overflow-y-auto">
          {isLoading ? (
            <div className="flex flex-col gap-2 sm:gap-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <UserCardSkeleton key={i} />
              ))}
            </div>
          ) : (
            <>
              <div className="flex flex-wrap gap-2 sm:gap-4 justify-center">
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
      </div>
      <RegisterRecipientModal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={() => {
          setIsLoading(true);
          setRefreshNonce((prev) => prev + 1);
        }}
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
  const cardShadow =
    "shadow-sm sm:shadow-[13px_3px_29px_0_rgba(0,0,0,0.04),52px_14px_53px_0_rgba(0,0,0,0.03)]";
  const cardBorder = "border-[0.5px] border-[#9C9C98]/25";

  if (isLoading) {
    return (
      <div
        className={`bg-gray-200 rounded-xl ${cardBorder} ${cardShadow} snap-start shrink-0 w-[150px] sm:w-full h-[120px] animate-pulse`}
      />
    );
  }

  return (
    <div
      className={`bg-white rounded-xl ${cardBorder} ${cardShadow} snap-start shrink-0 w-[150px] sm:w-full px-5 py-4 h-[120px] flex flex-col items-center justify-center text-center`}
    >
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
    <div className="bg-white rounded-lg shadow-[2px_4px_14.2px_0_rgba(0,0,0,0.05)] px-4 py-2.5 sm:px-6 sm:py-4 w-full flex items-center justify-between animate-pulse">
      {/* Avatar */}
      <div className="w-9 h-9 sm:w-12 sm:h-12 bg-gray-200 rounded-full mr-3 sm:mr-4 shrink-0" />
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
  const [imgError, setImgError] = useState(false);
  const initial = user.firstName?.trim().charAt(0).toUpperCase() || "?";
  const showImage = user.picture && !imgError;
  const userStatusText = user.status === "Inactive" ? "Inactive User" : "Active User";
  const cardStatusText =
    arcCardStatus === "Active"
      ? "Card Active"
      : arcCardStatus === "Unloaded"
        ? "Card Assigned but Unloaded"
      : arcCardStatus === "Expired"
        ? "Card Expired"
        : "No Active Card";
  return (
    <div className="bg-white rounded-lg shadow-[2px_4px_14.2px_0_rgba(0,0,0,0.05)] px-4 py-2.5 sm:px-6 sm:py-4 w-full flex items-center justify-between">
      {/* Avatar */}
      <div className="w-9 h-9 sm:w-12 sm:h-12 shrink-0 bg-gray-200 rounded-full overflow-hidden flex items-center justify-center mr-3 sm:mr-4">
        {showImage ? (
          <Image
            src={user.picture as string}
            alt={`${user.firstName} ${user.secondName}`}
            width={48}
            height={48}
            className="rounded-full object-cover w-9 h-9 sm:w-12 sm:h-12"
            onError={() => setImgError(true)}
          />
        ) : (
          <span className="text-base sm:text-xl font-bold text-gray-700">
            {initial}
          </span>
        )}
      </div>
      {/* Name and Info Row */}
      <div className="flex-1 flex flex-col sm:flex-row sm:items-center min-w-0 gap-2">
        <div className="flex-1 min-w-0 flex items-center gap-2">
          {isBanned && <Flag className="h-4 w-4 text-red-500 shrink-0" aria-label="Flagged user" />}
          <span className="min-w-0 text-base sm:text-xl font-bold text-gray-900 truncate">
            {user.firstName} {user.secondName}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-6">
          <div className="min-w-0 sm:min-w-[120px] text-left sm:text-right text-xs sm:text-base font-medium text-gray-600">
            {userStatusText}
          </div>
          <div
            className={`min-w-0 sm:min-w-[130px] text-left sm:text-right text-xs sm:text-base font-medium ${
              cardStatusText === "Card Expired" ? "text-red-500" : "text-gray-500"
            }`}
          >
            {cardStatusText}
          </div>
        </div>
      </div>
    </div>
  );
};
