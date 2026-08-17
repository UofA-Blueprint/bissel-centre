import React, { useEffect, useRef, useState } from "react";
import { Dialog, DialogPanel, DialogTitle } from "@headlessui/react";
import RegisterRecipientForm, {
  RecipientFormData,
} from "./PersonalDetailsForm";
import AdditionalInfoForm, { AdditionalInfoData } from "./AdditionalInfoForm";
import PhotoUploadForm, { PhotoUploadData } from "./PhotoUploadForm";
import ReviewDetails from "./ReviewDetails";
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
  const reviewRef = useRef<{ submit: () => void }>(null);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [formData, setFormData] = useState<FormData>({});
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);
  const isEditMode = mode === "edit";

  useEffect(() => {
    if (!open || !isEditMode || !recipientId) return;

    let cancelled = false;
    setIsLoadingProfile(true);
    setErrorMessage(null);
    fetch(`/api/recipients/${recipientId}`)
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Failed to load recipient");
        return data as FormData;
      })
      .then((data) => {
        if (cancelled) return;
        setFormData(data);
        setCurrentPage(1);
        setCompletedSteps(new Set());
      })
      .catch((error) => {
        if (!cancelled) {
          setErrorMessage(error instanceof Error ? error.message : "Failed to load recipient");
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoadingProfile(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, isEditMode, recipientId]);

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
    }
    onClose();
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

  const handleFinalSubmit = async () => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setIsSubmitting(true);
    try {
      setErrorMessage(null);

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
    if (step < completedSteps.size + 2) {
      setErrorMessage(null);

      // Don't validate or save if navigating to the current page
      if (step === currentPage) {
        return;
      }

      // Save current form data before navigating
      // Only validate if we're navigating from a page we've already been on (not the current one)
      let shouldNavigate = true;

      if (currentPage === 1 && personalDetailsRef.current) {
        const data = (personalDetailsRef.current as any).getData?.();
        if (data) {
          setFormData((prev) => ({ ...prev, personalDetails: data }));
        }

        // If this page is completed, validate before allowing navigation
        if (completedSteps.has(currentPage)) {
          const error = (personalDetailsRef.current as any).validate?.();
          if (error) {
            setErrorMessage(error);
            shouldNavigate = false;
          }
        }
      } else if (currentPage === 2 && additionalInfoRef.current) {
        const data = (additionalInfoRef.current as any).getData?.();
        if (data) {
          setFormData((prev) => ({ ...prev, additionalInfo: data }));
        }

        // If this page is completed, validate before allowing navigation
        if (completedSteps.has(currentPage)) {
          const error = (additionalInfoRef.current as any).validate?.();
          if (error) {
            setErrorMessage(error);
            shouldNavigate = false;
          }
        }
      } else if (currentPage === 3 && photouploadRef.current) {
        const data = (photouploadRef.current as any).getData?.();
        if (data) {
          setFormData((prev) => ({ ...prev, photoUpload: data }));
        }

        // If this page is completed, validate before allowing navigation
        if (completedSteps.has(currentPage)) {
          const error = (photouploadRef.current as any).validate?.();
          if (error) {
            setErrorMessage(error);
            shouldNavigate = false;
          }
        }
      }

      if (shouldNavigate) {
        setCurrentPage(step);
      }
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
        return (
          <ReviewDetails
            formData={formData}
            goToPersonal={() => handleGoToStep(1)}
            goToAdditionalInfo={() => handleGoToStep(2)}
            goToPhotoUpload={() => handleGoToStep(3)}
            showArcCard={!isEditMode}
          />
        );
      default:
        return <div>Step not implemented yet.</div>;
    }
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
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
              onClick={currentPage === 4 ? handleFinalSubmit : handleContinue}
              className="px-3 py-2 bg-primary text-white rounded-xl disabled:cursor-not-allowed disabled:opacity-50"
            >
              {currentPage === 4
                ? isSubmitting
                  ? isEditMode ? "Saving..." : "Finishing..."
                  : isEditMode ? "Save Changes" : "Finish Registration"
                : "Continue →"}
            </button>
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  );
};

export default RegisterRecipientModal;
