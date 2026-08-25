import React, { useCallback, useEffect, useRef, useState } from "react";
import { Dialog, DialogPanel, DialogTitle } from "@headlessui/react";
import { MoreHorizontal } from "lucide-react";
import RegisterRecipientForm, {
  RecipientFormData,
} from "./PersonalDetailsForm";
import AdditionalInfoForm, { AdditionalInfoData } from "./AdditionalInfoForm";
import PhotoUploadForm, { PhotoUploadData } from "./PhotoUploadForm";
import ReviewDetails from "./ReviewDetails";
import HistorySection, { RecipientHistoryRow } from "./HistorySection";
import ArcCardSection, { ArcCardSectionData } from "./ArcCardSection";
import SidebarSteps from "./SidebarSteps";

type Props = {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  mode?: "create" | "edit";
  recipientId?: string;
};

type FormData = {
  personalDetails?: RecipientFormData;
  additionalInfo?: AdditionalInfoData;
  photoUpload?: PhotoUploadData;
  arcCard?: ArcCardSectionData;
  accountState?: {
    banned: boolean;
    flagged: boolean;
  };
  history?: RecipientHistoryRow[];
};

const RegisterRecipientModal: React.FC<Props> = ({
  open,
  onClose,
  onSuccess,
  mode = "create",
  recipientId,
}) => {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const personalDetailsRef = useRef<{ submit: () => void }>(null);
  const additionalInfoRef = useRef<{ submit: () => void }>(null);
  const photouploadRef = useRef<{ submit: () => void }>(null);
  const arcCardRef = useRef<{ submit: () => void }>(null);
  const reviewRef = useRef<{ submit: () => void }>(null);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [formData, setFormData] = useState<FormData>({});
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);
  const [manageMenuOpen, setManageMenuOpen] = useState(false);
  const [manageAction, setManageAction] = useState<
    null | "FLAG" | "UNFLAG" | "BAN" | "UNBAN" | "DELETE"
  >(null);
  const [manageReason, setManageReason] = useState("");
  const [manageSubmitting, setManageSubmitting] = useState(false);
  const isEditMode = mode === "edit";
  const steps = isEditMode
    ? [
        { id: 1, label: "Personal Details" },
        { id: 2, label: "Additional Information" },
        { id: 3, label: "Upload Photo" },
        { id: 4, label: "ARC Card" },
        { id: 5, label: "Review" },
        { id: 6, label: "History" },
      ]
    : [
        { id: 1, label: "Personal Details" },
        { id: 2, label: "Additional Information" },
        { id: 3, label: "Upload Photo" },
        { id: 4, label: "Review" },
      ];
  const sidebarSteps = isEditMode
    ? steps.filter((step) => step.id !== 6)
    : steps;
  const separateHistoryStep = isEditMode
    ? { id: 6, label: "History" }
    : undefined;

  const loadRecipient = useCallback(async () => {
    if (!isEditMode || !recipientId) return;
    setIsLoadingProfile(true);
    setErrorMessage(null);
    try {
      const response = await fetch(`/api/recipients/${recipientId}`);
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to load recipient");
      }
      setFormData(data);
      setCurrentPage((prev) => (prev > steps.length ? steps.length : prev));
    } finally {
      setIsLoadingProfile(false);
    }
  }, [isEditMode, recipientId, steps.length]);

  useEffect(() => {
    if (!open || !isEditMode || !recipientId) return;

    let cancelled = false;
    loadRecipient()
      .then(() => {
        if (cancelled) return;
        setCurrentPage(1);
        setCompletedSteps(new Set());
      })
      .catch((error) => {
        if (!cancelled) {
          setErrorMessage(
            error instanceof Error ? error.message : "Failed to load recipient",
          );
        }
      });

    return () => {
      cancelled = true;
    };
  }, [open, isEditMode, recipientId, loadRecipient]);

  const hasFormData = () => {
    return (
      Object.keys(formData.personalDetails || {}).length > 0 ||
      Object.keys(formData.additionalInfo || {}).length > 0 ||
      Object.keys(formData.photoUpload || {}).length > 0
    );
  };

  const handleClose = () => {
    if (hasFormData()) {
      const confirmed = window.confirm(
        "Are you sure you want to exit? All entered data will be lost.",
      );
      if (!confirmed) {
        return;
      }
      // Clear all form data
      setFormData({});
      setCurrentPage(1);
      setCompletedSteps(new Set());
      setErrorMessage(null);
      setManageMenuOpen(false);
      setManageAction(null);
      setManageReason("");
    }
    onClose();
  };

  const handleDialogClose = () => {
    // While the manage-action popup is open, keep the base modal from handling
    // outside clicks/escape to avoid accidental "Are you sure you want to exit?"
    // prompts during flag/ban/delete input.
    if (manageAction) {
      return;
    }
    handleClose();
  };

  const handlePersonalDetailsSubmit = (data: RecipientFormData) => {
    setErrorMessage(null);
    setFormData((prev) => ({ ...prev, personalDetails: data }));
    setCompletedSteps((prev) => new Set(prev).add(1));
    setCurrentPage(2);
  };

  const handleAdditionalInfoSubmit = (data: AdditionalInfoData) => {
    setErrorMessage(null);
    setFormData((prev) => ({ ...prev, additionalInfo: data }));
    setCompletedSteps((prev) => new Set(prev).add(2));
    setCurrentPage(3);
  };

  const handlePhotoUploadSubmit = (data: PhotoUploadData) => {
    setErrorMessage(null);
    setFormData((prev) => ({ ...prev, photoUpload: data }));
    setCompletedSteps((prev) => new Set(prev).add(3));
    setCurrentPage(4);
  };

  const ensureCurrentStepDataIsSaved = () => {
    if (currentPage === 1 && personalDetailsRef.current) {
      const data = (personalDetailsRef.current as any).getData?.();
      if (data) setFormData((prev) => ({ ...prev, personalDetails: data }));
    } else if (currentPage === 2 && additionalInfoRef.current) {
      const data = (additionalInfoRef.current as any).getData?.();
      if (data) setFormData((prev) => ({ ...prev, additionalInfo: data }));
    } else if (currentPage === 3 && photouploadRef.current) {
      const data = (photouploadRef.current as any).getData?.();
      if (data) setFormData((prev) => ({ ...prev, photoUpload: data }));
    } else if (currentPage === 4 && arcCardRef.current) {
      const data = (arcCardRef.current as any).getData?.();
      if (data) setFormData((prev) => ({ ...prev, arcCard: data }));
    }
  };

  const handleFinalSubmit = async () => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setIsSubmitting(true);
    try {
      setErrorMessage(null);
      ensureCurrentStepDataIsSaved();

      const response = await fetch(
        isEditMode ? `/api/recipients/${recipientId}` : "/api/register-recipient",
        {
        method: isEditMode ? "PATCH" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
        },
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to register recipient");
      }

      // Clear form and close modal on success
      setFormData({});
      setCurrentPage(1);
      setCompletedSteps(new Set());
      setErrorMessage(null);
      submittingRef.current = false;
      setIsSubmitting(false);
      onClose();
      onSuccess?.();
    } catch (error) {
      console.error("Registration error:", error);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : isEditMode
            ? "Failed to update recipient. Please try again."
            : "Failed to register recipient. Please try again.",
      );
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  const handleContinue = () => {
    setErrorMessage(null);
    switch (currentPage) {
      case 1:
        personalDetailsRef.current?.submit();
        break;
      case 2:
        additionalInfoRef.current?.submit();
        break;
      case 3:
        photouploadRef.current?.submit();
        break;
      case 4:
        if (isEditMode) {
          arcCardRef.current?.submit();
          break;
        }
        reviewRef.current?.submit();
        break;
      case 5:
        reviewRef.current?.submit();
        break;
      default:
        break;
    }
  };

  const handleBack = () => {
    setErrorMessage(null);
    setCurrentPage((prev) => prev - 1);
  };

  const handleGoToStep = (step: number) => {
    setErrorMessage(null);
    if (step === currentPage || step < 1 || step > steps.length) return;
    ensureCurrentStepDataIsSaved();
    setCurrentPage(step);
  };

  const handleManageAction = async () => {
    if (!isEditMode || !recipientId || !manageAction) return;
    if (
      (manageAction === "FLAG" ||
        manageAction === "UNFLAG" ||
        manageAction === "BAN" ||
        manageAction === "UNBAN") &&
      !manageReason.trim()
    ) {
      setErrorMessage("Reason is required.");
      return;
    }
    setManageSubmitting(true);
    setErrorMessage(null);
    try {
      const response = await fetch(`/api/recipients/${recipientId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: manageAction,
          reason: manageReason.trim(),
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || "Failed to complete action");
      }

      if (manageAction === "DELETE") {
        setManageAction(null);
        setManageReason("");
        onClose();
        onSuccess?.();
        return;
      }

      await loadRecipient();
      setManageAction(null);
      setManageReason("");
      onSuccess?.();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to complete action.",
      );
    } finally {
      setManageSubmitting(false);
    }
  };

  const renderCurrentPage = () => {
    switch (currentPage) {
      case 1:
        return (
          <RegisterRecipientForm
            ref={personalDetailsRef}
            onSubmit={handlePersonalDetailsSubmit}
            onError={setErrorMessage}
            initialData={formData.personalDetails}
          />
        );
      case 2:
        return (
          <AdditionalInfoForm
            ref={additionalInfoRef}
            onSubmit={handleAdditionalInfoSubmit}
            onError={setErrorMessage}
            initialData={formData.additionalInfo}
            requireArcCard={!isEditMode}
          />
        );
      case 3:
        return (
          <PhotoUploadForm
            ref={photouploadRef}
            onSubmit={handlePhotoUploadSubmit}
            onError={setErrorMessage}
            initialData={formData.photoUpload}
          />
        );
      case 4:
        if (isEditMode) {
          return (
            <ArcCardSection
              ref={arcCardRef}
              onSubmit={(data) => {
                setErrorMessage(null);
                setFormData((prev) => ({ ...prev, arcCard: data }));
                setCompletedSteps((prev) => new Set(prev).add(4));
                setCurrentPage(5);
              }}
              onError={setErrorMessage}
              initialData={formData.arcCard}
            />
          );
        }
        return (
          <ReviewDetails
            formData={formData}
            goToPersonal={() => handleGoToStep(1)}
            goToAdditionalInfo={() => handleGoToStep(2)}
            goToPhotoUpload={() => handleGoToStep(3)}
            showArcCard={!isEditMode}
          />
        );
      case 5:
        if (isEditMode) {
          return (
            <ReviewDetails
              formData={formData}
              goToPersonal={() => handleGoToStep(1)}
              goToAdditionalInfo={() => handleGoToStep(2)}
              goToPhotoUpload={() => handleGoToStep(3)}
              showArcCard={false}
            />
          );
        }
        return <div>Step not implemented yet.</div>;
      case 6:
        return <HistorySection rows={formData.history ?? []} />;
      default:
        return <div>Step not implemented yet.</div>;
    }
  };

  return (
    <Dialog
      open={open}
      onClose={handleDialogClose}
      className="fixed inset-0 z-50 overflow-y-auto"
    >
      <div className="flex items-center justify-center min-h-screen p-4">
        <div className="fixed inset-0 bg-black/40" aria-hidden="true" />
        <DialogPanel className="bg-white rounded-lg z-20 shadow-lg max-w-7xl w-full flex flex-col h-[90vh]">
          {/* Modal Header */}
          <div className="flex-shrink-0 flex items-start justify-between bg-offWhite p-4 rounded-t-lg border-b-2">
            <DialogTitle className="text-lg font-medium">
              {isEditMode ? "Edit Recipient" : "New Recipient"}
            </DialogTitle>
            {isEditMode && (
              <div className="relative mr-2">
                <button
                  type="button"
                  onClick={() => setManageMenuOpen((prev) => !prev)}
                  className="inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-2 py-1 text-sm text-gray-700 hover:bg-gray-50"
                >
                  <MoreHorizontal className="h-4 w-4" />
                  Manage Account
                </button>
                {manageMenuOpen && (
                  <div className="absolute right-0 mt-2 w-44 rounded-md border border-gray-200 bg-white shadow-lg z-40">
                    <button
                      type="button"
                      onClick={() => {
                        setManageAction("DELETE");
                        setManageMenuOpen(false);
                      }}
                      className="block w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"
                    >
                      Delete User
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setManageAction(
                          formData.accountState?.flagged ? "UNFLAG" : "FLAG",
                        );
                        setManageMenuOpen(false);
                      }}
                      className="block w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                    >
                      {formData.accountState?.flagged ? "Unflag User" : "Flag User"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setManageAction(
                          formData.accountState?.banned ? "UNBAN" : "BAN",
                        );
                        setManageMenuOpen(false);
                      }}
                      className="block w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                    >
                      {formData.accountState?.banned ? "Unban User" : "Ban User"}
                    </button>
                  </div>
                )}
              </div>
            )}
            <button
              type="button"
              aria-label="Close"
              disabled={isSubmitting}
              onClick={handleClose}
              className="ml-3 inline-flex items-center justify-center rounded-md p-1 text-gray-500 hover:text-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <span className="sr-only">Close</span>✕
            </button>
          </div>
          {/* Modal Body */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 flex-grow bg-lightGrey overflow-hidden">
            {/* Sidebar (small column) */}
            <SidebarSteps
              currentPage={currentPage}
              goToStep={handleGoToStep}
              completedSteps={completedSteps}
              steps={sidebarSteps}
              separateStep={separateHistoryStep}
            />

            {/* Form (larger column) */}
            <section className="md:col-span-3 overflow-y-auto p-4">
              {isLoadingProfile ? (
                <div className="flex h-full items-center justify-center text-gray-500">
                  Loading recipient...
                </div>
              ) : (
                renderCurrentPage()
              )}
            </section>
          </div>
          {/* Modal Footer */}
          <div className="flex items-center justify-end bg-offWhite rounded-b-lg p-4 border-t-2">
            <div className="text-sm text-red-600 font-medium mr-4">
              {errorMessage && <span>{errorMessage}</span>}
            </div>
            <div>
              {currentPage > 1 && (
                <button
                  onClick={handleBack}
                  disabled={isSubmitting}
                  className="px-3 py-2 text-primary disabled:cursor-not-allowed disabled:opacity-50"
                >
                  ← Back
                </button>
              )}
            </div>
            <button
              disabled={isSubmitting}
              onClick={
                isEditMode && currentPage === 6
                  ? handleClose
                  : (isEditMode ? currentPage === 5 : currentPage === 4)
                    ? handleFinalSubmit
                    : handleContinue
              }
              className="px-3 py-2 bg-primary text-white rounded-xl disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isEditMode && currentPage === 6
                ? "Done"
                : (isEditMode ? currentPage === 5 : currentPage === 4)
                ? isSubmitting
                  ? isEditMode ? "Saving..." : "Finishing..."
                  : isEditMode ? "Save Changes" : "Finish Registration"
                : "Continue →"}
            </button>
          </div>
        </DialogPanel>
      </div>
      {manageAction && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900">
              {manageAction === "DELETE"
                ? "Delete Recipient"
                : manageAction === "FLAG"
                  ? "Flag Recipient"
                  : manageAction === "UNFLAG"
                    ? "Unflag Recipient"
                    : manageAction === "UNBAN"
                      ? "Unban Recipient"
                      : "Ban Recipient"}
            </h3>
            <p className="mt-2 text-sm text-gray-600">
              {manageAction === "DELETE"
                ? "This will permanently remove this recipient and unlink any assigned cards."
                : manageAction === "FLAG"
                  ? "Provide the reason for flagging this recipient."
                  : manageAction === "UNFLAG"
                    ? "Provide the reason for removing the flag from this recipient."
                    : manageAction === "UNBAN"
                      ? "Provide the reason for removing the ban from this recipient."
                      : "Provide the reason for banning this recipient. Any assigned cards will be unassigned."}
            </p>
            {manageAction !== "DELETE" && (
              <textarea
                value={manageReason}
                onChange={(e) => setManageReason(e.target.value)}
                className="mt-3 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                rows={3}
                placeholder="Reason (required)"
              />
            )}
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  if (manageSubmitting) return;
                  setManageAction(null);
                  setManageReason("");
                }}
                className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={manageSubmitting}
                onClick={handleManageAction}
                className={`rounded-md px-3 py-2 text-sm text-white ${
                  manageAction === "DELETE" || manageAction === "BAN"
                    ? "bg-red-600 hover:bg-red-700"
                    : "bg-primary hover:bg-cyan-600"
                } disabled:opacity-50`}
              >
                {manageSubmitting ? "Working..." : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}
    </Dialog>
  );
};

export default RegisterRecipientModal;
