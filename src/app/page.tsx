"use client";
import Image from "next/image";
import { useState } from "react";
import Link from "next/link";

export default function Home() {
  const [isAdmin, setIsAdmin] = useState<boolean>(false);

  const registerHref = isAdmin ? "/admin/register" : "/register";
  const loginHref = isAdmin ? "/admin/login" : "/login";

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-20 p-4 md:p-8 lg:p-12">
      <div className="flex w-full flex-col items-center justify-center">
        <Image
          src="/BissellLogo_Blue 1.svg"
          alt="Bissell Logo"
          width={200}
          height={100}
          className="max-w-xs"
        />
        <p className="mt-2 text-center text-base md:text-sm">
          Building A Community Without Poverty
        </p>
      </div>

      <div className="w-full max-w-md px-4 text-center">
        <div className="w-full">
          {isAdmin ? (
            <h1 className="mb-4 text-center text-3xl font-bold tracking-tight md:text-4xl">
              Welcome Admin!
            </h1>
          ) : (
            <h1 className="mb-4 text-center text-3xl font-bold tracking-tight md:text-4xl">
              Welcome Staff!
            </h1>
          )}
        </div>

        <div className="flex w-full flex-col justify-center space-y-4 sm:flex-row sm:space-x-4 sm:space-y-0">
          <Link
            href={registerHref}
            className="inline-flex w-full items-center justify-center rounded-lg bg-primary px-8 py-2 text-white shadow-md transition-all duration-200 hover:bg-opacity-50 sm:w-auto sm:px-12 md:px-16"
          >
            Register
          </Link>
          <Link
            href={loginHref}
            className="inline-flex w-full items-center justify-center rounded-lg bg-primary px-8 py-2 text-white shadow-md transition-all duration-200 hover:bg-opacity-50 sm:w-auto sm:px-12 md:px-16"
          >
            Login
          </Link>
        </div>
      </div>

      <div className="flex w-full max-w-xs justify-center">
        <Image
          src="/homeimg.svg"
          alt="home page image"
          width={350}
          height={282}
          className="h-auto max-w-full"
        />
      </div>

      <button
        onClick={() => {
          setIsAdmin(!isAdmin);
        }}
        className={`${isAdmin ? "text-black" : "text-primary"} text-sm underline`}
      >
        {isAdmin ? "Switch to User" : "Switch to Admin"}
      </button>
    </div>
  );
}
