"use client";
import Image from "next/image";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const router = useRouter();

  return (
    <div className="flex flex-col items-center justify-between min-h-screen p-4 md:p-8 lg:p-12">
      <div className="w-full flex justify-center">
        <Image
          src="/BissellLogo_Blue 1.svg"
          alt="Bissell Logo"
          width={200}
          height={100}
          className="max-w-xs"
        />
      </div>

      <div className="w-full max-w-md px-4 text-center">
        <div className="w-full">
          {isAdmin ? (
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-4 text-center">
              Welcome Admin!
            </h1>
          ) : (
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-4 text-center">
              Welcome!
            </h1>
          )}
          <p className="text-base md:text-lg text-center mb-8">
            **Opening Statement**
          </p>
        </div>

        <div className="flex flex-col sm:flex-row justify-center space-y-4 sm:space-y-0 sm:space-x-4 w-full">
          <button
            className="bg-primary text-white px-8 sm:px-12 md:px-16 py-2 rounded-lg shadow-md hover:bg-opacity-50 transition-all duration-200 w-full sm:w-auto"
            onClick={() => {
              if (isAdmin) {
                router.push("/admin/register");
              } else {
                router.push("/register");
              }
            }}
          >
            Register
          </button>
          <button
            className="bg-primary text-white px-8 sm:px-12 md:px-16 py-2 rounded-lg shadow-md hover:bg-opacity-50 transition-all duration-200 w-full sm:w-auto"
            onClick={() => {
              if (isAdmin) {
                router.push("/admin/login");
              } else {
                router.push("/login");
              }
            }}
          >
            Login
          </button>
        </div>
      </div>

      <div className="w-full max-w-xs flex justify-center">
        <Image
          src="/homeimg.svg"
          alt="home page image"
          width={350}
          height={282}
          className="max-w-full h-auto"
        />
      </div>

      <button
        onClick={() => {
          setIsAdmin(!isAdmin);
        }}
        className={`${
          isAdmin ? "text-black" : "text-primary"
        } text-sm underline`}
      >
        {isAdmin ? "Switch to User" : "Switch to Admin"}
      </button>
    </div>
  );
}
