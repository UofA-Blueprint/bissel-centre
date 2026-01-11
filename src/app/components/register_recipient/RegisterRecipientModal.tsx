import React, { useRef, useState } from "react";
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
};

type FormData = {
  personalDetails?: RecipientFormData;
  additionalInfo?: AdditionalInfoData;
  photoUpload?: PhotoUploadData;
};

const RegisterRecipientModal: React.FC<Props> = ({ open, onClose }) => {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const personalDetailsRef = useRef<{ submit: () => void }>(null);
  const additionalInfoRef = useRef<{ submit: () => void }>(null);
  const photouploadRef = useRef<{ submit: () => void }>(null);
  const reviewRef = useRef<{ submit: () => void }>(null);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [formData, setFormData] = useState<FormData>({});

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
        "Are you sure you want to exit? All entered data will be lost."
      );
      if (!confirmed) {
        return;
      }
      // Clear all form data
      setFormData({});
      setCurrentPage(1);
      setErrorMessage(null);
    }
    onClose();
  };

  const handlePersonalDetailsSubmit = (data: RecipientFormData) => {
    setErrorMessage(null);
    setFormData((prev) => ({ ...prev, personalDetails: data }));
    setCurrentPage(2);
  };

  const handleAdditionalInfoSubmit = (data: AdditionalInfoData) => {
    setErrorMessage(null);
    setFormData((prev) => ({ ...prev, additionalInfo: data }));
    setCurrentPage(3);
  };

  const handlePhotoUploadSubmit = (data: PhotoUploadData) => {
    setErrorMessage(null);
    setFormData((prev) => ({ ...prev, photoUpload: data }));
    setCurrentPage(4);
  };

  const handleFinalSubmit = async () => {
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

      // Clear form and close modal on success
      setFormData({});
      setCurrentPage(1);
      setErrorMessage(null);
      onClose();
    } catch (error) {
      console.error("Registration error:", error);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Failed to register recipient. Please try again."
      );
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
    setErrorMessage(null);
    setCurrentPage(step);
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
        <DialogPanel className="bg-white rounded-lg z-20 shadow-lg max-w-7xl w-full flex flex-col">
          {/* Modal Header */}
          <div className="flex-shrink-0 flex items-start justify-between bg-offWhite p-4 rounded-t-lg border-b-2">
            <DialogTitle className="text-lg font-medium">
              New Recipient
            </DialogTitle>
            <button
              type="button"
              aria-label="Close"
              onClick={handleClose}
              className="ml-3 inline-flex items-center justify-center rounded-md p-1 text-gray-500 hover:text-gray-700"
            >
              <span className="sr-only">Close</span>✕
            </button>
          </div>
          {/* Modal Body */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 h-[600px] flex-grow bg-lightGrey">
            {/* Sidebar (small column) */}
            <SidebarSteps currentPage={currentPage} goToStep={handleGoToStep} />

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
              {currentPage > 1 && (
                <button onClick={handleBack} className="px-3 py-2 text-primary">
                  ← Back
                </button>
              )}
            </div>
            <button
              onClick={currentPage === 4 ? handleFinalSubmit : handleContinue}
              className="px-3 py-2 bg-primary text-white rounded-xl"
            >
              {currentPage === 4 ? "Finish Registration" : "Continue →"}
            </button>
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  );
};

export default RegisterRecipientModal;
