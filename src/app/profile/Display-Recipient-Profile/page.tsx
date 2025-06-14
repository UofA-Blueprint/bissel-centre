"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import {
  Plus,
  ArrowRight,
  UserCircle,
  Edit,
  Upload,
  X,
  Save,
} from "lucide-react";
import Header from "../../components/Header";
import Sidebar from "../../components/Sidebar";
import {
  BanModal,
  OverrideModal,
  DeleteModal,
  AccountStatusModal,
} from "../../components/Modals";
import { storage } from "../../services/firebase";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
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
  updateUser,
  updateUserStatus,
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
  const [showManagePopover, setShowManagePopover] = useState(false); // Modal states
  const [showBanModal, setShowBanModal] = useState(false);
  const [showOverrideModal, setShowOverrideModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showAccountStatusModal, setShowAccountStatusModal] = useState(false);
  const [overrideAction, setOverrideAction] = useState<"issue" | "renew">(
    "issue"
  );

  // Edit mode states
  const [isEditMode, setIsEditMode] = useState(false);
  const [editedUser, setEditedUser] = useState<Partial<User>>({});
  const [showImageUpload, setShowImageUpload] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null); // Close image upload menu when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      if (showImageUpload) {
        setShowImageUpload(false);
      }
      if (showManagePopover) {
        setShowManagePopover(false);
      }
    };

    if (showImageUpload || showManagePopover) {
      document.addEventListener("click", handleClickOutside);
    }

    return () => {
      document.removeEventListener("click", handleClickOutside);
    };
  }, [showImageUpload, showManagePopover]);
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
      // Keep the loading state with error message
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
        // Keep the loading state with error message
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
    } catch (error) {
      console.error("Error issuing card:", error);
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
      }
    } catch (error) {
      console.error("Error renewing card:", error);
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
    } catch (error) {
      console.error("Error with override:", error);
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
    }
  };
  // Edit mode handlers
  const handleEditToggle = () => {
    if (!user) return;

    if (isEditMode) {
      // Save changes
      handleSaveChanges();
    } else {
      // Enter edit mode
      setIsEditMode(true);
      setEditedUser({
        firstName: user.firstName,
        secondName: user.secondName,
        genderIdentity: user.genderIdentity,
        address: user.address,
        postalCode: user.postalCode,
        email: user.email || "",
        phoneNumber: user.phoneNumber || "",
        aliases: user.aliases,
        notes: user.notes || "",
      });
    }
  };

  const handleSaveChanges = async () => {
    if (!user) return;

    try {
      await updateUser(user.id, editedUser);
      await loadUserData();
      setIsEditMode(false);
      setEditedUser({});
    } catch (error) {
      console.error("Error updating user:", error);
    }
  };

  const handleCancelEdit = () => {
    setIsEditMode(false);
    setEditedUser({});
  };

  // Profile picture handlers
  const handleImageUpload = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelect = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file || !user) return; // Validate file type
    if (!file.type.startsWith("image/")) {
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      return;
    }

    try {
      setUploadingImage(true);

      // Create a reference to the file location
      const imageRef = ref(
        storage,
        `profile-pictures/${user.id}/${Date.now()}_${file.name}`
      );

      // Upload the file
      await uploadBytes(imageRef, file);

      // Get the download URL
      const downloadURL = await getDownloadURL(imageRef);

      // Update user profile with the new image URL
      await updateUser(user.id, { picture: downloadURL }); // Reload user data to show the new image
      await loadUserData();
    } catch (error) {
      console.error("Error uploading image:", error);
    } finally {
      setUploadingImage(false);
    }
  };

  const handleRemoveImage = async () => {
    if (!user) return;

    try {
      setUploadingImage(true);
      await updateUser(user.id, { picture: "" });
      await loadUserData();
    } catch (error) {
      console.error("Error removing image:", error);
    } finally {
      setUploadingImage(false);
    }
  };
  const handleAccountStatusChange = async (status: "Active" | "Inactive") => {
    if (!user) return;
    try {
      await updateUserStatus(user.id, status, "current-admin");
      await loadUserData();
    } catch (error) {
      console.error("Error updating account status:", error);
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
              handleEditToggle();
              setShowManagePopover(false); // Close the popover when edit is clicked
            }}
            onAccountStatus={() => {
              setShowAccountStatusModal(true);
              setShowManagePopover(false); // Close the popover
            }}
            onDeleteAccount={() => {
              setShowDeleteModal(true);
              setShowManagePopover(false); // Close the popover
            }}
            onToggleBan={() => {
              setShowBanModal(true);
              setShowManagePopover(false); // Close the popover
            }}
            isBanned={user.banned}
            userStatus={user.status || "Active"}
          />

          {/* Main Content */}
          <div className="flex-1 ml-4">
            <div className="bg-white rounded-lg shadow-sm overflow-hidden">
              {/* Profile Header */}{" "}
              <div className="p-6 flex flex-col items-center">
                <div className="relative mb-4">
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

                  {/* Profile Picture Edit Menu */}
                  <div className="absolute top-1 right-1">
                    {" "}
                    <button
                      className="bg-white p-1 rounded-full border border-gray-200 hover:bg-gray-50"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowImageUpload(!showImageUpload);
                      }}
                    >
                      <Edit size={14} className="text-primary" />
                    </button>
                    {showImageUpload && (
                      <div
                        className="absolute top-8 right-0 bg-white border border-gray-200 rounded-lg shadow-lg z-10 w-48"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          onClick={handleImageUpload}
                          disabled={uploadingImage}
                          className="w-full px-4 py-2 text-left hover:bg-gray-50 flex items-center"
                        >
                          <Upload size={16} className="mr-2" />
                          {uploadingImage ? "Uploading..." : "Upload Picture"}
                        </button>
                        {user.picture && (
                          <button
                            onClick={handleRemoveImage}
                            disabled={uploadingImage}
                            className="w-full px-4 py-2 text-left hover:bg-gray-50 flex items-center text-red-600"
                          >
                            <X size={16} className="mr-2" />
                            Remove Picture
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Hidden file input */}
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileSelect}
                    accept="image/*"
                    style={{ display: "none" }}
                  />
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
                    {" "}
                    <div className="flex items-center mb-6">
                      <h3 className="text-lg font-semibold text-gray-800">
                        Personal Details
                      </h3>
                      <div className="flex-grow border-t border-gray-200 ml-4" />
                      <button
                        onClick={handleEditToggle}
                        className={`ml-4 px-4 py-2 rounded-lg text-sm font-medium flex items-center ${
                          isEditMode ? "bg-primary text-white" : "display-none"
                        }`}
                      >
                        {isEditMode && (
                          <>
                            <Save size={16} className="mr-2" />
                            Save Changes
                          </>
                        )}
                      </button>
                      {isEditMode && (
                        <button
                          onClick={handleCancelEdit}
                          className="ml-2 px-4 py-2 rounded-lg text-sm font-medium bg-gray-500 text-white hover:bg-gray-600"
                        >
                          Cancel
                        </button>
                      )}
                    </div>{" "}
                    <div className="grid grid-cols-3 gap-x-8 gap-y-6">
                      <div>
                        {" "}
                        <label className="block text-sm font-bold text-gray-900 mb-1">
                          First Name
                        </label>
                        {isEditMode ? (
                          <input
                            type="text"
                            value={editedUser.firstName || user.firstName}
                            onChange={(e) =>
                              setEditedUser({
                                ...editedUser,
                                firstName: e.target.value,
                              })
                            }
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                          />
                        ) : (
                          <div className="text-gray-500">{user.firstName}</div>
                        )}
                      </div>
                      <div>
                        {" "}
                        <label className="block text-sm font-bold text-gray-900 mb-1">
                          Last Name
                        </label>
                        {isEditMode ? (
                          <input
                            type="text"
                            value={editedUser.secondName || user.secondName}
                            onChange={(e) =>
                              setEditedUser({
                                ...editedUser,
                                secondName: e.target.value,
                              })
                            }
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                          />
                        ) : (
                          <div className="text-gray-500">{user.secondName}</div>
                        )}
                      </div>
                      <div>
                        {" "}
                        <label className="block text-sm font-bold text-gray-900 mb-1">
                          Alias
                        </label>
                        {isEditMode ? (
                          <input
                            type="text"
                            value={
                              editedUser.aliases?.join(", ") ||
                              user.aliases.join(", ")
                            }
                            onChange={(e) => {
                              const aliases = e.target.value
                                .split(",")
                                .map((alias) => alias.trim())
                                .filter((alias) => alias);
                              setEditedUser({ ...editedUser, aliases });
                            }}
                            placeholder="Enter aliases separated by commas"
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                          />
                        ) : (
                          <div className="text-gray-500">
                            {user.aliases.join(", ") || "N/A"}
                          </div>
                        )}
                      </div>
                      <div>
                        {" "}
                        <label className="block text-sm font-bold text-gray-900 mb-1">
                          Gender Identity
                        </label>
                        {isEditMode ? (
                          <select
                            value={
                              editedUser.genderIdentity || user.genderIdentity
                            }
                            onChange={(e) =>
                              setEditedUser({
                                ...editedUser,
                                genderIdentity: e.target.value,
                              })
                            }
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                          >
                            <option value="Male">Male</option>
                            <option value="Female">Female</option>
                            <option value="Non-binary">Non-binary</option>
                            <option value="Two-Spirit">Two-Spirit</option>
                            <option value="Other">Other</option>
                            <option value="Prefer not to say">
                              Prefer not to say
                            </option>
                          </select>
                        ) : (
                          <div className="text-gray-500">
                            {user.genderIdentity}
                          </div>
                        )}
                      </div>{" "}
                      <div>
                        {" "}
                        <label className="block text-sm font-bold text-gray-900 mb-1">
                          Date of Birth
                        </label>
                        <div className="text-gray-500">{user.dateOfBirth}</div>
                      </div>
                      <div></div>
                      <div>
                        {" "}
                        <label className="block text-sm font-bold text-gray-900 mb-1">
                          Email
                        </label>
                        {isEditMode ? (
                          <input
                            type="email"
                            value={editedUser.email || user.email || ""}
                            onChange={(e) =>
                              setEditedUser({
                                ...editedUser,
                                email: e.target.value,
                              })
                            }
                            placeholder="Enter email address"
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                          />
                        ) : (
                          <div className="text-gray-500">
                            {user.email || "N/A"}
                          </div>
                        )}
                      </div>
                      <div>
                        {" "}
                        <label className="block text-sm font-bold text-gray-900 mb-1">
                          Phone Number
                        </label>
                        {isEditMode ? (
                          <input
                            type="tel"
                            value={
                              editedUser.phoneNumber || user.phoneNumber || ""
                            }
                            onChange={(e) =>
                              setEditedUser({
                                ...editedUser,
                                phoneNumber: e.target.value,
                              })
                            }
                            placeholder="Enter phone number"
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                          />
                        ) : (
                          <div className="text-gray-500">
                            {user.phoneNumber || "N/A"}
                          </div>
                        )}
                      </div>
                      <div></div>
                      <div>
                        {" "}
                        <label className="block text-sm font-bold text-gray-900 mb-1">
                          Address
                        </label>
                        {isEditMode ? (
                          <input
                            type="text"
                            value={editedUser.address || user.address}
                            onChange={(e) =>
                              setEditedUser({
                                ...editedUser,
                                address: e.target.value,
                              })
                            }
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                          />
                        ) : (
                          <div className="text-gray-500">{user.address}</div>
                        )}
                      </div>
                      <div>
                        {" "}
                        <label className="block text-sm font-bold text-gray-900 mb-1">
                          Postal Code: In what area did the recipient stay last
                          night?
                          <span className="text-red-500">*</span>
                        </label>
                        {isEditMode ? (
                          <input
                            type="text"
                            value={editedUser.postalCode || user.postalCode}
                            onChange={(e) =>
                              setEditedUser({
                                ...editedUser,
                                postalCode: e.target.value,
                              })
                            }
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                          />
                        ) : (
                          <div className="text-gray-500">{user.postalCode}</div>
                        )}
                      </div>
                    </div>
                  </div>{" "}
                  {(user.notes || isEditMode) && (
                    <div className="mt-8 bg-gray-50 rounded-lg p-6 shadow-sm">
                      <h3 className="text-lg font-semibold text-gray-800 mb-4">
                        Additional Information
                      </h3>
                      {isEditMode ? (
                        <textarea
                          value={editedUser.notes || user.notes || ""}
                          onChange={(e) =>
                            setEditedUser({
                              ...editedUser,
                              notes: e.target.value,
                            })
                          }
                          placeholder="Enter additional notes or information..."
                          rows={4}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                        />
                      ) : (
                        <p className="text-gray-700">{user.notes}</p>
                      )}
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
              {activeTab === "arcCard" && (
                <div className="p-6">
                  {/* ARC Card Image at the top */}
                  <div className="flex mb-8">
                    <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
                      <Image
                        src="/arcard.png"
                        alt="ARC Card"
                        width={320}
                        height={200}
                        className="rounded-lg"
                      />
                    </div>
                  </div>

                  {arcCards.length > 0 ? (
                    <div className="bg-gray-50 rounded-lg p-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-6">
                        Card Details
                      </h3>

                      <div className="grid grid-cols-3 gap-8">
                        {/* Status */}
                        <div>
                          <div className="text-sm text-gray-600 mb-2 font-bold">
                            Status
                          </div>
                          <div
                            className={`text-sm font-medium ${
                              arcCards[0].status === "Active"
                                ? "text-green-600"
                                : arcCards[0].status === "Expired"
                                ? "text-red-600"
                                : "text-gray-600"
                            }`}
                          >
                            {arcCards[0].status}
                          </div>
                        </div>

                        {/* Remaining Months */}
                        <div>
                          <div className="text-sm text-gray-600 mb-2 font-bold">
                            Remaining Months
                          </div>
                          <div
                            className={`text-sm font-medium ${
                              arcCards[0].monthsRemaining <= 1
                                ? "text-red-600"
                                : "text-gray-900"
                            }`}
                          >
                            {arcCards[0].monthsRemaining}/3
                          </div>
                        </div>

                        {/* Last Issued */}
                        <div>
                          <div className="text-sm text-gray-600 mb-2 font-bold">
                            Last issued
                          </div>
                          <div className="text-sm text-gray-900">
                            {new Date(arcCards[0].issuedAt).toLocaleDateString(
                              "en-US",
                              {
                                month: "2-digit",
                                day: "2-digit",
                                year: "numeric",
                              }
                            )}
                          </div>
                        </div>

                        {/* Last 7 Digits */}
                        <div>
                          <div className="text-sm text-gray-600 mb-2 font-bold">
                            Last 7 Digits
                          </div>
                          <div className="text-sm text-gray-500">
                            {arcCards[0].arcCardNumber
                              ? `***${arcCards[0].arcCardNumber.slice(-4)}`
                              : "Placeholder"}
                          </div>
                        </div>

                        {/* Security Code */}
                        <div>
                          <div className="text-sm text-gray-600 mb-2 font-bold">
                            Security Code
                          </div>
                          <div className="text-sm text-gray-500">
                            {arcCards[0].securityCode || "Placeholder"}
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-12">
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">
                        No ARC Card
                      </h3>
                      <p className="text-gray-500 mb-4">
                        This recipient doesn&apos;t have an ARC card yet.
                      </p>
                      <button className="bg-primary hover:bg-primary/80 text-white px-4 py-2 rounded-md text-sm">
                        Issue New Card
                      </button>
                    </div>
                  )}
                </div>
              )}{" "}
              {activeTab === "history" && (
                <div className="p-6">
                  {history.length > 0 ? (
                    <div className="space-y-3">
                      {/* Table Header */}
                      <div className="bg-[#DCEFF3] px-6 py-4 rounded-xl border border-gray-200">
                        <div className="grid grid-cols-4 gap-4 text-sm font-semibold text-gray-700">
                          <div>Date Modified</div>
                          <div>Modified By</div>
                          <div>Status</div>
                          <div>Action Taken</div>
                        </div>
                      </div>

                      {/* Table Rows */}
                      <div className="space-y-2">
                        {history.map((entry, index) => (
                          <div
                            key={entry.id}
                            className={`px-6 py-5 rounded-xl border border-gray-200 ${
                              index % 2 === 0 ? "bg-white" : "bg-gray-50"
                            }`}
                          >
                            <div className="grid grid-cols-4 gap-4 items-center">
                              {/* Date Modified */}
                              <div className="text-sm text-gray-900">
                                {new Date(entry.date).toLocaleDateString(
                                  "en-US",
                                  {
                                    month: "numeric",
                                    day: "numeric",
                                    year: "numeric",
                                  }
                                )}
                              </div>

                              {/* Modified By */}
                              <div className="text-sm text-gray-900">
                                {entry.modifiedBy}
                              </div>

                              {/* Status */}
                              <div>
                                {(() => {
                                  const status = entry.event.toLowerCase();
                                  if (
                                    status.includes("active") ||
                                    status.includes("created") ||
                                    status.includes("renewed") ||
                                    status.includes("issued") ||
                                    status.includes("unflagged")
                                  ) {
                                    return (
                                      <span className="inline-flex px-3 py-1 text-xs font-medium bg-green-100 text-green-700 rounded-full">
                                        Active
                                      </span>
                                    );
                                  } else if (status.includes("expired")) {
                                    return (
                                      <span className="inline-flex px-3 py-1 text-xs font-medium bg-red-100 text-red-700 rounded-full">
                                        Expired
                                      </span>
                                    );
                                  } else if (
                                    status.includes("flagged") ||
                                    status.includes("banned")
                                  ) {
                                    return (
                                      <span className="inline-flex px-3 py-1 text-xs font-medium bg-red-100 text-red-700 rounded-full">
                                        Flagged
                                      </span>
                                    );
                                  } else if (status.includes("lost")) {
                                    return (
                                      <span className="inline-flex px-3 py-1 text-xs font-medium bg-red-100 text-red-700 rounded-full">
                                        Lost
                                      </span>
                                    );
                                  } else {
                                    return (
                                      <span className="inline-flex px-3 py-1 text-xs font-medium bg-green-100 text-green-700 rounded-full">
                                        Active
                                      </span>
                                    );
                                  }
                                })()}
                              </div>

                              {/* Action Taken */}
                              <div className="text-sm text-gray-700">
                                {entry.event === "ARC Card Issued" &&
                                entry.notes
                                  ? `ARC Card issued (${
                                      entry.notes.match(/\d+/)?.[0] || "ID"
                                    })`
                                  : entry.event === "Account Flagged"
                                  ? "Account flagged"
                                  : entry.event === "Account Unflagged"
                                  ? "Account unflagged"
                                  : entry.event === "ARC Card Renewed"
                                  ? "ARC Card renewed"
                                  : entry.event === "Profile Updated"
                                  ? "Account information updated"
                                  : entry.event === "Account Created"
                                  ? "Account created"
                                  : entry.event === "ARC Card Lost"
                                  ? "ARC Card lost"
                                  : entry.notes || entry.event}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <UserCircle
                        size={48}
                        className="mx-auto text-gray-400 mb-4"
                      />
                      <p className="text-gray-500">
                        No history entries found for this recipient.
                      </p>
                    </div>
                  )}
                </div>
              )}
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

      <AccountStatusModal
        isOpen={showAccountStatusModal}
        onClose={() => setShowAccountStatusModal(false)}
        onConfirm={handleAccountStatusChange}
        userName={`${user.firstName} ${user.secondName}`}
        currentStatus={user.status || "Active"}
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
