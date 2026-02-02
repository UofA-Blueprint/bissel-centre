import React, { forwardRef, useImperativeHandle, useState } from "react";
import CustomListbox from "./CustomListbox";

export type RecipientFormData = {
  firstName: string;
  lastName: string;
  alias?: string;
  gender?: string;
  phone?: string;
  email?: string;
  dob?: string;
  address?: string;
  postalCode?: string;
};

type Props = {
  onSubmit: (data: RecipientFormData) => void;
  onError?: (msg: string | null) => void;
  initialData?: Partial<RecipientFormData>;
};

const genders = ["Female", "Male", "Non-binary", "Prefer not to say", "Other"];

const RegisterRecipientForm = forwardRef<{ submit: () => void }, Props>(
  ({ onSubmit, onError, initialData = {} }, ref) => {
    const [firstName, setFirstName] = useState(initialData.firstName || "");
    const [lastName, setLastName] = useState(initialData.lastName || "");
    const [alias, setAlias] = useState(initialData.alias || "");
    const [gender, setGender] = useState<string>(initialData.gender || "");
    const [phone, setPhone] = useState(initialData.phone || "");
    const [dob, setDob] = useState(initialData.dob || "");
    const [email, setEmail] = useState(initialData.email || "");
    const [address, setAddress] = useState(initialData.address || "");
    const [postalCode, setPostalCode] = useState(initialData.postalCode || "");

    const collect = (): RecipientFormData => ({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      alias: alias.trim(),
      email: email.trim(),
      gender,
      phone: phone.trim(),
      dob: dob.trim(),
      address: address.trim(),
      postalCode: postalCode.trim(),
    });

    const validate = (data: RecipientFormData): string | null => {
      // Validate required fields
      if (!data.firstName || !data.lastName || !data.postalCode) {
        return "First name, last name, postal code, and one of email or phone are required.";
      }

      // Validate that at least one contact method is provided
      if (!data.email && !data.phone) {
        return "Please provide either an email address or phone number.";
      }

      // Validate postal code format (Canadian: A1A1A1 or A1A 1A1)
      const postalCodeRegex = /^[A-Za-z]\d[A-Za-z]\s?\d[A-Za-z]\d$/;
      if (!postalCodeRegex.test(data.postalCode)) {
        return "Invalid postal code format. Please use the format A1A1A1 (e.g., T5Z1H3 or T5Z 1H3).";
      }

      return null;
    };

    const handleSubmit = () => {
      const data = collect();
      const error = validate(data);

      if (error) {
        onError?.(error);
        return;
      }

      onError?.(null);
      onSubmit(data);
    };

    useImperativeHandle(ref, () => ({
      submit: handleSubmit,
      getData: collect,
      validate: () => validate(collect()),
    }));

    return (
      <form
        className="space-y-5"
        onSubmit={(e) => {
          e.preventDefault();
          handleSubmit();
        }}
      >
        <h1 className="text-lg font-medium text-gray-600">
          Please enter the recipient&apos;s personal information
        </h1>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <label className="flex flex-col">
            <span className="text-sm">
              First name <span className="text-red-500">*</span>
            </span>
            <input
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              type="text"
              name="firstName"
              placeholder="Recipient's first name"
              className="mt-1 text-sm font-normal border rounded-xl px-3 py-3 focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </label>

          <label className="flex flex-col">
            <span className="text-sm">
              Last name <span className="text-red-500">*</span>
            </span>
            <input
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              type="text"
              name="lastName"
              placeholder="Recipient's last name"
              className="mt-1 text-sm font-normal border rounded-xl px-3 py-3 focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </label>

          <label className="flex flex-col">
            <span className="text-sm">Alias</span>
            <input
              value={alias}
              onChange={(e) => setAlias(e.target.value)}
              type="text"
              name="alias"
              placeholder="Recipient's alias"
              className="mt-1 text-sm font-normal border rounded-xl px-3 py-3 focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </label>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-start">
          <label className="flex flex-col">
            <CustomListbox
              label="Gender Identity"
              value={gender}
              onChange={setGender}
              options={genders}
            />

            <input type="hidden" name="gender" value={gender} />
          </label>
          <label className="flex flex-col sm:col-span-1">
            <span className="text-sm mb-1">Date of Birth</span>
            <input
              value={dob}
              onChange={(e) => setDob(e.target.value)}
              type="date"
              name="dob"
              className="text-sm font-normal border rounded-xl px-3 py-3 w-full focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </label>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <label className="flex flex-col">
            <span className="text-sm">
              Email{" "}
              <span className="text-gray-500 text-xs">
                (required if no phone)
              </span>
            </span>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              name="email"
              placeholder="Recipient's email"
              className="mt-1 text-sm font-normal border rounded-xl px-3 py-3 w-full focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </label>
          <label className="flex flex-col">
            <span className="text-sm">
              Phone{" "}
              <span className="text-gray-500 text-xs">
                (required if no email)
              </span>
            </span>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              type="tel"
              name="phone"
              placeholder="Recipient's phone"
              className="mt-1 text-sm font-normal border rounded-xl px-3 py-3 w-full focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </label>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <label className="flex flex-col sm:col-span-2">
            <span className="text-sm">Address</span>
            <input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              type="text"
              name="address"
              placeholder="Recipient's address"
              className="mt-1 text-sm font-normal border rounded-xl px-3 py-3 w-full focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </label>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <label className="flex flex-col sm:col-span-3">
            <span className="text-sm">
              Postal Code: Where did the recipient stay last night?{" "}
              <span className="text-red-500">*</span>
              <span className="text-gray-500 text-xs">
                {" "}
                (Format: A1A1A1, e.g., T5Z1H3)
              </span>
            </span>
            <input
              value={postalCode}
              onChange={(e) => setPostalCode(e.target.value.toUpperCase())}
              type="text"
              name="postalCode"
              placeholder="e.g., T5Z1H3"
              maxLength={7}
              className="mt-1 text-sm font-normal border rounded-xl px-3 py-3 w-full sm:w-1/3 focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </label>
        </div>
      </form>
    );
  },
);

RegisterRecipientForm.displayName = "RegisterRecipientForm";

export default RegisterRecipientForm;
