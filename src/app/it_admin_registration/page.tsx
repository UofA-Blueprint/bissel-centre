import React from "react";
import Image from "next/image";

const ITAdminRegistration: React.FC = () => {
  return (
    <div className="flex flex-col items-center h-screen w-screen pt-10">
      <Image
        src="/BissellLogo_Blue 1.svg"
        alt="Bissell Logo"
        width={200}
        height={100}
      />
      <div className="border border-gray-200 rounded-2xl p-6 mt-4">
        <h1 className="text-lg pb-1">Register</h1>
        <p className="text-gray-500 text-sm">
          Already have an account?{" "}
          <a href="#" className="text-black font-bold">
            Sign in
          </a>
        </p>
        <form className="mt-4 text-sm">
          <div className="grid grid-cols-[300px_300px] gap-8">
            <div className="flex flex-col">
              <label htmlFor="first-name" className="font-bold">
                First Name
              </label>
              <input
                type="text"
                id="first-name"
                name="firstName"
                placeholder="Enter your first name"
                className="p-2 border border-gray-300 rounded-xl"
              />
              <label htmlFor="identification-number" className="font-bold">
                Identification Number
              </label>
              <input
                type="text"
                id="identification-number"
                name="identificationNumber"
                placeholder="Enter your identification number"
                className="p-2 border border-gray-300 rounded-xl"
              />
              <label htmlFor="password" className="font-bold">
                Create Password
              </label>
              <input
                type="password"
                id="password"
                name="password"
                placeholder="Create a password"
                className="p-2 border border-gray-300 rounded-xl"
              />
            </div>
            <div className="flex flex-col">
              <label htmlFor="last-name" className="font-bold">
                Last Name
              </label>
              <input
                type="text"
                id="last-name"
                name="lastName"
                placeholder="Enter your last name"
                className="p-2 border border-gray-300 rounded-xl"
              />
              <label htmlFor="email" className="font-bold">
                Email Address
              </label>
              <input
                type="email"
                id="email"
                name="email"
                placeholder="Enter your email address"
                className="p-2 border border-gray-300 rounded-xl"
              />
              <label htmlFor="confirmPassword" className="font-bold">
                Confirm Password
              </label>
              <input
                type="password"
                id="confirmPassword"
                name="confirmPassword"
                placeholder="Confirm your password"
                className="p-2 border border-gray-300 rounded-xl"
              />
            </div>
          </div>

          <button
            className="p-2 text-white rounded-xl w-full mt-4"
            style={{ backgroundColor: "#1BC0D6" }}
          >
            Register →
          </button>
        </form>
      </div>
    </div>
  );
};

export default ITAdminRegistration;
