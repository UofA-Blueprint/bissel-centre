import React, { forwardRef, useImperativeHandle, useState } from "react";
import {
  Listbox,
  ListboxButton,
  ListboxOptions,
  ListboxOption,
} from "@headlessui/react";
import ChevronDownIcon from "../icons/ChevronDownIcon";
import CheckIcon from "../icons/CheckIcon";
import clsx from "clsx";

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
};

const genders = ["Female", "Male", "Non-binary", "Prefer not to say", "Other"];

const RegisterRecipientForm = forwardRef<{ submit: () => void }, Props>(
  ({ onSubmit, onError }, ref) => {
    const [firstName, setFirstName] = useState("");
    const [lastName, setLastName] = useState("");
    const [alias, setAlias] = useState("");
    const [gender, setGender] = useState<string>("");
    const [phone, setPhone] = useState("");
    const [dob, setDob] = useState("");
    const [email, setEmail] = useState("");
    const [address, setAddress] = useState("");
    const [postalCode, setPostalCode] = useState("");

    const collect = (): RecipientFormData => ({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      alias: alias.trim(),
      gender,
      phone: phone.trim(),
      dob: dob.trim(),
      address: address.trim(),
      postalCode: postalCode.trim(),
    });

    const handleSubmit = () => {
      const data = collect();

      // Validate required fields
      if (!data.firstName || !data.lastName || !data.postalCode) {
        const msg = "First name, last name, and postal code are required.";
        onError?.(msg);
        return;
      }

      onError?.(null);
      onSubmit(data);
    };

    useImperativeHandle(ref, () => ({
      submit: handleSubmit,
    }));

    return (
      <form
        className="space-y-6"
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
            <span className="text-sm mb-1">Gender Identity</span>

            <Listbox value={gender} onChange={(v) => setGender(v ?? "")}>
              <div className="relative">
                <ListboxButton
                  className={clsx(
                    "relative font-normal block w-full rounded-lg bg-white py-3 pr-8 pl-3 text-left text-sm text-gray-900 border",
                    "focus:outline-none focus:ring-2 focus:ring-primary"
                  )}
                >
                  <span
                    className={clsx("truncate", !gender && "text-gray-400")}
                  >
                    {gender || "Select gender"}
                  </span>
                  <ChevronDownIcon
                    className="pointer-events-none absolute top-2.5 right-2.5 h-4 w-4 text-gray-600"
                    aria-hidden="true"
                  />
                </ListboxButton>

                <ListboxOptions className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md bg-white py-1 text-base shadow-lg ring-1 ring-black/5 focus:outline-none sm:text-sm">
                  {genders.map((g) => (
                    <ListboxOption
                      key={g}
                      value={g}
                      className="font-normal flex items-center gap-2 rounded-md px-3 py-1.5 select-none"
                    >
                      {({ selected }) => (
                        <>
                          <CheckIcon
                            className={clsx(
                              selected
                                ? "h-4 w-4 text-primary"
                                : "invisible h-4 w-4"
                            )}
                          />
                          <div
                            className={clsx(
                              "text-sm",
                              selected && "font-semibold"
                            )}
                          >
                            {g}
                          </div>
                        </>
                      )}
                    </ListboxOption>
                  ))}
                </ListboxOptions>
              </div>
            </Listbox>

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
            <span className="text-sm">Email</span>
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
            <span className="text-sm">Phone</span>
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
          <label className="flex flex-col col-span-1">
            <span className="text-sm">
              Postal Code: Where did the recipient stay last night?{" "}
              <span className="text-red-500">*</span>
            </span>
            <input
              value={postalCode}
              onChange={(e) => setPostalCode(e.target.value)}
              type="text"
              name="postalCode"
              placeholder="Recipient's postal code"
              className="mt-1 text-sm font-normal border rounded-xl px-3 py-3 w-full focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </label>
        </div>
      </form>
    );
  }
);

RegisterRecipientForm.displayName = "RegisterRecipientForm";

export default RegisterRecipientForm;
