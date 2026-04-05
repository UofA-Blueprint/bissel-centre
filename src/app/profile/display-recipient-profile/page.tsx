"use client";

import React, { useState, useEffect, useCallback, useRef, Suspense } from "react";
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
  IssueCardModal,
  RenewCardModal,
} from "../../components/Modals";
import { storage, auth } from "../../services/firebase";
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
  updateUserWithHistory,
} from "../../services/userService";
import {
  ArcCard as AvailableArcCard,
  getAvailableArcCards,
} from "../../services/arcCardService";
import { encryptPhone, decryptPhone } from "@/utils/phoneEncryption";

function DisplayRecipientProfileContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const userId = searchParams.get("id");

  const [user, setUser] = useState<User | null>(null);
  const [arcCards, setArcCards] = useState<ArcCard[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [bannedInfo, setBannedInfo] = useState<BannedUser | null>(null);
  const [availableCards, setAvailableCards] = useState<AvailableArcCard[]>([]);
  const [activeTab, setActiveTab] = useState<"overview" | "arcCard" | "history">("overview");
  const [loading, setLoading] = useState(true);
  const [loadingStep, setLoadingStep] = useState("Initializing...");
  const [showManagePopover, setShowManagePopover] = useState(false);

  // Modal states
  const [showBanModal, setShowBanModal] = useState(false);
  const [showOverrideModal, setShowOverrideModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showAccountStatusModal, setShowAccountStatusModal] = useState(false);
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [showRenewModal, setShowRenewModal] = useState(false);
  const [overrideAction, setOverrideAction] = useState<"issue" | "renew">("issue");
  const [viewReasonText, setViewReasonText] = useState<string | null>(null);

  // Pending values carried through the override flow
  const [pendingIssueCardId, setPendingIssueCardId] = useState<string>("");
  const [pendingIssueMonths, setPendingIssueMonths] = useState<number>(3);
  const [pendingRenewMonths, setPendingRenewMonths] = useState<number>(3);

  // Edit mode states
  const [isEditMode, setIsEditMode] = useState(false);
  const [editedUser, setEditedUser] = useState<Partial<User>>({});
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [displayPhone, setDisplayPhone] = useState<string>("");
  const [showImageUpload, setShowImageUpload] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Close popovers when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      if (showImageUpload) setShowImageUpload(false);
      if (showManagePopover) setShowManagePopover(false);
    };
    if (showImageUpload || showManagePopover) {
      document.addEventListener("click", handleClickOutside);
    }
    return () => {
      document.removeEventListener("click", handleClickOutside);
    };
  }, [showImageUpload, showManagePopover]);

  // Decrypt phone number for display in view mode
  useEffect(() => {
    if (!user?.phoneNumber) {
      setDisplayPhone("");
      return;
    }
    if (user.phoneNumber.startsWith("ENC:")) {
      decryptPhone(user.phoneNumber.slice(4))
        .then(setDisplayPhone)
        .catch(() => setDisplayPhone(""));
    } else {
      setDisplayPhone(user.phoneNumber);
    }
  }, [user?.phoneNumber]);

  // Load available arc cards (cards with status "Unattributed")
  useEffect(() => {
    getAvailableArcCards()
      .then(setAvailableCards)
      .catch((err) => console.error("Error loading available cards:", err));
  }, []);

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

      setLoadingStep("Testing Firebase connection...");

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
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }
    loadUserData();
  }, [userId, loadUserData]);

  const reloadAvailableCards = async () => {
    try {
      const cards = await getAvailableArcCards();
      setAvailableCards(cards);
    } catch (err) {
      console.error("Error reloading available cards:", err);
    }
  };

  const getStaffId = () => auth.currentUser?.uid ?? "unknown";

  // Issue card — opens IssueCardModal
  const handleIssueCard = () => {
    setShowIssueModal(true);
  };

  // Called when staff selects card + months in IssueCardModal
  const handleIssueModalConfirm = async (cardId: string, months: number) => {
    if (!user) return;
    if (user.banned) {
      setPendingIssueCardId(cardId);
      setPendingIssueMonths(months);
      setShowIssueModal(false);
      setOverrideAction("issue");
      setShowOverrideModal(true);
      return;
    }
    try {
      setShowIssueModal(false);
      const previousCardNumber =
        arcCards.length > 0 ? arcCards[0].arcCardNumber : undefined;
      await issueNewArcCard(
        user.id,
        cardId,
        getStaffId(),
        months,
        previousCardNumber
      );
      await loadUserData();
      await reloadAvailableCards();
    } catch (error) {
      console.error("Error issuing card:", error);
    }
  };

  // Renew card — opens RenewCardModal
  const handleRenewCard = () => {
    if (!user || arcCards.length === 0) return;
    setShowRenewModal(true);
  };

  // Called when staff selects months in RenewCardModal
  const handleRenewModalConfirm = async (months: number) => {
    if (!user) return;
    if (user.banned) {
      setPendingRenewMonths(months);
      setShowRenewModal(false);
      setOverrideAction("renew");
      setShowOverrideModal(true);
      return;
    }
    try {
      setShowRenewModal(false);
      const activeCard = arcCards.find((card) => card.status === "Active");
      if (activeCard) {
        await renewArcCard(user.id, activeCard.id, getStaffId(), months);
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
        await unbanUser(user.id, getStaffId());
      } else {
        await banUser(user.id, reason, getStaffId(), notes);
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
        const previousCardNumber =
          arcCards.length > 0 ? arcCards[0].arcCardNumber : undefined;
        await issueNewArcCard(
          user.id,
          pendingIssueCardId,
          getStaffId(),
          pendingIssueMonths,
          previousCardNumber,
          { reason }
        );
        await reloadAvailableCards();
      } else {
        const activeCard = arcCards.find((card) => card.status === "Active");
        if (activeCard) {
          await renewArcCard(
            user.id,
            activeCard.id,
            getStaffId(),
            pendingRenewMonths,
            { reason }
          );
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
      await deleteUserService(user.id);
      setShowDeleteModal(false);
      router.push("/dashboard");
    } catch (error) {
      console.error("Error deleting user:", error);
    }
  };

  // Form validation for the edit form
  const validateEditForm = (): Record<string, string> => {
    const errors: Record<string, string> = {};
    const first = (editedUser.firstName ?? user?.firstName ?? "").trim();
    const last = (editedUser.secondName ?? user?.secondName ?? "").trim();
    const email = (editedUser.email ?? user?.email ?? "").trim();
    const phone = (editedUser.phoneNumber ?? "").trim();
    const address = (editedUser.address ?? user?.address ?? "").trim();
    const postal = (editedUser.postalCode ?? user?.postalCode ?? "").trim();

    if (!first) errors.firstName = "First name is required";
    else if (!/^[a-zA-Z\s'\-]+$/.test(first)) errors.firstName = "Letters only";

    if (!last) errors.secondName = "Last name is required";
    else if (!/^[a-zA-Z\s'\-]+$/.test(last)) errors.secondName = "Letters only";

    if (!address) errors.address = "Address is required";

    if (!postal) errors.postalCode = "Postal code is required";
    else if (!/^[A-Za-z]\d[A-Za-z][ -]?\d[A-Za-z]\d$/.test(postal))
      errors.postalCode = "Invalid postal code (e.g. T5J 2R1)";

    if (!email && !phone)
      errors.contact = "At least one of email or phone number is required";

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      errors.email = "Invalid email address";

    if (phone && !/^[\d\s\-\+\(\)\.]{7,}$/.test(phone))
      errors.phoneNumber = "Invalid phone number";

    return errors;
  };

  // Edit mode handlers
  const handleEditToggle = async () => {
    if (!user) return;
    if (isEditMode) {
      await handleSaveChanges();
    } else {
      // Decrypt phone before showing in edit input
      let phoneToEdit = user.phoneNumber || "";
      if (phoneToEdit.startsWith("ENC:")) {
        try {
          phoneToEdit = await decryptPhone(phoneToEdit.slice(4));
        } catch {
          phoneToEdit = "";
        }
      }
      setIsEditMode(true);
      setFormErrors({});
      setEditedUser({
        firstName: user.firstName,
        secondName: user.secondName,
        genderIdentity: user.genderIdentity,
        address: user.address,
        postalCode: user.postalCode,
        email: user.email || "",
        phoneNumber: phoneToEdit,
        aliases: user.aliases,
        notes: user.notes || "",
      });
    }
  };

  const handleSaveChanges = async () => {
    if (!user) return;

    const errors = validateEditForm();
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }
    setFormErrors({});

    try {
      const dataToSave = { ...editedUser };
      if (dataToSave.phoneNumber) {
        dataToSave.phoneNumber = "ENC:" + (await encryptPhone(dataToSave.phoneNumber));
      }
      await updateUserWithHistory(user.id, dataToSave, getStaffId());
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
    setFormErrors({});
  };

  // Profile picture handlers
  const handleImageUpload = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelect = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;
    if (!file.type.startsWith("image/")) return;
    if (file.size > 5 * 1024 * 1024) return;

    try {
      setUploadingImage(true);
      const imageRef = ref(
        storage,
        `profile-pictures/${user.id}/${Date.now()}_${file.name}`
      );
      await uploadBytes(imageRef, file);
      const downloadURL = await getDownloadURL(imageRef);
      await updateUser(user.id, { picture: downloadURL });
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
      await updateUserStatus(user.id, status, getStaffId());
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

  // History helpers
  const getHistoryActionLabel = (entry: HistoryEntry): string => {
    switch (entry.event) {
      case "ARC Card Issued":
        return entry.notes || "ARC Card issued";
      case "ARC Card Replaced":
        return entry.notes || "ARC Card replaced";
      case "ARC Card Renewed":
        return "ARC Card renewed";
      case "Account Flagged":
        return entry.notes || "Account flagged";
      case "Account Unflagged":
        return "Account unflagged";
      case "Override":
        return "Override applied";
      case "Profile Updated":
        return "Account information updated";
      case "Account Created":
        return "Account created";
      case "ARC Card Lost":
        return "ARC Card lost";
      case "Status Change":
        return entry.notes || "Account status changed";
      default:
        return entry.notes || entry.event;
    }
  };

  const getHistoryStatusBadge = (entry: HistoryEntry) => {
    const ev = entry.event.toLowerCase();
    if (
      ev.includes("unflagged") ||
      ev.includes("renewed") ||
      ev.includes("issued") ||
      ev.includes("replaced") ||
      ev.includes("active") ||
      ev.includes("created")
    ) {
      return (
        <span className="inline-flex px-3 py-1 text-xs font-medium bg-green-100 text-green-700 rounded-full">
          Active
        </span>
      );
    }
    if (ev.includes("flagged") || ev.includes("banned")) {
      return (
        <span className="inline-flex px-3 py-1 text-xs font-medium bg-red-100 text-red-700 rounded-full">
          Flagged
        </span>
      );
    }
    if (ev.includes("expired")) {
      return (
        <span className="inline-flex px-3 py-1 text-xs font-medium bg-red-100 text-red-700 rounded-full">
          Expired
        </span>
      );
    }
    if (ev.includes("lost")) {
      return (
        <span className="inline-flex px-3 py-1 text-xs font-medium bg-red-100 text-red-700 rounded-full">
          Lost
        </span>
      );
    }
    return (
      <span className="inline-flex px-3 py-1 text-xs font-medium bg-green-100 text-green-700 rounded-full">
        Active
      </span>
    );
  };

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
              setShowManagePopover(false);
            }}
            onAccountStatus={() => {
              setShowAccountStatusModal(true);
              setShowManagePopover(false);
            }}
            onDeleteAccount={() => {
              setShowDeleteModal(true);
              setShowManagePopover(false);
            }}
            onToggleBan={() => {
              setShowBanModal(true);
              setShowManagePopover(false);
            }}
            isBanned={user.banned}
            userStatus={user.status || "Active"}
          />

          {/* Main Content */}
          <div className="flex-1 ml-4">
            <div className="bg-white rounded-lg shadow-sm overflow-hidden">
              {/* Profile Header */}
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
                    </div>

                    {/* Contact-level error spanning email + phone */}
                    {formErrors.contact && (
                      <p className="text-red-500 text-xs mb-4">
                        {formErrors.contact}
                      </p>
                    )}

                    <div className="grid grid-cols-3 gap-x-8 gap-y-6">
                      {/* First Name */}
                      <div>
                        <label className="block text-sm font-bold text-gray-900 mb-1">
                          First Name
                        </label>
                        {isEditMode ? (
                          <>
                            <input
                              type="text"
                              value={editedUser.firstName || user.firstName}
                              onChange={(e) =>
                                setEditedUser({
                                  ...editedUser,
                                  firstName: e.target.value,
                                })
                              }
                              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary ${
                                formErrors.firstName
                                  ? "border-red-500"
                                  : "border-gray-300"
                              }`}
                            />
                            {formErrors.firstName && (
                              <p className="text-red-500 text-xs mt-1">
                                {formErrors.firstName}
                              </p>
                            )}
                          </>
                        ) : (
                          <div className="text-gray-500">{user.firstName}</div>
                        )}
                      </div>

                      {/* Last Name */}
                      <div>
                        <label className="block text-sm font-bold text-gray-900 mb-1">
                          Last Name
                        </label>
                        {isEditMode ? (
                          <>
                            <input
                              type="text"
                              value={editedUser.secondName || user.secondName}
                              onChange={(e) =>
                                setEditedUser({
                                  ...editedUser,
                                  secondName: e.target.value,
                                })
                              }
                              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary ${
                                formErrors.secondName
                                  ? "border-red-500"
                                  : "border-gray-300"
                              }`}
                            />
                            {formErrors.secondName && (
                              <p className="text-red-500 text-xs mt-1">
                                {formErrors.secondName}
                              </p>
                            )}
                          </>
                        ) : (
                          <div className="text-gray-500">{user.secondName}</div>
                        )}
                      </div>

                      {/* Alias */}
                      <div>
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
                                .map((a) => a.trim())
                                .filter((a) => a);
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

                      {/* Gender Identity */}
                      <div>
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
                      </div>

                      {/* Date of Birth (read-only) */}
                      <div>
                        <label className="block text-sm font-bold text-gray-900 mb-1">
                          Date of Birth
                        </label>
                        <div className="text-gray-500">{user.dateOfBirth}</div>
                      </div>
                      <div></div>

                      {/* Email */}
                      <div>
                        <label className="block text-sm font-bold text-gray-900 mb-1">
                          Email
                        </label>
                        {isEditMode ? (
                          <>
                            <input
                              type="email"
                              value={editedUser.email ?? user.email ?? ""}
                              onChange={(e) =>
                                setEditedUser({
                                  ...editedUser,
                                  email: e.target.value,
                                })
                              }
                              placeholder="Enter email address"
                              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary ${
                                formErrors.email
                                  ? "border-red-500"
                                  : "border-gray-300"
                              }`}
                            />
                            {formErrors.email && (
                              <p className="text-red-500 text-xs mt-1">
                                {formErrors.email}
                              </p>
                            )}
                          </>
                        ) : (
                          <div className="text-gray-500">
                            {user.email || "N/A"}
                          </div>
                        )}
                      </div>

                      {/* Phone Number */}
                      <div>
                        <label className="block text-sm font-bold text-gray-900 mb-1">
                          Phone Number
                        </label>
                        {isEditMode ? (
                          <>
                            <input
                              type="tel"
                              value={editedUser.phoneNumber ?? ""}
                              onChange={(e) =>
                                setEditedUser({
                                  ...editedUser,
                                  phoneNumber: e.target.value,
                                })
                              }
                              placeholder="Enter phone number"
                              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary ${
                                formErrors.phoneNumber
                                  ? "border-red-500"
                                  : "border-gray-300"
                              }`}
                            />
                            {formErrors.phoneNumber && (
                              <p className="text-red-500 text-xs mt-1">
                                {formErrors.phoneNumber}
                              </p>
                            )}
                          </>
                        ) : (
                          <div className="text-gray-500">
                            {displayPhone || "N/A"}
                          </div>
                        )}
                      </div>
                      <div></div>

                      {/* Address */}
                      <div>
                        <label className="block text-sm font-bold text-gray-900 mb-1">
                          Address
                        </label>
                        {isEditMode ? (
                          <>
                            <input
                              type="text"
                              value={editedUser.address || user.address}
                              onChange={(e) =>
                                setEditedUser({
                                  ...editedUser,
                                  address: e.target.value,
                                })
                              }
                              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary ${
                                formErrors.address
                                  ? "border-red-500"
                                  : "border-gray-300"
                              }`}
                            />
                            {formErrors.address && (
                              <p className="text-red-500 text-xs mt-1">
                                {formErrors.address}
                              </p>
                            )}
                          </>
                        ) : (
                          <div className="text-gray-500">{user.address}</div>
                        )}
                      </div>

                      {/* Postal Code */}
                      <div>
                        <label className="block text-sm font-bold text-gray-900 mb-1">
                          Postal Code: In what area did the recipient stay last
                          night?
                          <span className="text-red-500">*</span>
                        </label>
                        {isEditMode ? (
                          <>
                            <input
                              type="text"
                              value={editedUser.postalCode || user.postalCode}
                              onChange={(e) =>
                                setEditedUser({
                                  ...editedUser,
                                  postalCode: e.target.value,
                                })
                              }
                              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary ${
                                formErrors.postalCode
                                  ? "border-red-500"
                                  : "border-gray-300"
                              }`}
                            />
                            {formErrors.postalCode && (
                              <p className="text-red-500 text-xs mt-1">
                                {formErrors.postalCode}
                              </p>
                            )}
                          </>
                        ) : (
                          <div className="text-gray-500">{user.postalCode}</div>
                        )}
                      </div>
                    </div>
                  </div>

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
              )}

              {activeTab === "arcCard" && (
                <div className="p-6">
                  {/* ARC Card Image */}
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

                      {(() => {
                        const issuedAt = new Date(arcCards[0].issuedAt);
                        const now = new Date();
                        const durationMs = now.getTime() - issuedAt.getTime();
                        const durationMonths = Math.floor(
                          durationMs / (30.44 * 24 * 60 * 60 * 1000)
                        );
                        const durationYears = Math.floor(durationMonths / 12);
                        const remainingMonths = durationMonths % 12;
                        const durationText =
                          durationYears > 0
                            ? `${durationYears} yr${durationYears !== 1 ? "s" : ""}, ${remainingMonths} mo`
                            : `${durationMonths} mo`;
                        return (
                          <div className="grid grid-cols-3 gap-8">
                            <div>
                              <div className="text-sm text-gray-600 mb-2 font-bold">
                                Card held since
                              </div>
                              <div className="text-sm text-gray-900">
                                {issuedAt.toLocaleDateString("en-US", {
                                  month: "long",
                                  day: "numeric",
                                  year: "numeric",
                                })}
                              </div>
                            </div>

                            <div>
                              <div className="text-sm text-gray-600 mb-2 font-bold">
                                Card held for
                              </div>
                              <div className="text-sm text-gray-900">
                                {durationText}
                              </div>
                            </div>

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
                                {arcCards[0].monthsRemaining}
                              </div>
                            </div>

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

                            <div>
                              <div className="text-sm text-gray-600 mb-2 font-bold">
                                Security Code
                              </div>
                              <div className="text-sm text-gray-500">
                                {arcCards[0].securityCode || "Placeholder"}
                              </div>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  ) : (
                    <div className="text-center py-12">
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">
                        No ARC Card
                      </h3>
                      <p className="text-gray-500 mb-4">
                        This recipient doesn&apos;t have an ARC card yet.
                      </p>
                      <button
                        onClick={handleIssueCard}
                        className="bg-primary hover:bg-primary/80 text-white px-4 py-2 rounded-md text-sm"
                      >
                        Issue New Card
                      </button>
                    </div>
                  )}
                </div>
              )}

              {activeTab === "history" && (
                <div className="p-6">
                  {history.length > 0 ? (
                    <div className="space-y-3">
                      {/* Table Header */}
                      <div className="bg-[#DCEFF3] px-6 py-4 rounded-xl border border-gray-200">
                        <div className="grid grid-cols-[1fr_1fr_1fr_1fr_auto] gap-4 text-sm font-semibold text-gray-700">
                          <div>Date Modified</div>
                          <div>Modified By</div>
                          <div>Status</div>
                          <div>Action Taken</div>
                          <div>Details</div>
                        </div>
                      </div>

                      {/* Table Rows */}
                      <div className="space-y-2">
                        {history
                          .sort(
                            (a, b) =>
                              new Date(b.date).getTime() -
                              new Date(a.date).getTime()
                          )
                          .map((entry, index) => (
                            <div
                              key={entry.id}
                              className={`px-6 py-5 rounded-xl border border-gray-200 ${
                                index % 2 === 0 ? "bg-white" : "bg-gray-50"
                              }`}
                            >
                              <div className="grid grid-cols-[1fr_1fr_1fr_1fr_auto] gap-4 items-center">
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

                                {/* Status Badge */}
                                <div>{getHistoryStatusBadge(entry)}</div>

                                {/* Action Taken */}
                                <div className="text-sm text-gray-700">
                                  {getHistoryActionLabel(entry)}
                                </div>

                                {/* View Reason button for override entries */}
                                <div>
                                  {entry.reason ? (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setViewReasonText(entry.reason ?? null)
                                      }
                                      className="text-sm font-medium text-primary hover:text-primary/80 underline"
                                    >
                                      View Reason
                                    </button>
                                  ) : null}
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
      <IssueCardModal
        isOpen={showIssueModal}
        onClose={() => setShowIssueModal(false)}
        onConfirm={handleIssueModalConfirm}
        availableCards={availableCards}
      />

      <RenewCardModal
        isOpen={showRenewModal}
        onClose={() => setShowRenewModal(false)}
        onConfirm={handleRenewModalConfirm}
        cardNumber={arcCards[0]?.arcCardNumber ?? ""}
      />

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
        banNotes={bannedInfo?.notes ?? ""}
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

      {/* View Reason modal for override entries */}
      {viewReasonText !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">
              Override Reason
            </h3>
            <p className="text-gray-700 mb-6 whitespace-pre-wrap">
              {viewReasonText}
            </p>
            <button
              type="button"
              onClick={() => setViewReasonText(null)}
              className="w-full px-4 py-2 bg-primary hover:bg-primary/80 text-white rounded-md text-sm font-medium"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function DisplayRecipientProfile() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <div className="text-lg text-gray-700 mb-2">Loading...</div>
          </div>
        </div>
      }
    >
      <DisplayRecipientProfileContent />
    </Suspense>
  );
}
