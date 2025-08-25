"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

export default function DashboardPage() {
  const [userName, setUserName] = useState("User");
  const router = useRouter();

  useEffect(() => {
    // Fetch user information from the session
    const fetchUserInfo = async () => {
      try {
        const response = await fetch("/api/user-session");
        if (response.ok) {
          const userData = await response.json();
          if (userData.email) {
            // Use email as fallback, or you can set a display name if available
            setUserName(userData.email.split("@")[0]); // Use part before @ as name
          }
        }
      } catch (error) {
        console.error("Failed to fetch user info:", error);
      }
    };

    fetchUserInfo();
  }, []);

  const handleLogout = async () => {
    try {
      const response = await fetch("/api/logout", {
        method: "POST",
      });

      if (response.ok) {
        router.push("/login");
      }
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center">
              <Image
                src="/BissellLogo_Blue 1.svg"
                alt="Bissell Logo"
                width={150}
                height={75}
                className="max-w-xs"
              />
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-gray-700">Welcome, {userName}</span>
              <button
                onClick={() => router.push("/profile")}
                className="text-gray-700 hover:text-gray-900 px-4 py-2 rounded-lg text-sm font-medium"
              >
                Profile
              </button>
              <button
                onClick={handleLogout}
                className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-medium"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="border-4 border-dashed border-gray-200 rounded-lg p-8">
            <div className="text-center">
              <h1 className="text-3xl font-bold text-gray-900 mb-4">
                Under Construction
              </h1>
              <p className="text-lg text-gray-600 mb-8">
                This page is currently under construction. Please check back
                later.
              </p>
              <div className="text-4xl mb-4">🚧</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
