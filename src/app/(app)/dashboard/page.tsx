/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Flag, Search, XCircle } from "lucide-react";
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
  flagged?: boolean;
  flagReason?: string;
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
  nextCursor: string | null;
  total: number;
}

interface SearchApiResult {
  id: string;
  name: string;
  aliases?: string[];
  dateOfBirth?: string;
  postalCode?: string;
  banned?: boolean;
  flagged?: boolean;
  flagReason?: string;
  banReason?: string;
  status?: string;
  picture?: string;
  arcCardStatus?: User["arcCardStatus"];
}

const USERS_PAGE_SIZE = 60;

// ?register= carries a small running index (1, 2, 3, …) per tab session.
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
  // Search-first mode lives behind /dashboard?search=... — presence of the
  // param (even empty) switches the page into the dense results view.
  const searchParam = searchParams.get("search");
  const isSearchMode = searchParam !== null;
  // Register modal lives behind ?register=<index>&step=N — the running
  // index keys the draft in sessionStorage so multiple drafts coexist and
  // reloads or history navigation restore the right one.
  const [stats, setStats] = useState([
    { icon: "/card.svg", number: 0, label: "Available Cards" },
    { icon: "/checkmark.svg", number: 0, label: "Active Cards" },
    {
      icon: "/caution.svg",
      number: 0,
      label: "Expired Cards",
    },
    { icon: "/flag.svg", number: 0, label: "Flagged Users" },
    { icon: "/flag.svg", number: 0, label: "Banned Users" },
  ]);
  const [users, setUsers] = useState<User[]>([]);
  const [nextUsersCursor, setNextUsersCursor] = useState<string | null>(null);
  const [totalUsers, setTotalUsers] = useState(0);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
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
        setNextUsersCursor(cachedSummary.data.nextCursor);
        setTotalUsers(cachedSummary.data.total);
        setIsLoading(false);
      } else {
        setIsLoading(true);
      }

      try {
        setForbidden(false);

        const dashboardResponse = await fetch(
          `/api/dashboard/summary?limit=${USERS_PAGE_SIZE}`,
          { cache: "no-store" },
        );

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
        setNextUsersCursor(summary.nextCursor ?? null);
        setTotalUsers(summary.total ?? summary.users.length);
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

  // Server-side search: debounced call to /api/users/search (folding +
  // fuzzy + phonetic over names AND aliases), then map the returned ids
  // onto the already-loaded user objects to keep card status fields.
  useEffect(() => {
    const filtered = createdByFilter
      ? users.filter((u) => u.createdBy === createdByFilter)
      : users;

    const query = searchQuery.trim();
    if (query.length < 2) {
      setSearchResults(filtered);
      return;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/users/search?q=${encodeURIComponent(query)}`,
          { signal: controller.signal },
        );
        if (!res.ok) return; // keep current results on error
        const data = (await res.json()) as {
          ids?: string[];
          results?: SearchApiResult[];
        };
        // Prefer the locally-loaded user object (it has full card state);
        // users beyond the loaded pages render from the server-hydrated
        // result so pagination never hides a search hit.
        const localById = new Map(filtered.map((u) => [u.id, u] as const));
        const rows: User[] = [];
        for (const r of data.results ?? []) {
          const local = localById.get(r.id);
          if (local) {
            rows.push(local);
          } else if (!createdByFilter) {
            rows.push({
              id: r.id,
              firstName: r.name,
              secondName: "",
              picture: r.picture ?? "",
              genderIdentity: "",
              aliases: r.aliases ?? [],
              dateOfBirth: r.dateOfBirth ?? "",
              address: "",
              postalCode: r.postalCode ?? "",
              passesIssued: [],
              banned: Boolean(r.banned),
              flagged: Boolean(r.flagged),
              flagReason: r.flagReason,
              banReason: r.banReason,
              status: r.status === "Inactive" ? "Inactive" : "Active",
              createdAt: "",
              createdBy: "",
              arcCardStatus: r.arcCardStatus,
              lastIssued: "N/A",
            });
          }
        }
        setSearchResults(rows);
      } catch {
        // aborted (new keystroke) — newer request will set results
      }
    }, 300);

    return () => {
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [searchQuery, users, createdByFilter]);

  const handleGoToCards = () => {
    router.push("/cards");
  };

  const loadMoreUsers = async () => {
    if (!nextUsersCursor || isLoadingMore) return;
    setIsLoadingMore(true);
    try {
      const res = await fetch(
        `/api/dashboard/summary?limit=${USERS_PAGE_SIZE}&cursor=${encodeURIComponent(nextUsersCursor)}`,
        { cache: "no-store" },
      );
      if (!res.ok) return;
      const page = (await res.json()) as DashboardSummaryResponse;
      setUsers((prev) => {
        const seen = new Set(prev.map((u) => u.id));
        return [...prev, ...page.users.filter((u) => !seen.has(u.id))];
      });
      setNextUsersCursor(page.nextCursor ?? null);
      if (typeof page.total === "number") setTotalUsers(page.total);
    } finally {
      setIsLoadingMore(false);
    }
  };

  // Keep the input in sync with the URL so back/forward and shared links
  // restore the search without a reload.
  useEffect(() => {
    setSearchQuery((prev) => {
      const fromUrl = searchParam ?? "";
      return fromUrl !== prev ? fromUrl : prev;
    });
  }, [searchParam]);

  const urlWithSearch = (q: string) => {
    const params = new URLSearchParams(window.location.search);
    params.set("search", q);
    return `/dashboard?${params.toString()}`;
  };

  // First keystroke on the normal dashboard pushes ONE history entry into
  // search mode (so browser-back returns to /dashboard); edits inside search
  // mode replace in place so history isn't spammed per keystroke.
  const enterSearchMode = (q: string) => {
    setSearchQuery(q);
    window.history.pushState(null, "", urlWithSearch(q));
  };

  const updateSearchUrl = (q: string) => {
    setSearchQuery(q);
    window.history.replaceState(null, "", urlWithSearch(q));
  };

  const exitSearchMode = () => {
    const params = new URLSearchParams(window.location.search);
    params.delete("search");
    const qs = params.toString();
    router.push(qs ? `/dashboard?${qs}` : "/dashboard");
  };

  // ── Register modal URL handlers ─────────────────────────────────

  const openRegisterModal = () => {
    setEditingUserId(null);
    setIsModalOpen(true);
  };

  if (forbidden) {
    return (
      <main className="bg-gray-100 min-h-screen">
        <StaffOnlyNotice />
      </main>
    );
  }

  if (isSearchMode) {
    return (
      <main className="min-h-screen bg-gray-100">
        <div className="px-3 py-3 sm:px-6">
          {/* Top bar: back · slim long search · actions on the right */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={exitSearchMode}
              title="Back to dashboard"
              className="shrink-0 rounded-md p-2 text-gray-500 hover:bg-gray-200 hover:text-gray-700"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
              <input
                autoFocus
                type="search"
                value={searchQuery}
                onChange={(e) => updateSearchUrl(e.target.value)}
                onKeyDown={(e) => {
                  // Backspace on an already-empty query exits search mode.
                  if (e.key === "Backspace" && e.currentTarget.value === "") {
                    e.preventDefault();
                    exitSearchMode();
                  }
                }}
                placeholder="Search recipients by name or alias..."
                className="w-full rounded-md border border-gray-300 bg-white py-1.5 pl-8 pr-3 text-sm text-gray-800 placeholder-gray-400 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
              />
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                disabled={isViewOnly}
                onClick={() => {
                  if (!isViewOnly) openRegisterModal();
                }}
                title={
                  isViewOnly
                    ? "Sign in as administrative staff to add recipients."
                    : undefined
                }
                className={`rounded-md px-3 py-1.5 text-sm font-medium whitespace-nowrap ${
                  isViewOnly
                    ? "cursor-not-allowed bg-gray-200 text-gray-400"
                    : "bg-primary text-white hover:bg-cyan-600"
                }`}
              >
                ＋ New Recipient
              </button>
              <button
                type="button"
                className="flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
              >
                <Image src="/filter.svg" alt="" width={14} height={14} />
                Filters
              </button>
            </div>
          </div>

          {/* Count */}
          <p className="mt-2 px-1 text-xs text-gray-500">
            {isLoading
              ? "Loading…"
              : `${searchResults.length} / ${totalUsers || users.length} shown`}
          </p>

          {/* Dense, full-width, table-like results */}
          <div className="mt-1 overflow-hidden rounded-lg border border-gray-200 bg-white">
            <div className="grid grid-cols-[minmax(0,3fr)_minmax(0,1fr)] gap-x-3 border-b border-gray-200 bg-gray-50 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500 sm:grid-cols-[minmax(0,3fr)_repeat(3,minmax(0,1fr))]">
              <span>Name</span>
              <span className="hidden sm:block">Date of birth</span>
              <span className="hidden sm:block">Status</span>
              <span>Card</span>
            </div>
            {isLoading ? (
              <div className="px-3 py-6 text-center text-sm text-gray-400">
                Loading recipients…
              </div>
            ) : searchResults.length === 0 ? (
              <div className="px-3 py-6 text-center text-sm text-gray-400">
                No recipients match this search.
              </div>
            ) : (
              <ul className="divide-y divide-gray-100">
                {searchResults.map((user) => (
                  <SearchResultRow key={user.id} user={user} />
                ))}
              </ul>
            )}
          </div>
          {!searchQuery.trim() && nextUsersCursor && !isLoading && (
            <div className="flex justify-center py-3">
              <button
                type="button"
                onClick={() => void loadMoreUsers()}
                disabled={isLoadingMore}
                className="rounded-md border border-gray-300 bg-white px-4 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                {isLoadingMore
                  ? "Loading…"
                  : `Load more (${users.length} of ${totalUsers})`}
              </button>
            </div>
          )}
        </div>
        <RegisterRecipientModal
          open={isModalOpen}
          mode={editingUserId ? "edit" : "create"}
          recipientId={editingUserId ?? undefined}
          onClose={() => {
            setIsModalOpen(false);
            setEditingUserId(null);
          }}
          onSuccess={() => {
            setIsLoading(true);
            setRefreshNonce((prev) => prev + 1);
          }}
        />
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
          onChange={enterSearchMode}
          placeholder="Search recipients..."
          className="max-w-7xl mx-auto mb-4 sm:mb-6 sticky top-0 z-20 lg:static lg:z-auto lg:shrink-0"
        >
          <button
            className={`flex items-center gap-1 whitespace-nowrap transition-opacity ${
              isViewOnly ? "cursor-not-allowed opacity-40" : "hover:opacity-75"
            }`}
            onClick={() => {
              if (isViewOnly) return;
              openRegisterModal();
            }}
            disabled={isViewOnly}
            title={
              isViewOnly
                ? "Sign in as administrative staff to add recipients."
                : undefined
            }
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
        <div className="max-w-7xl mx-auto w-full -mt-2 mb-3 flex justify-end">
          <span className="text-xs text-gray-400">
            Not seeing the latest updates? Refresh the page.
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
                  <UserCard
                    key={user.id}
                    user={user}
                    isViewOnly={isViewOnly}
                    onEdit={() => {
                      setEditingUserId(user.id);
                      setIsModalOpen(true);
                    }}
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

              {!searchQuery.trim() && nextUsersCursor && (
                <div className="flex justify-center py-4">
                  <button
                    type="button"
                    onClick={() => void loadMoreUsers()}
                    disabled={isLoadingMore}
                    className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 shadow-sm hover:bg-gray-50 disabled:opacity-50"
                  >
                    {isLoadingMore
                      ? "Loading…"
                      : `Load more (${users.length} of ${totalUsers})`}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
      <RegisterRecipientModal
        open={isModalOpen}
        mode={editingUserId ? "edit" : "create"}
        recipientId={editingUserId ?? undefined}
        onClose={() => {
          setIsModalOpen(false);
          setEditingUserId(null);
        }}
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

// Dense row for the search-first (?search=) view — small height, full width.
// Clicking a row opens that recipient's filtered view in /reports?search=.
const SearchResultRow: React.FC<{ user: User }> = ({ user }) => {
  const router = useRouter();
  const [imgError, setImgError] = useState(false);
  const showImage = user.picture && !imgError;
  const initial = user.firstName?.trim().charAt(0).toUpperCase() || "?";
  const fullName = `${user.firstName ?? ""} ${user.secondName ?? ""}`.trim();
  const cardStatusText =
    user.arcCardStatus === "Active"
      ? "Active"
      : user.arcCardStatus === "Unloaded"
        ? "Assigned · Unloaded"
        : user.arcCardStatus === "Expired"
          ? "Expired"
          : "None";

  return (
    <li
      role="button"
      tabIndex={0}
      title={`View ${fullName || "recipient"} in reports`}
      onClick={() =>
        router.push(`/reports?userId=${encodeURIComponent(user.id)}`)
      }
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          router.push(`/reports?userId=${encodeURIComponent(user.id)}`);
        }
      }}
      className="grid cursor-pointer grid-cols-[minmax(0,3fr)_minmax(0,1fr)] items-center gap-x-3 px-3 py-1.5 text-sm hover:bg-cyan-50/40 sm:grid-cols-[minmax(0,3fr)_repeat(3,minmax(0,1fr))]"
    >
      <div className="flex min-w-0 items-center gap-2">
        <div className="flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gray-200">
          {showImage ? (
            <Image
              src={user.picture as string}
              alt=""
              width={24}
              height={24}
              className="h-6 w-6 rounded-full object-cover"
              onError={() => setImgError(true)}
            />
          ) : (
            <span className="text-[10px] font-bold text-gray-600">
              {initial}
            </span>
          )}
        </div>
        {user.banned && (
          <Flag
            className="h-3.5 w-3.5 shrink-0 text-red-500"
            aria-label="Flagged user"
          />
        )}
        <span className="truncate font-medium text-gray-900">
          {user.firstName} {user.secondName}
        </span>
        {user.aliases?.length > 0 && (
          <span className="hidden truncate text-xs text-gray-400 md:inline">
            aka {user.aliases.join(", ")}
          </span>
        )}
      </div>
      <span className="hidden truncate text-gray-600 sm:block">
        {user.dateOfBirth || "—"}
      </span>
      <span className="hidden truncate text-gray-600 sm:block">
        {user.status === "Inactive" ? "Inactive" : "Active"}
      </span>
      <span
        className={`truncate ${
          user.arcCardStatus === "Expired" ? "text-red-500" : "text-gray-600"
        }`}
      >
        {cardStatusText}
      </span>
    </li>
  );
};

const UserCard: React.FC<{
  user: User;
  onEdit: () => void;
  isViewOnly: boolean;
}> = ({ user, onEdit, isViewOnly }) => {
  const router = useRouter();
  const isBanned = user.banned;
  const isFlagged = user.flagged === true;
  const arcCardStatus = user.arcCardStatus;
  const [imgError, setImgError] = useState(false);
  const initial = user.firstName?.trim().charAt(0).toUpperCase() || "?";
  const showImage = user.picture && !imgError;
  const openReports = () =>
    router.push(`/reports?userId=${encodeURIComponent(user.id)}`);
  const userStatusText = isBanned
    ? "Banned User"
    : isFlagged
      ? "Flagged and Active User"
      : user.status === "Inactive"
        ? "Inactive User"
        : "Active User";
  const cardStatusText =
    arcCardStatus === "Active"
      ? "Card Active"
      : arcCardStatus === "Unloaded"
        ? "Card Assigned but Unloaded"
        : arcCardStatus === "Expired"
          ? "Card Expired"
          : "No Active Card";
  return (
    <div
      role="button"
      tabIndex={0}
      title={`View ${user.firstName} ${user.secondName} in reports`.trim()}
      onClick={openReports}
      onKeyDown={(e) => {
        if (e.key === "Enter") openReports();
      }}
      className="bg-white rounded-lg shadow-[2px_4px_14.2px_0_rgba(0,0,0,0.05)] px-4 py-2.5 sm:px-6 sm:py-4 w-full flex items-center justify-between cursor-pointer transition-shadow hover:shadow-md"
    >
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
          {isFlagged && (
            <Flag
              className="h-4 w-4 text-orange-500 shrink-0"
              aria-label="Flagged recipient"
            />
          )}
          {isBanned && (
            <XCircle
              className="h-4 w-4 text-red-600 shrink-0"
              aria-label="Banned recipient"
            />
          )}
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
              cardStatusText === "Card Expired"
                ? "text-red-500"
                : "text-gray-500"
            }`}
          >
            {cardStatusText}
          </div>
        </div>
      </div>
      <button
        type="button"
        disabled={isViewOnly}
        onClick={(event) => {
          event.stopPropagation();
          if (!isViewOnly) onEdit();
        }}
        className="ml-3 shrink-0 rounded-md border border-gray-200 px-3 py-2 text-sm font-medium text-primary hover:bg-gray-50 disabled:cursor-not-allowed disabled:text-gray-400"
      >
        Edit
      </button>
    </div>
  );
};
