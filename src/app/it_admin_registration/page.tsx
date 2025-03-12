"use client";
import React, { useState } from "react";
import Image from "next/image";

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

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const validateForm = () => {
    console.log("Validating form");
    const newErrors = {
      firstName: formData.firstName ? "" : "First name is required",
      lastName: formData.lastName ? "" : "Last name is required",
      identificationNumber: formData.identificationNumber
        ? ""
        : "Identification number is required",
      email: formData.email ? "" : "Email is required",
      password: formData.password ? "" : "Password is required",
      confirmPassword: formData.confirmPassword
        ? ""
        : "Confirm password is required",
    };

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

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (validateForm()) {
      console.log("Form submitted", formData);
    }
  };

  const formFields: FormField[] = [
    { id: "first-name", name: "firstName", label: "First Name", type: "text" },
    { id: "last-name", name: "lastName", label: "Last Name", type: "text" },
    { id: "email", name: "email", label: "Email Address", type: "email" },
    {
      id: "identification-number",
      name: "identificationNumber",
      label: "Identification Number",
      type: "text",
    },
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
        className="border border-gray-200 rounded-2xl p-6 mt-12 shadow-md"
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
          <div className="grid grid-cols-[300px_300px] gap-x-6">
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
                    field.label !== "Confirm Password"
                      ? `Enter your ${field.label.toLowerCase()}`
                      : field.label
                  }
                  className="p-2 border border-gray-200 shadow-sm rounded-xl"
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
    </div>
  );
};

export default ITAdminRegistration;
