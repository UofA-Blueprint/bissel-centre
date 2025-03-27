"use client";
import React, { useState } from "react";
import Image from "next/image";
import { auth, db } from "../services/firebase";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { addDoc, collection } from "firebase/firestore";
import { Dialog, DialogTitle, Description } from "@headlessui/react";

type FormField = {
  id: string;
  name: keyof typeof initialFormData;
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

const ITAdminRegistration: React.FC = () => {
  const [formData, setFormData] =
    useState<typeof initialFormData>(initialFormData);
  const [errors, setErrors] = useState<typeof initialErrors>(initialErrors);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMessage, setDialogMessage] = useState("");
  const [dialogType, setDialogType] = useState<"success" | "error">("success");

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  function checkPasswordStrength(input: string) {
    const password = input.trim();

    if (password.length < 8) {
      return "Password must be at least 8 characters";
    }

    if (!/[A-Z]/.test(password)) {
      return "Password must contain at least one uppercase letter";
    }

    if (!/[a-z]/.test(password)) {
      return "Password must contain at least one lowercase letter";
    }

    if (!/[0-9]/.test(password)) {
      return "Password must contain at least one number";
    }

    return "";
  }

  const validateForm = () => {
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

    if (formData.email && !formData.email.includes("@")) {
      newErrors.email = "Invalid email address";
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

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    let userCredential;

    if (validateForm()) {
      try {
        // create user
        userCredential = await createUserWithEmailAndPassword(
          auth,
          formData.email,
          formData.password
        );

        try {
          // try to create the Firestore document
          await addDoc(collection(db, "it_admins"), {
            uid: userCredential.user.uid,
            firstName: formData.firstName,
            lastName: formData.lastName,
            email: formData.email,
            identificationNumber: formData.identificationNumber,
            createdAt: new Date().toISOString(),
          });

          // clear form and show success message
          setFormData(initialFormData);
          setDialogType("success");
          setDialogMessage("Registration successful!");
          setDialogOpen(true);
        } catch (firestoreError) {
          // If Firestore fails, delete the auth user
          console.log("Error creating user profile:", firestoreError);
          if (userCredential?.user) {
            await userCredential.user.delete();
          }
          throw new Error("Failed to create user profile. Please try again.");
        }
      } catch (error) {
        console.error("Error in registration:", error);
        setDialogType("error");
        setDialogMessage(
          error instanceof Error ? error.message : "Registration failed"
        );
        setDialogOpen(true);
      }
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
    <div
      className="flex flex-col items-center h-screen w-screen pt-10"
      style={{ backgroundColor: "#F7F7F4" }}
    >
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
        <form className="mt-4 text-sm" onSubmit={handleSubmit}>
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
                  placeholder={
                    !field.label.includes("Password")
                      ? `Enter your ${field.label.toLowerCase()}`
                      : field.label
                  }
                  className={`p-2 border shadow-sm rounded-xl ${
                    errors[field.name] ? "border-red-600" : "border-gray-200"
                  }`}
                  value={formData[field.name]}
                  onChange={handleChange}
                />
                <div className="h-5">
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
            <DialogTitle className="text-lg font-bold">
              {dialogType === "error" ? "Error" : "Info"}
            </DialogTitle>
            <Description className="mt-2 text-sm text-gray-500">
              {dialogMessage}
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

export default ITAdminRegistration;
