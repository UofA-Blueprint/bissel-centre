"use client";
import React, { useState } from "react";
import Image from "next/image";

const ITAdminRegistration: React.FC = () => {
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    identificationNumber: "",
    password: "",
    confirmPassword: "",
  });

  const [errors, setErrors] = useState({
    firstName: "",
    lastName: "",
    email: "",
    identificationNumber: "",
    password: "",
    confirmPassword: "",
  });

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
          <div className="grid grid-cols-[300px_300px] gap-8">
            <div className="flex flex-col">
              <label htmlFor="first-name" className="font-bold pb-2">
                First Name <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                id="first-name"
                name="firstName"
                placeholder="Enter your first name"
                className="p-2 border border-gray-200 shadow-sm rounded-xl"
                value={formData.firstName}
                onChange={handleChange}
              />
              <div className="h-6">
                {errors.firstName && (
                  <span className="text-red-600 text-xs">
                    {errors.firstName}
                  </span>
                )}
              </div>
              <label htmlFor="identification-number" className="font-bold pb-2">
                Identification Number <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                id="identification-number"
                name="identificationNumber"
                placeholder="Enter your identification number"
                className="p-2 border border-gray-200 shadow-sm rounded-xl"
                value={formData.identificationNumber}
                onChange={handleChange}
              />
              <div className="h-6">
                {errors.identificationNumber && (
                  <span className="text-red-600 text-xs">
                    {errors.identificationNumber}
                  </span>
                )}
              </div>
              <label htmlFor="password" className="font-bold pb-2">
                Create Password <span className="text-red-600">*</span>
              </label>
              <input
                type="password"
                id="password"
                name="password"
                placeholder="Create a password"
                className="p-2 border border-gray-200 shadow-sm rounded-xl"
                value={formData.password}
                onChange={handleChange}
              />
              <div className="h-6">
                {errors.password && (
                  <span className="text-red-600 text-xs">
                    {errors.password}
                  </span>
                )}
              </div>
            </div>
            <div className="flex flex-col">
              <label htmlFor="last-name" className="font-bold pb-2">
                Last Name <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                id="last-name"
                name="lastName"
                placeholder="Enter your last name"
                className="p-2 border border-gray-200 shadow-sm rounded-xl"
                value={formData.lastName}
                onChange={handleChange}
              />
              <div className="h-6">
                {errors.lastName && (
                  <span className="text-red-600 text-xs">
                    {errors.lastName}
                  </span>
                )}
              </div>
              <label htmlFor="email" className="font-bold pb-2">
                Email Address <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                id="email"
                name="email"
                placeholder="Enter your email address"
                className="p-2 border border-gray-200 shadow-sm rounded-xl"
                value={formData.email}
                onChange={handleChange}
              />
              <div className="h-6">
                {errors.email && (
                  <span className="text-red-600 text-xs">{errors.email}</span>
                )}
              </div>
              <label htmlFor="confirmPassword" className="font-bold pb-2">
                Confirm Password <span className="text-red-600">*</span>
              </label>
              <input
                type="password"
                id="confirmPassword"
                name="confirmPassword"
                placeholder="Confirm your password"
                className="p-2 border border-gray-200 shadow-sm rounded-xl"
                value={formData.confirmPassword}
                onChange={handleChange}
              />
              <div className="h-6">
                {errors.confirmPassword && (
                  <span className="text-red-600 text-xs">
                    {errors.confirmPassword}
                  </span>
                )}
              </div>
            </div>
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
