"use client";
import React, { useState } from "react";
import Image from "next/image";
import { auth, db } from "../services/firebase";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from "firebase/auth";
import { addDoc, collection, Timestamp } from "firebase/firestore";
import { Dialog, DialogTitle, Description } from "@headlessui/react";
import { FirebaseError } from "firebase/app";
import EyeClosedIcon from "../components/icons/EyeClosedIcon";
import EyeOpenIcon from "../components/icons/EyeOpenIcon";

type FormDataKeys = keyof typeof initialFormData;

type FormField = {
  id: string;
  name: FormDataKeys;
  label: string;
  type: string;
};

const initialFormData = {
  firstName: "",
  lastName: "",
  email: "",
  identificationNumber: "",
  password: "",
  confirmPassword: "",
};

const initialErrors = {
  firstName: "",
  lastName: "",
  email: "",
  identificationNumber: "",
  password: "",
  confirmPassword: "",
};

// --- CONSTANTS ---
const ADMIN_STAFF_COLLECTION = "administrative_staff";

const AdminRegistration: React.FC = () => {
  const [formData, setFormData] =
    useState<typeof initialFormData>(initialFormData);
  const [errors, setErrors] = useState<typeof initialErrors>(initialErrors);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  function checkPasswordStrength(input: string): string {
    const password = input.trim();

    if (
      password.length < 8 ||
      !/[A-Z]/.test(password) ||
      !/[a-z]/.test(password) ||
      !/[0-9]/.test(password)
    ) {
      return "Password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, and one number";
    }

    return "";
  }

  const validateForm = (): boolean => {
    const newErrors = {
      firstName: formData.firstName.trim() ? "" : "First name is required",
      lastName: formData.lastName.trim() ? "" : "Last name is required",
      identificationNumber: formData.identificationNumber.trim()
        ? ""
        : "Identification number is required",
      email: formData.email.trim() ? "" : "Email is required",
      confirmPassword: formData.confirmPassword.trim()
        ? ""
        : "Confirm password is required",
      password: checkPasswordStrength(formData.password),
    };

    if (formData.firstName && !/^[A-Za-z]+$/.test(formData.firstName)) {
      newErrors.firstName = "First name must contain only letters";
    }

    if (formData.lastName && !/^[A-Za-z]+$/.test(formData.lastName)) {
      newErrors.lastName = "Last name must contain only letters";
    }

    if (
      formData.password &&
      formData.confirmPassword &&
      formData.password !== formData.confirmPassword
    ) {
      newErrors.confirmPassword = "Passwords do not match";
    }

    setErrors(newErrors);

    return Object.values(newErrors).every((error) => error === "");
  };

  const checkExistingUserIdentificationNumber = async (): Promise<
    string | null
  > => {
    try {
      const response = await fetch("/api/verify-admin", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          identificationNumber: formData.identificationNumber,
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        console.log("Checking hashed ID:", data.hashedID);
        return data.hashedID;
      } else {
        setErrors({
          firstName: "",
          lastName: "",
          email: "",
          password: "",
          confirmPassword: "",
          identificationNumber: data.error || "Identification number not found",
        });
        return null;
      }
    } catch (error) {
      console.error("Error checking identification number:", error);
      setErrors((prevErrors) => ({
        ...prevErrors,
        identificationNumber:
          "Failed to verify identification number. Please try again.",
      }));
      return null;
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    let userCredential;
    setIsLoading(true);

    if (!validateForm()) {
      setIsLoading(false);
      return;
    }

    const ITUserUID = await checkExistingUserIdentificationNumber();
    if (ITUserUID === null) {
      // If the identification number check fails, stop the registration process
      setIsLoading(false);
      return;
    }

    try {
      // create user
      userCredential = await createUserWithEmailAndPassword(
        auth,
        formData.email,
        formData.password
      );

      try {
        // try to create the Firestore document
        await addDoc(collection(db, ADMIN_STAFF_COLLECTION), {
          firstName: formData.firstName,
          secondName: formData.lastName,
          email: formData.email,
          createdBy: ITUserUID,
          createdAt: Timestamp.now(),
        });

        // clear form and show success message
        setFormData(initialFormData);

        try {
          await signInWithEmailAndPassword(
            auth,
            formData.email,
            formData.password
          );
        } catch (error) {
          console.error("Error signing in:", error);
        }

        setDialogOpen(true);
      } catch (firestoreError) {
        // If Firestore fails, delete the auth user
        console.error("Error creating user profile:", firestoreError);
        if (userCredential?.user) {
          try {
            await userCredential.user.delete();
          } catch (deleteError) {
            console.error("Error deleting user:", deleteError);
          }
        }
      }
    } catch (error) {
      console.error("Error creating user:", error);
      const errorCode = error instanceof FirebaseError && error.code;
      if (errorCode === "auth/email-already-in-use") {
        setErrors({
          firstName: "",
          lastName: "",
          email: "Email is already in use",
          password: "",
          confirmPassword: "",
          identificationNumber: "",
        });
      } else if (errorCode === "auth/invalid-email") {
        setErrors({
          firstName: "",
          lastName: "",
          email: "Invalid email address",
          password: "",
          confirmPassword: "",
          identificationNumber: "",
        });
      } else {
        console.error("Error creating user:", error);
      }
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
    },
    { id: "email", name: "email", label: "Email Address", type: "text" },
  ];

  const passwordFields: FormField[] = [
    {
      id: "password",
      name: "password",
      label: "Create Password",
      type: "password",
    },
    {
      id: "confirmPassword",
      name: "confirmPassword",
      label: "Confirm Password",
      type: "password",
    },
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
            {formFields.map((field) => (
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
                    value={formData[field.name]}
                    onChange={handleChange}
                  ></input>
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
