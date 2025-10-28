import React, { useRef, useState } from "react";
import { Dialog, DialogPanel, DialogTitle } from "@headlessui/react";
import RegisterRecipientForm, {
  RecipientFormData,
} from "./PersonalDetailsForm";

type Props = {
  open: boolean;
  onClose: () => void;
};

const RegisterRecipientModal: React.FC<Props> = ({ open, onClose }) => {
  const [submittedData, setSubmittedData] = useState<RecipientFormData | null>(
    null
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const formRef = useRef<{ submit: () => void }>(null);

  const handleFormSubmit = (data: RecipientFormData) => {
    setErrorMessage(null);
    setSubmittedData(data);
    console.log("recipient form submitted", data);
  };
  return (
    <Dialog
      open={open}
      onClose={onClose}
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
              onClick={onClose}
              className="ml-3 inline-flex items-center justify-center rounded-md p-1 text-gray-500 hover:text-gray-700"
            >
              <span className="sr-only">Close</span>✕
            </button>
          </div>
          {/* Modal Body */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 h-[600px] flex-grow bg-lightGrey">
            {/* Sidebar (small column) */}
            <aside className="md:col-span-1 space-y-3 text-sm border-r-2 font-medium p-4">
              <ul className="space-y-4 text-sm">
                <li className="flex items-center">
                  <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-primary text-white text-xs font-semibold mr-3">
                    1
                  </span>
                  <span>Personal Details</span>
                </li>
                <li className="flex items-center">
                  <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-primary text-white text-xs font-semibold mr-3">
                    2
                  </span>
                  <span>Additional Information</span>
                </li>
                <li className="flex items-center">
                  <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-primary text-white text-xs font-semibold mr-3">
                    3
                  </span>
                  <span>Upload Photo</span>
                </li>
                <li className="flex items-center">
                  <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-primary text-white text-xs font-semibold mr-3">
                    4
                  </span>
                  <span>Review</span>
                </li>
              </ul>
            </aside>

            {/* Form (larger column) */}
            <section className="md:col-span-3 overflow-y-auto p-4">
              <RegisterRecipientForm
                ref={formRef}
                onSubmit={handleFormSubmit}
                onError={setErrorMessage}
              />
            </section>
          </div>
          {/* Modal Footer */}
          <div className="flex-shrink-0 bg-offWhite rounded-b-lg p-4 flex items-center justify-end border-t-2">
            <div className="text-sm text-red-600 font-medium mr-4">
              {errorMessage && <span>{errorMessage}</span>}
            </div>
            <button
              onClick={() => formRef.current?.submit()}
              className="px-3 py-2 bg-primary text-white rounded-xl"
            >
              Continue →
            </button>
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  );
};

export default RegisterRecipientModal;
