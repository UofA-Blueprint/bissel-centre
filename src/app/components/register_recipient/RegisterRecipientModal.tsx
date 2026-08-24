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
  /** UUID from ?register= — indexes this draft in sessionStorage. */
  draftId: string | null;
  /** Current wizard step (1-4) from ?step= — URL is the source of truth. */
  step: number;
  onStepChange: (step: number) => void;
  onClose: () => void;
  onSuccess?: () => void;
};

type FormData = {
  personalDetails?: RecipientFormData;
  additionalInfo?: AdditionalInfoData;
  photoUpload?: PhotoUploadData;
};

type DraftEnvelope = {
  data: FormData;
  completedSteps: number[];
  createdAt?: number;
  updatedAt?: number;
};

// Multiple drafts live side by side, indexed by uuid. Text fields (and a
// COMPLETED photo, stored as base64) survive reloads; a merely-selected photo
// is a blob: URL tied to the document and cannot survive, so it is stripped
// before persisting.
export const draftStorageKey = (id: string) => `recipient-draft:${id}`;

const persistableData = (data: FormData): FormData => {
  if (data.photoUpload?.imageUrl?.startsWith("blob:")) {
    const { photoUpload: _dropped, ...rest } = data;
    return rest;
  }
  return data;
};

const RegisterRecipientModal: React.FC<Props> = ({
  open,
  draftId,
  step,
  onStepChange,
  onClose,
  onSuccess,
}) => {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [draftNotice, setDraftNotice] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const personalDetailsRef = useRef<{ submit: () => void }>(null);
  const additionalInfoRef = useRef<{ submit: () => void }>(null);
  const photouploadRef = useRef<{ submit: () => void }>(null);
  const reviewRef = useRef<{ submit: () => void }>(null);
  const [formData, setFormData] = useState<FormData>({});
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());

  // ── Load draft when the modal opens / the uuid changes ─────────
  useEffect(() => {
    if (!open || !draftId) return;
    setErrorMessage(null);
    setDraftNotice(null);
    try {
      const raw = sessionStorage.getItem(draftStorageKey(draftId));
      if (raw) {
        const parsed = JSON.parse(raw) as DraftEnvelope;
        setFormData(persistableData(parsed.data ?? {}));
        setCompletedSteps(new Set(parsed.completedSteps ?? []));
        return;
      }
    } catch {
      // Corrupted entry — treat the same as missing.
    }
    // Edge case: the uuid is not in sessionStorage (link opened in another
    // tab, session ended, or storage was cleared). Start fresh under the
    // same uuid and say so.
    setFormData({});
    setCompletedSteps(new Set());
    setDraftNotice(
      "This draft couldn't be restored — it may be from another tab or an ended session. Starting a fresh registration.",
    );
    try {
      sessionStorage.setItem(
        draftStorageKey(draftId),
        JSON.stringify({ data: {}, completedSteps: [], createdAt: Date.now() }),
      );
    } catch {
      /* storage unavailable — form still works, just won't restore */
    }
  }, [open, draftId]);

  // ── Persist draft on every change ──────────────────────────────
  useEffect(() => {
    if (!open || !draftId) return;
    try {
      const envelope: DraftEnvelope = {
        data: persistableData(formData),
        completedSteps: Array.from(completedSteps),
        updatedAt: Date.now(),
      };
      sessionStorage.setItem(draftStorageKey(draftId), JSON.stringify(envelope));
    } catch {
      setErrorMessage(
        "Draft could not be saved locally (browser storage may be full). You can continue, but a reload will not restore this form.",
      );
    }
  }, [open, draftId, formData, completedSteps]);

  // ── Step submit handlers (Continue button — validated paths) ───
  const handlePersonalDetailsSubmit = (data: RecipientFormData) => {
    setErrorMessage(null);
    setFormData((prev) => ({ ...prev, personalDetails: data }));
    setCompletedSteps((prev) => new Set(prev).add(1));
    onStepChange(2);
  };

  const handleAdditionalInfoSubmit = (data: AdditionalInfoData) => {
    setErrorMessage(null);
    setFormData((prev) => ({ ...prev, additionalInfo: data }));
    setCompletedSteps((prev) => new Set(prev).add(2));
    onStepChange(3);
  };

  const handlePhotoUploadSubmit = (data: PhotoUploadData) => {
    setErrorMessage(null);
    setFormData((prev) => ({ ...prev, photoUpload: data }));
    setCompletedSteps((prev) => new Set(prev).add(3));
    onStepChange(4);
  };

  // ── Free navigation: collect current page without validating ───
  const collectCurrentPage = () => {
    /* eslint-disable @typescript-eslint/no-explicit-any */
    let patch: Partial<FormData> = {};
    if (step === 1) {
      const d = (personalDetailsRef.current as any)?.getData?.();
      if (d) patch = { personalDetails: d };
    } else if (step === 2) {
      const d = (additionalInfoRef.current as any)?.getData?.();
      if (d) patch = { additionalInfo: d };
    } else if (step === 3) {
      const d = (photouploadRef.current as any)?.getData?.();
      if (d) patch = { photoUpload: d };
    }
    /* eslint-enable @typescript-eslint/no-explicit-any */
    if (Object.keys(patch).length > 0) {
      setFormData((prev) => ({ ...prev, ...patch }));
    }
  };

  const handleGoToStep = (target: number) => {
    if (target === step || target < 1 || target > 4) return;
    setErrorMessage(null);
    collectCurrentPage();
    onStepChange(target);
  };

  const handleBack = () => {
    setErrorMessage(null);
    collectCurrentPage();
    onStepChange(step - 1);
  };

  const handleContinue = () => {
    setErrorMessage(null);
    switch (step) {
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
        void handleFinalSubmit();
        break;
      default:
        break;
    }
  };

  // ── Final submit: cross-step validation with step-labeled errors
  //    (free jumping means any step can be incomplete at this point) ──
  const validateAll = (): { step: number; message: string } | null => {
    const pd = formData.personalDetails;
    if (!pd?.firstName?.trim()) {
      return { step: 1, message: "Step 1 (Personal Details): name is required." };
    }
    if (!pd?.email?.trim()) {
      return { step: 1, message: "Step 1 (Personal Details): email is required." };
    }
    if (!pd?.postalCode?.trim()) {
      return {
        step: 1,
        message: "Step 1 (Personal Details): postal code is required.",
      };
    }
    const postalCodeRegex = /^[A-Za-z]\d[A-Za-z]\s?\d[A-Za-z]\d$/;
    if (!postalCodeRegex.test(pd.postalCode.trim())) {
      return {
        step: 1,
        message:
          "Step 1 (Personal Details): postal code must use the format A1A1A1 (e.g., T5Z1H3).",
      };
    }
    const photo = formData.photoUpload?.imageUrl;
    if (!photo) {
      return {
        step: 3,
        message:
          "Step 3 (Photo): a recipient photo is required. Photos are not restored after a reload — please add it again.",
      };
    }
    if (!photo.startsWith("data:")) {
      return {
        step: 3,
        message:
          "Step 3 (Photo): the photo hasn't been processed yet — press Continue on the photo step to finish it.",
      };
    }
    return null;
  };

  const handleFinalSubmit = async () => {
    if (submittingRef.current) return;

    const invalid = validateAll();
    if (invalid) {
      setErrorMessage(invalid.message);
      onStepChange(invalid.step);
      return;
    }

    submittingRef.current = true;
    setIsSubmitting(true);
    try {
      setErrorMessage(null);

      const response = await fetch("/api/register-recipient", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to register recipient");
      }

      // Success: this draft is done — remove it from the index.
      if (draftId) {
        try {
          sessionStorage.removeItem(draftStorageKey(draftId));
        } catch {
          /* ignore */
        }
      }
      setFormData({});
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
          : "Failed to register recipient. Please try again.",
      );
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  // Closing keeps the draft in sessionStorage — reopening the same URL (or
  // browser-back) restores it, so no destructive-close confirmation needed.
  const handleClose = () => {
    if (isSubmitting) return;
    collectCurrentPage();
    onClose();
  };

  const renderCurrentPage = () => {
    switch (step) {
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
              New Recipient
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
          {draftNotice && (
            <div className="flex items-center justify-between gap-3 border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-800">
              <span>{draftNotice}</span>
              <button
                type="button"
                onClick={() => setDraftNotice(null)}
                className="shrink-0 rounded p-0.5 text-amber-600 hover:bg-amber-100"
              >
                ✕
              </button>
            </div>
          )}
          {/* Modal Body */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 flex-grow bg-lightGrey overflow-hidden">
            {/* Sidebar (small column) */}
            <SidebarSteps
              currentPage={step}
              goToStep={handleGoToStep}
              completedSteps={completedSteps}
            />

            {/* Form (larger column) */}
            <section className="md:col-span-3 overflow-y-auto p-4">
              {renderCurrentPage()}
            </section>
          </div>
          {/* Modal Footer */}
          <div className="flex items-center justify-end bg-offWhite rounded-b-lg p-4 border-t-2">
            <div className="text-sm text-red-600 font-medium mr-4">
              {errorMessage && <span>{errorMessage}</span>}
            </div>
            <div>
              {step > 1 && (
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
              onClick={step === 4 ? () => void handleFinalSubmit() : handleContinue}
              className="px-3 py-2 bg-primary text-white rounded-xl disabled:cursor-not-allowed disabled:opacity-50"
            >
              {step === 4
                ? isSubmitting
                  ? "Finishing..."
                  : "Finish Registration"
                : "Continue →"}
            </button>
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  );
};

export default RegisterRecipientModal;
