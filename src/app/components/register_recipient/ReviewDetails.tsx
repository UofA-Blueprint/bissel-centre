import React from "react";
// Import the data types from your form components
import { RecipientFormData } from "./PersonalDetailsForm";
import { AdditionalInfoData } from "./AdditionalInfoForm";
import { PhotoUploadData } from "./PhotoUploadForm";

// A single type to represent all the data collected in the modal
type FullFormData = {
  personalDetails?: RecipientFormData;
  additionalInfo?: AdditionalInfoData;
  photoUpload?: PhotoUploadData;
};

// Props for our component
type Props = {
  formData: FullFormData;
};

// A small helper component to keep the main JSX clean and consistent
const DetailItem = ({
  label,
  value,
  className,
}: {
  label: string;
  value?: string;
  className?: string;
}) => (
  <div className={className}>
    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
      {label}
    </p>
    <p className="text-sm text-gray-800 mt-1">{value || "N/A"}</p>
  </div>
);

const ReviewDetails: React.FC<Props> = ({ formData }) => {
  const { personalDetails, additionalInfo, photoUpload } = formData;

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-medium text-gray-700">
        Carefully review the inputted information
      </h1>

      {/* --- Photo Display --- */}
      <div className="flex justify-center py-4">
        <div className="relative">
          {photoUpload?.imageUrl ? (
            // We use a standard <img> tag here because the imageUrl is a temporary
            // 'blob:' URL from the client's browser, which next/image cannot optimize.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={photoUpload.imageUrl}
              alt="Recipient"
              className="w-32 h-32 rounded-full object-cover shadow-md"
            />
          ) : (
            // Fallback if no image was uploaded
            <div className="w-32 h-32 rounded-full bg-gray-200 flex items-center justify-center">
              <span className="text-sm text-gray-500">No Photo</span>
            </div>
          )}
        </div>
      </div>

      {/* --- Personal Details Section --- */}
      <div className="bg-gray-50 rounded-xl p-6 shadow-sm border border-gray-200">
        <div className="flex justify-between items-center border-b border-gray-200 pb-4 mb-6">
          <h2 className="text-lg font-semibold text-gray-800">
            Personal Details
          </h2>
          <button
            type="button"
            className="text-sm flex items-center space-x-2 px-3 py-1.5 border border-gray-300 rounded-lg text-primary bg-white cursor-not-allowed opacity-60"
            aria-disabled="true"
          >
            {/* You can add an edit icon here later if needed */}
            <span>Edit</span>
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-y-6 gap-x-4">
          <DetailItem label="First Name" value={personalDetails?.firstName} />
          <DetailItem label="Last Name" value={personalDetails?.lastName} />
          <DetailItem label="Alias" value={personalDetails?.alias} />
          <DetailItem label="Gender Identity" value={personalDetails?.gender} />
          <DetailItem label="Date of Birth" value={personalDetails?.dob} />
          <DetailItem /> {/* Empty item for grid alignment */}
          <DetailItem label="Email" value={personalDetails?.email} />
          <DetailItem label="Phone Number" value={personalDetails?.phone} />
          <DetailItem /> {/* Empty item for grid alignment */}
          <DetailItem
            label="Address"
            value={personalDetails?.address}
            className="sm:col-span-3"
          />
          <DetailItem
            label="Postal Code: In what area did the recipient stay last night?"
            value={personalDetails?.postalCode}
            className="sm:col-span-3"
          />
        </div>
      </div>

      {/* --- Additional Information Section --- */}
      <div className="bg-gray-50 rounded-xl p-6 shadow-sm border border-gray-200">
        <div className="flex justify-between items-center border-b border-gray-200 pb-4 mb-6">
          <h2 className="text-lg font-semibold text-gray-800">
            Additional Information
          </h2>
          <button
            type="button"
            className="text-sm flex items-center space-x-2 px-3 py-1.5 border border-gray-300 rounded-lg text-primary bg-white cursor-not-allowed opacity-60"
            aria-disabled="true"
          >
            <span>Edit</span>
          </button>
        </div>
        <div className="space-y-6">
          <DetailItem
            label="Journey to sustainable and affordable transit"
            value={additionalInfo?.journey}
          />
          <DetailItem
            label="Most common reason for bus pass use last month"
            value={additionalInfo?.mostCommonReason}
          />
          <DetailItem
            label="Second most common reason for bus pass use last month"
            value={additionalInfo?.secondMostCommonReason}
          />
          <DetailItem
            label="Most common housing option last month"
            value={additionalInfo?.housingOption}
          />
          <DetailItem
            label="Last 7 Digits of the Arc Card"
            value={additionalInfo?.arcCardDigits}
          />
          <DetailItem label="Other/Notes" value={additionalInfo?.notes} />
        </div>
      </div>
    </div>
  );
};

export default ReviewDetails;
