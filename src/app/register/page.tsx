"use client";
import React, { useState } from "react";
import Image from "next/image";
import { auth } from "../services/firebase";
import { signInWithEmailAndPassword } from "firebase/auth";
import { Dialog, DialogTitle, Description } from "@headlessui/react";
import EyeClosedIcon from "../components/icons/EyeClosedIcon";
import EyeOpenIcon from "../components/icons/EyeOpenIcon";
import {
  userFormFields,
  passwordFields,
  validateRegistrationForm,
  AdminRegistrationFormData,
} from "@/utils/registrationUtils";

const initialFormData: AdminRegistrationFormData = {
  firstName: "",
  lastName: "",
  email: "",
  identificationNumber: "",
  password: "",
  confirmPassword: "",
};

const initialErrors: Record<string, string> = {
  firstName: "",
  lastName: "",
  email: "",
  identificationNumber: "",
  password: "",
  confirmPassword: "",
};

const AdminRegistration: React.FC = () => {
  const [formData, setFormData] =
    useState<AdminRegistrationFormData>(initialFormData);
  const [errors, setErrors] = useState<Record<string, string>>(initialErrors);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

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
      const response = await fetch("/api/register-staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: formData.firstName,
          lastName: formData.lastName,
          email: formData.email,
          password: formData.password,
          identificationNumber: formData.identificationNumber,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        const apiError = data.error || "An unknown error occurred.";
        if (response.status === 409) {
          setErrors((prev) => ({ ...prev, email: apiError }));
        } else if (response.status === 403) {
          setErrors((prev) => ({ ...prev, identificationNumber: apiError }));
        } else {
          setErrors((prev) => ({ ...prev, confirmPassword: apiError }));
        }
        return;
      }

      await signInWithEmailAndPassword(auth, formData.email, formData.password);

      setFormData(initialFormData);
      setDialogOpen(true);
    } catch (error) {
      console.error("Error during registration submission:", error);
      setErrors((prevErrors) => ({
        ...prevErrors,
        confirmPassword: "Failed to register. Please try again.",
      }));
    } finally {
      setIsLoading(false);
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
        <h1 className="text-lg pb-1">Register</h1>
        <p className="text-gray-500 text-sm">
          Already have an account?{" "}
          <a href="#" className="text-black font-bold">
            Sign in
          </a>
        </p>
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
                  placeholder={`Enter your ${field.label.toLowerCase()}`}
                  className={`p-2 border shadow-sm rounded-xl ${
                    errors[field.name] ? "border-red-600" : "border-gray-200"
                  }`}
                  value={
                    formData[field.name as keyof AdminRegistrationFormData]
                  }
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
            {passwordFields.map((field) => (
              <div key={field.id} className="flex flex-col">
                <label htmlFor={field.id} className="font-bold pb-2">
                  {field.label} <span className="text-red-600">*</span>
                </label>
                <div className="relative">
                  <input
                    type={
                      (field.name === "password" && showPassword) ||
                      (field.name === "confirmPassword" && showConfirmPassword)
                        ? "text"
                        : "password"
                    }
                    id={field.id}
                    name={field.name}
                    placeholder={field.label}
                    className={`p-2 border shadow-sm rounded-xl w-full ${
                      errors[field.name] ? "border-red-600" : "border-gray-200"
                    }`}
                    value={
                      formData[field.name as keyof AdminRegistrationFormData]
                    }
                    onChange={handleChange}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (field.name === "password") {
                        setShowPassword(!showPassword);
                      } else if (field.name === "confirmPassword") {
                        setShowConfirmPassword(!showConfirmPassword);
                      }
                    }}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-sm leading-5"
                    aria-label={
                      (field.name === "password" && showPassword) ||
                      (field.name === "confirmPassword" && showConfirmPassword)
                        ? "Hide password"
                        : "Show password"
                    }
                  >
                    {(field.name === "password" && showPassword) ||
                    (field.name === "confirmPassword" &&
                      showConfirmPassword) ? (
                      <EyeClosedIcon />
                    ) : (
                      <EyeOpenIcon />
                    )}
                  </button>
                </div>
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
              Registration successful!
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
