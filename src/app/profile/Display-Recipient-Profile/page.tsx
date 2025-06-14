"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { Plus, ArrowRight, UserCircle, Edit } from "lucide-react";
import Header from "../../components/Header";
import Sidebar from "../../components/Sidebar";
import { BanModal, OverrideModal, DeleteModal } from "../../components/Modals";
import {
  User,
  ArcCard,
  HistoryEntry,
  BannedUser,
  getUserById,
  getArcCardsByUserId,
  getHistoryByUserId,
  getBannedUserInfo,
  banUser,
  unbanUser,
  issueNewArcCard,
  renewArcCard,
  deleteUser as deleteUserService,
} from "../../services/userService";

export default function DisplayRecipientProfile() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const userId = searchParams.get("id");

  const [user, setUser] = useState<User | null>(null);
  const [arcCards, setArcCards] = useState<ArcCard[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [bannedInfo, setBannedInfo] = useState<BannedUser | null>(null);
  const [activeTab, setActiveTab] = useState<
    "overview" | "arcCard" | "history"
  >("overview");
  const [loading, setLoading] = useState(true);
  const [loadingStep, setLoadingStep] = useState("Initializing...");
  const [showManagePopover, setShowManagePopover] = useState(false);

  // Modal states
  const [showBanModal, setShowBanModal] = useState(false);
  const [showOverrideModal, setShowOverrideModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [overrideAction, setOverrideAction] = useState<"issue" | "renew">(
    "issue"
  );
  const loadUserData = useCallback(async () => {
    if (!userId) {
      console.log("No userId provided");
      setLoading(false);
      return;
    }

    try {
      console.log("Loading user data for userId:", userId);
      setLoading(true);
      setLoadingStep("Connecting to database...");

      // Test Firebase connection first
      setLoadingStep("Testing Firebase connection...");

      // Load data from Firebase with timeout
      const timeout = new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error("Request timeout after 10 seconds")),
          10000
        )
      );

      setLoadingStep("Fetching user data...");
      const dataPromise = Promise.all([
        getUserById(userId).catch((err) => {
          console.error("Error fetching user:", err);
          throw new Error(`Failed to fetch user: ${err.message}`);
        }),
        getArcCardsByUserId(userId).catch((err) => {
          console.error("Error fetching arc cards:", err);
          throw new Error(`Failed to fetch arc cards: ${err.message}`);
        }),
        getHistoryByUserId(userId).catch((err) => {
          console.error("Error fetching history:", err);
          throw new Error(`Failed to fetch history: ${err.message}`);
        }),
        getBannedUserInfo(userId).catch((err) => {
          console.error("Error fetching banned info:", err);
          throw new Error(`Failed to fetch banned info: ${err.message}`);
        }),
      ]);

      setLoadingStep("Processing data...");
      const [userData, arcCardsData, historyData, bannedData] =
        (await Promise.race([dataPromise, timeout])) as [
          User | null,
          ArcCard[],
          HistoryEntry[],
          BannedUser | null
        ];

      console.log("User data loaded:", userData);
      console.log("Arc cards data:", arcCardsData);
      console.log("History data:", historyData);
      console.log("Banned data:", bannedData);

      setUser(userData);
      setArcCards(arcCardsData);
      setHistory(historyData);
      setBannedInfo(bannedData);
      setLoadingStep("Complete");
    } catch (error) {
      console.error("Error loading user data:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      setLoadingStep(`Error: ${errorMessage}`);
      // Instead of alert, keep the loading state with error message
      setTimeout(() => {
        alert(`Error loading user data: ${errorMessage}`);
      }, 1000);
    } finally {
      setLoading(false);
    }
  }, [userId]);
  useEffect(() => {
    if (!userId) {
      console.log("No userId provided");
      setLoading(false);
      return;
    }

    const loadData = async () => {
      try {
        console.log("Loading user data for userId:", userId);
        setLoading(true);
        setLoadingStep("Connecting to database...");

        // Test Firebase connection first
        setLoadingStep("Testing Firebase connection...");

        // Load data from Firebase with timeout
        const timeout = new Promise((_, reject) =>
          setTimeout(
            () => reject(new Error("Request timeout after 10 seconds")),
            10000
          )
        );

        setLoadingStep("Fetching user data...");
        const dataPromise = Promise.all([
          getUserById(userId).catch((err) => {
            console.error("Error fetching user:", err);
            throw new Error(`Failed to fetch user: ${err.message}`);
          }),
          getArcCardsByUserId(userId).catch((err) => {
            console.error("Error fetching arc cards:", err);
            throw new Error(`Failed to fetch arc cards: ${err.message}`);
          }),
          getHistoryByUserId(userId).catch((err) => {
            console.error("Error fetching history:", err);
            throw new Error(`Failed to fetch history: ${err.message}`);
          }),
          getBannedUserInfo(userId).catch((err) => {
            console.error("Error fetching banned info:", err);
            throw new Error(`Failed to fetch banned info: ${err.message}`);
          }),
        ]);

        setLoadingStep("Processing data...");
        const [userData, arcCardsData, historyData, bannedData] =
          (await Promise.race([dataPromise, timeout])) as [
            User | null,
            ArcCard[],
            HistoryEntry[],
            BannedUser | null
          ];

        console.log("User data loaded:", userData);
        console.log("Arc cards data:", arcCardsData);
        console.log("History data:", historyData);
        console.log("Banned data:", bannedData);

        setUser(userData);
        setArcCards(arcCardsData);
        setHistory(historyData);
        setBannedInfo(bannedData);
        setLoadingStep("Complete");
      } catch (error) {
        console.error("Error loading user data:", error);
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        setLoadingStep(`Error: ${errorMessage}`);
        // Instead of alert, keep the loading state with error message
        setTimeout(() => {
          alert(`Error loading user data: ${errorMessage}`);
        }, 1000);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [userId]); // Only depends on userId, preventing the dependency loop

  // Handle action functions
  const handleIssueCard = async () => {
    if (!user) return;

    if (user.banned) {
      setOverrideAction("issue");
      setShowOverrideModal(true);
      return;
    }

    try {
      const cardNumber = Math.random().toString().substring(2, 9);
      await issueNewArcCard(
        user.id,
        cardNumber,
        "Transit Department",
        "current-admin"
      );
      await loadUserData();
      alert("ARC card issued successfully!");
    } catch (error) {
      console.error("Error issuing card:", error);
      alert("Error issuing card");
    }
  };

  const handleRenewCard = async () => {
    if (!user || arcCards.length === 0) return;

    if (user.banned) {
      setOverrideAction("renew");
      setShowOverrideModal(true);
      return;
    }

    try {
      const activeCard = arcCards.find((card) => card.status === "Active");
      if (activeCard) {
        await renewArcCard(user.id, activeCard.id, "current-admin");
        await loadUserData();
        alert("ARC card renewed successfully!");
      }
    } catch (error) {
      console.error("Error renewing card:", error);
      alert("Error renewing card");
    }
  };

  const handleBanUser = async (reason: string, notes: string) => {
    if (!user) return;

    try {
      if (user.banned) {
        await unbanUser(user.id, "current-admin");
      } else {
        await banUser(user.id, reason, "current-admin", notes);
      }
      await loadUserData();
      setShowBanModal(false);
    } catch (error) {
      console.error("Error updating ban status:", error);
      alert("Error updating ban status");
    }
  };

  const handleOverrideConfirm = async (reason: string) => {
    if (!user) return;

    try {
      if (overrideAction === "issue") {
        const cardNumber = Math.random().toString().substring(2, 9);
        await issueNewArcCard(
          user.id,
          cardNumber,
          "Transit Department",
          "current-admin",
          { reason }
        );
      } else {
        const activeCard = arcCards.find((card) => card.status === "Active");
        if (activeCard) {
          await renewArcCard(user.id, activeCard.id, "current-admin", {
            reason,
          });
        }
      }
      await loadUserData();
      setShowOverrideModal(false);
      alert(
        `ARC card ${
          overrideAction === "issue" ? "issued" : "renewed"
        } successfully with override!`
      );
    } catch (error) {
      console.error("Error with override:", error);
      alert("Error with override");
    }
  };

  const handleDeleteUser = async () => {
    if (!user) return;

    try {
      await deleteUserService(user.id, "current-admin");
      setShowDeleteModal(false);
      router.push("/admin/dashboard");
    } catch (error) {
      console.error("Error deleting user:", error);
      alert("Error deleting user");
    }
  };
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-lg text-gray-700 mb-2">Loading...</div>
          <div className="text-sm text-gray-500">{loadingStep}</div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-lg text-gray-700">User not found</div>
      </div>
    );
  }

  const headerActions = (
    <>
      <button
        onClick={handleRenewCard}
        className="bg-primary hover:bg-primary/80 text-white px-4 py-2 rounded-md text-sm flex items-center"
      >
        <Plus size={16} className="mr-1" /> Renew Card
      </button>
      <button
        onClick={handleIssueCard}
        className="bg-primary hover:bg-primary/80 text-white px-4 py-2 rounded-md text-sm flex items-center"
      >
        Issue Card <ArrowRight size={16} className="ml-1" />
      </button>
    </>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <Header
        title="Profile"
        showBackButton
        onBackClick={() => router.back()}
        actions={headerActions}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex">
          <Sidebar
            activeTab={activeTab}
            onTabChange={(tab) =>
              setActiveTab(tab as "overview" | "arcCard" | "history")
            }
            showManagePopover={showManagePopover}
            onToggleManagePopover={() =>
              setShowManagePopover(!showManagePopover)
            }
            onEditProfile={() => {
              // TODO: Navigate to edit profile
              alert("Edit profile functionality to be implemented");
            }}
            onAccountStatus={() => {
              // TODO: Show account status modal
              alert("Account status functionality to be implemented");
            }}
            onDeleteAccount={() => setShowDeleteModal(true)}
            onToggleBan={() => setShowBanModal(true)}
            isBanned={user.banned}
          />

          {/* Main Content */}
          <div className="flex-1 ml-4">
            <div className="bg-white rounded-lg shadow-sm overflow-hidden">
              {/* Profile Header */}
              <div className="p-6 flex flex-col items-center">
                <div className="relative mb-4">
                  {" "}
                  <div className="w-24 h-24 bg-purple-200 rounded-full overflow-hidden flex items-center justify-center">
                    {user.picture ? (
                      <Image
                        src={user.picture}
                        alt="Profile"
                        width={96}
                        height={96}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <UserCircle size={56} className="text-purple-300" />
                    )}
                  </div>
                  <button className="absolute top-1 right-1 bg-white p-1 rounded-full border border-gray-200 hover:bg-gray-50">
                    <Edit size={14} className="text-primary" />
                  </button>
                </div>
                <div className="text-center">
                  <div className="flex items-center justify-center space-x-2">
                    <h1 className="text-2xl font-semibold text-gray-900">
                      {user.firstName} {user.secondName}{" "}
                      {user.aliases.length > 0 && `(${user.aliases[0]})`}
                    </h1>
                    {user.banned && (
                      <span
                        className="text-red-500 text-xl"
                        title="User is flagged"
                      >
                        🚩
                      </span>
                    )}
                  </div>
                </div>
              </div>
              {/* Tab Content */}
              {activeTab === "overview" && (
                <div className="p-6">
                  <div className="bg-gray-50 rounded-lg p-6 shadow-sm">
                    <div className="flex items-center mb-6">
                      <h3 className="text-lg font-semibold text-gray-800">
                        Personal Details
                      </h3>
                      <div className="flex-grow border-t border-gray-200 ml-4" />
                    </div>

                    <div className="grid grid-cols-3 gap-x-8 gap-y-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-900 mb-1">
                          First Name
                        </label>
                        <div className="text-gray-500">{user.firstName}</div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-900 mb-1">
                          Last Name
                        </label>
                        <div className="text-gray-500">{user.secondName}</div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-900 mb-1">
                          Alias
                        </label>
                        <div className="text-gray-500">
                          {user.aliases.join(", ") || "N/A"}
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-900 mb-1">
                          Gender Identity
                        </label>
                        <div className="text-gray-500">
                          {user.genderIdentity}
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-900 mb-1">
                          Date of Birth
                        </label>
                        <div className="text-gray-500">{user.dateOfBirth}</div>
                      </div>
                      <div></div>

                      {user.email && (
                        <div>
                          <label className="block text-sm font-medium text-gray-900 mb-1">
                            Email
                          </label>
                          <div className="text-gray-500">{user.email}</div>
                        </div>
                      )}
                      {user.phoneNumber && (
                        <div>
                          <label className="block text-sm font-medium text-gray-900 mb-1">
                            Phone Number
                          </label>
                          <div className="text-gray-500">
                            {user.phoneNumber}
                          </div>
                        </div>
                      )}
                      <div></div>

                      <div>
                        <label className="block text-sm font-medium text-gray-900 mb-1">
                          Address
                        </label>
                        <div className="text-gray-500">{user.address}</div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-900 mb-1">
                          Postal Code: In what area did the recipient stay last
                          night?
                          <span className="text-red-500">*</span>
                        </label>
                        <div className="text-gray-500">{user.postalCode}</div>
                      </div>
                    </div>
                  </div>

                  {user.notes && (
                    <div className="mt-8 bg-gray-50 rounded-lg p-6 shadow-sm">
                      <h3 className="text-lg font-semibold text-gray-800 mb-4">
                        Additional Information
                      </h3>
                      <p className="text-gray-700">{user.notes}</p>
                    </div>
                  )}

                  {user.banned && bannedInfo && (
                    <div className="mt-8 bg-red-50 border border-red-200 rounded-lg p-6">
                      <h3 className="text-lg font-semibold text-red-800 mb-4 flex items-center">
                        🚩 User is Flagged
                      </h3>
                      <div className="text-red-700">
                        <p>
                          <strong>Reason:</strong> {user.banReason}
                        </p>
                        <p>
                          <strong>Flagged on:</strong>{" "}
                          {bannedInfo.bannedAt.toLocaleDateString()}
                        </p>
                        {bannedInfo.notes && (
                          <p>
                            <strong>Notes:</strong> {bannedInfo.notes}
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}{" "}
              {activeTab === "arcCard" && <div></div>}
              {activeTab === "history" && <div></div>}
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      <BanModal
        isOpen={showBanModal}
        onClose={() => setShowBanModal(false)}
        onConfirm={handleBanUser}
        isBanning={!user.banned}
        userName={`${user.firstName} ${user.secondName}`}
      />

      <OverrideModal
        isOpen={showOverrideModal}
        onClose={() => setShowOverrideModal(false)}
        onConfirm={handleOverrideConfirm}
        action={overrideAction}
        banReason={user.banReason || ""}
      />

      <DeleteModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleDeleteUser}
        userName={`${user.firstName} ${user.secondName}`}
      />
    </div>
  );
}
