"use client";
import React, { useState } from "react";
import Image from "next/image";
import { Dialog, DialogTitle, Description } from "@headlessui/react";
import {
  userFormFields,
  validateRegistrationForm,
  RegistrationFormData,
} from "@/utils/registrationUtils";

const initialFormData: RegistrationFormData = {
  firstName: "",
  lastName: "",
  email: "",
  identificationNumber: "",
};

const initialErrors: Record<string, string> = {
  firstName: "",
  lastName: "",
  email: "",
  identificationNumber: "",
};

const AdminRegisterPage: React.FC = () => {
  const [formData, setFormData] =
    useState<RegistrationFormData>(initialFormData);
  const [errors, setErrors] = useState<Record<string, string>>(initialErrors);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [generatedUserId, setGeneratedUserId] = useState<string>("");
  const [copied, setCopied] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const validateForm = (): boolean => {
    const newErrors = validateRegistrationForm(formData);
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
      const res = await fetch("/admin/api/create-admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: formData.email,
          firstName: formData.firstName,
          lastName: formData.lastName,
          identificationNumber: formData.identificationNumber,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (
          data?.error ===
          "The email address is already in use by another account."
        ) {
          setErrors((prev) => ({
            ...prev,
            email: "Email already in use",
          }));
        } else {
          setErrors((prev) => ({
            ...prev,
            identificationNumber: data?.error ?? "Registration failed",
          }));
        }
        return;
      }

      // server returns { uid, rawId }
      setGeneratedUserId(data.rawId ?? "");
      setFormData(initialFormData);
      setDialogOpen(true);
    } catch (err) {
      console.error("Create admin failed:", err);
      setErrors((prev) => ({
        ...prev,
        identificationNumber: "Failed to register. Please try again.",
      }));
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = async () => {
    if (!generatedUserId) return;
    try {
      await navigator.clipboard.writeText(generatedUserId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Copy failed", err);
    }
  };

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
        <h1 className="text-lg pb-1">IT Admin Registration</h1>
        <form
          className={`mt-4 text-sm ${
            isLoading ? "opacity-50 pointer-events-none" : ""
          }`}
          onSubmit={handleSubmit}
        >
          <div className="grid grid-cols-[300px] lg:grid-cols-[300px_300px] gap-x-6">
            {userFormFields.map((field) => (
              <div key={field.id} className="flex flex-col">
                <label htmlFor={field.id} className="font-bold pb-2">
                  {field.label} <span className="text-red-600">*</span>
                </label>
                <input
                  type={field.type}
                  id={field.id}
                  name={field.name}
                  placeholder={
                    field.label === "Identification Number"
                      ? `Enter your ${field.label.toLowerCase()}`
                      : `Enter the user's ${field.label.toLowerCase()}`
                  }
                  className={`p-2 border shadow-sm rounded-xl ${
                    errors[field.name] ? "border-red-600" : "border-gray-200"
                  }`}
                  value={formData[field.name as keyof RegistrationFormData]}
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
              Admin registration successful!
            </Description>
            <div className="mt-3 text-sm text-yellow-800 bg-yellow-50 p-3 rounded">
              <strong>Important:</strong> This is the only time you will see the
              generated ID. If you navigate away from this page you will not be
              able to retrieve it again. Copy it now and send it securely to the
              new user.
            </div>

            {generatedUserId ? (
              <div className="mt-4">
                <div className="font-mono bg-gray-100 p-3 rounded break-all">
                  {generatedUserId}
                </div>
                <div className="flex gap-2 mt-3">
                  <button
                    className="px-3 py-1 bg-blue-500 text-white rounded"
                    onClick={copyToClipboard}
                  >
                    {copied ? "Copied!" : "Copy ID"}
                  </button>
                  <button
                    className="px-3 py-1 bg-gray-200 rounded"
                    onClick={() => setDialogOpen(false)}
                  >
                    Close
                  </button>
                </div>
              </div>
            ) : (
              <button
                className="mt-4 p-2 bg-blue-500 text-white rounded"
                onClick={() => setDialogOpen(false)}
              >
                Close
              </button>
            )}
          </div>
        </div>
      </Dialog>
    </div>
  );
};

export default AdminRegisterPage;
