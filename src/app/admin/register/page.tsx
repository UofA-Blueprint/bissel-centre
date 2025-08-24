"use client";
import React, { useState } from "react";
import Image from "next/image";
import { Dialog, DialogTitle, Description } from "@headlessui/react";

type FormDataKeys = keyof typeof initialFormData;

type FormField = {
  id: string;
  name: FormDataKeys;
  label: string;
  type: string;
  hint?: string;
};

const initialFormData = {
  firstName: "",
  lastName: "",
  email: "",
  identificationNumber: "",
};

const initialErrors = {
  firstName: "",
  lastName: "",
  email: "",
  identificationNumber: "",
};

const AdminRegistration: React.FC = () => {
  const [formData, setFormData] =
    useState<typeof initialFormData>(initialFormData);
  const [errors, setErrors] = useState<typeof initialErrors>(initialErrors);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const validateForm = (): boolean => {
    const newErrors = {
      firstName: formData.firstName.trim() ? "" : "First name is required",
      lastName: formData.lastName.trim() ? "" : "Last name is required",
      identificationNumber: formData.identificationNumber.trim()
        ? ""
        : "Identification number is required",
      email: formData.email.trim() ? "" : "Email is required",
    };

    if (formData.firstName && !/^[A-Za-z]+$/.test(formData.firstName)) {
      newErrors.firstName = "First name must contain only letters";
    }

    if (formData.lastName && !/^[A-Za-z]+$/.test(formData.lastName)) {
      newErrors.lastName = "Last name must contain only letters";
    }

    setErrors(newErrors);

    return Object.values(newErrors).every((error) => error === "");
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);

    if (!validateForm()) {
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch("/api/register-staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: formData.firstName,
          lastName: formData.lastName,
          email: formData.email,
          identificationNumber: formData.identificationNumber,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        // Handle errors from the API (e.g., email in use, invalid ID)
        const apiError = data.error || "An unknown error occurred.";
        if (response.status === 409) {
          // Email exists
          setErrors((prev) => ({ ...prev, email: apiError }));
        } else if (response.status === 403) {
          // Invalid ID
          setErrors((prev) => ({ ...prev, identificationNumber: apiError }));
        } else {
          // Generic error for other cases
          setErrors((prev) => ({ ...prev, emailAddress: apiError }));
        }
        return;
      }

      setFormData(initialFormData);
      setDialogOpen(true);
    } catch (error) {
      console.error("Error during registration submission:", error);
      setErrors((prevErrors) => ({
        ...prevErrors,
        emailAddress: "Failed to register. Please try again.",
      }));
    } finally {
      setIsLoading(false);
    }
  };

  const formFields: FormField[] = [
    { id: "first-name", name: "firstName", label: "First Name", type: "text" },
    { id: "last-name", name: "lastName", label: "Last Name", type: "text" },
    {
      id: "identification-number",
      name: "identificationNumber",
      label: "Identification Number",
      type: "text",
      hint: "Enter your identification number"
    },
    { id: "email", name: "email", label: "Email Address", type: "text" },
  ];

  return (
    <div className="flex flex-col items-center w-full pt-10">
      <Image
        src="/BissellLogo_Blue 1.svg"
        alt="Bissell Logo"
        width={150}
        height={75}
      />
      <div
        className="border border-gray-200 rounded-2xl p-6 mt-2 lg:mt-12 shadow-md"
        style={{ backgroundColor: "#FAFAFA" }}
      >
        <form
          className={`mt-4 text-sm ${
            isLoading ? "opacity-50 pointer-events-none" : ""
          }`}
          onSubmit={handleSubmit}
        >
          <div className="grid grid-cols-[300px] lg:grid-cols-[300px_300px] gap-x-6">
            {formFields.map((field) => (
              <div key={field.id} className="flex flex-col">
                <label htmlFor={field.id} className="font-bold pb-2">
                  {field.label} <span className="text-red-600">*</span>
                </label>
                <input
                  type={field.type}
                  id={field.id}
                  name={field.name}
                  placeholder={field.hint ? field.hint : `Enter the user's ${field.label.toLowerCase()}`}
                  className={`p-2 border shadow-sm rounded-xl ${
                    errors[field.name] ? "border-red-600" : "border-gray-200"
                  }`}
                  value={formData[field.name]}
                  onChange={handleChange}
                />
                <div className="min-h-5">
                  {errors[field.name] && (
                    <span className="text-red-600 text-xs error-text">
                      {errors[field.name]}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>

          <button
            className="p-2 text-white rounded-xl w-full mt-4"
            disabled={isLoading}
            style={{ backgroundColor: "#1BC0D6" }}
            type="submit"
          >
            Register →
          </button>
        </form>
      </div>
      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        className="fixed z-10 inset-0 overflow-y-auto"
      >
        <div className="flex items-center justify-center min-h-screen">
          <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
          <div className="bg-white z-10 rounded-lg p-6 mx-auto max-w-sm">
            <DialogTitle className="text-lg font-bold">Success</DialogTitle>
            <Description className="mt-2 text-sm text-gray-500">
              Registration successful! The user will be sent an email to set up their account.
            </Description>
            <button
              className="mt-4 p-2 bg-blue-500 text-white rounded"
              onClick={() => setDialogOpen(false)}
            >
              Close
            </button>
          </div>
        </div>
      </Dialog>
    </div>
  );
};

export default AdminRegistration;
