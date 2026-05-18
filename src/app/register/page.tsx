"use client";
import React, { useState } from "react";
import Image from "next/image";
import Link from "next/link";
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
  const [registeredEmail, setRegisteredEmail] = useState("");
  const [registrationWarning, setRegistrationWarning] = useState("");
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

      setRegisteredEmail(formData.email);
      setRegistrationWarning(data.warning ?? "");
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
        className="fixed z-20 inset-0 overflow-y-auto"
      >
        <div className="flex items-center justify-center min-h-screen px-4 py-8">
          <div className="fixed inset-0 bg-slate-900/55" aria-hidden="true" />
          <div className="relative z-10 mx-auto w-full max-w-md overflow-hidden rounded-2xl border border-cyan-100 bg-white shadow-2xl">
            <div className="bg-gradient-to-r from-cyan-500 to-blue-500 px-6 py-5 text-white">
              <DialogTitle className="text-xl font-semibold">
                Registration Complete
              </DialogTitle>
              <Description className="mt-1 text-sm text-cyan-50">
                The staff account has been created successfully.
              </Description>
            </div>

            <div className="px-6 py-5 space-y-4">
              <div className="rounded-xl border border-cyan-100 bg-cyan-50 px-4 py-3 text-sm text-cyan-900">
                A password reset email should now be in{" "}
                <span className="font-semibold">{registeredEmail}</span>. Ask
                the registered user to open the email and set a new password to
                complete onboarding.
              </div>

              {registrationWarning && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                  {registrationWarning}
                </div>
              )}

              <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                <button
                  className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                  onClick={() => setDialogOpen(false)}
                >
                  Register Another User
                </button>
                <Link
                  href="/"
                  className="rounded-xl bg-slate-900 px-4 py-2 text-center text-sm font-medium text-white transition hover:bg-slate-700"
                >
                  Go to Home
                </Link>
              </div>
            </div>
          </div>
        </div>
      </Dialog>
    </div>
  );
};

export default AdminRegistration;
