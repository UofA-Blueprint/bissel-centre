"use client";
import Image from "next/image";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const router = useRouter();

  return (
    <div className="flex flex-col items-center h-screen w-screen justify-between pt-10 pb-10">
      <Image
        src="/BissellLogo_Blue 1.svg"
        alt="Bissell Logo"
        width={200}
        height={100}
      />
      <div className="flex flex-col items-center w-2/6">
        <div className="self-start">
          {isAdmin ? (
            <h1 className="text-4xl font-bold tracking-tight mb-4">
              Welcome Admin!
            </h1>
          ) : (
            <h1 className="text-4xl font-bold tracking-tight mb-4">Welcome!</h1>
          )}
          <p className="text-lg">**Opening Statement**</p>
        </div>
        <div className="flex justify-between w-full mt-8">
          <button
            className="bg-primary text-white px-32 py-2 rounded-lg shadow-md hover:bg-opacity-50 transition-all duration-200 mr-4"
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
            className="bg-primary text-white px-36 py-2 rounded-lg shadow-md hover:bg-opacity-50 transition-all duration-200 mr-4"
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
      <div className="">
        <Image
          src="/homeimg.svg"
          alt="home page image"
          width={350}
          height={282}
        />
      </div>
      <button
        onClick={() => {
          setIsAdmin(!isAdmin);
        }}
        className={isAdmin ? "text-black" : "text-primary"}
      >
        Admin
      </button>
    </div>
  );
}
