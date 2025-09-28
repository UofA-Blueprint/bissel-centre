"use client";

import React, { useState, useEffect } from "react";
import { Bell, ArrowLeft, User, LogOut, ChevronDown } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import { auth } from "../services/firebase";

interface User {
  name?: string;
  email: string;
  photoURL?: string;
}

interface HeaderProps {
  title: string;
  showBackButton?: boolean;
  onBackClick?: () => void;
  actions?: React.ReactNode;
}

export default function Header({
  title,
  showBackButton = false,
  onBackClick,
  actions,
}: HeaderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    async function fetchUser() {
      try {
        const response = await fetch("/api/user-session");
        if (response.ok) {
          const userData = await response.json();
          setUser(userData);
        } else {
          // Session is invalid, redirect to home
          router.replace("/");
        }
      } catch (error) {
        console.error("Failed to fetch user:", error);
        // On error, redirect to home
        router.replace("/");
      } finally {
        setLoading(false);
      }
    }

    fetchUser();
  }, [router]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Element;
      if (showProfileDropdown && !target.closest(".profile-dropdown")) {
        setShowProfileDropdown(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showProfileDropdown]);

  const handleLogout = async () => {
    try {
      await fetch("/api/logout", { method: "POST" });
      await signOut(auth);
      router.replace("/");
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  const getUserInitials = (name: string) => {
    return name
      .split(" ")
      .map((word) => word.charAt(0))
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <>
      {/* Top Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <div className="flex items-center">
              <span className="text-primary font-semibold text-lg ml-1">
                <Image
                  src="/logo.png"
                  alt="ARC Card"
                  width={100}
                  height={100}
                  className="rounded-lg"
                  priority
                />
              </span>
            </div>

            {/* Centered Nav */}
            <div className="flex-1 flex justify-center">
              <nav className="flex h-full">
                <a
                  href="/admin/dashboard"
                  className="px-5 flex items-center border-b-2 border-primary text-gray-900 font-medium"
                >
                  Dashboard
                </a>
                <a
                  href="#"
                  className="px-5 flex items-center border-b-2 border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                >
                  Cards
                </a>
                <a
                  href="#"
                  className="px-5 flex items-center border-b-2 border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                >
                  Reports
                </a>
              </nav>
            </div>

            {/* Right Actions */}
            <div className="flex items-center space-x-4">
              {/* Bell notification */}
              <button className="text-gray-500 hover:text-gray-700">
                <Bell size={20} />
              </button>

              {/* User Profile */}
              <div className="relative">
                {loading ? (
                  <div className="flex items-center space-x-2">
                    <div className="w-8 h-8 bg-gray-200 rounded-full animate-pulse"></div>
                    <span className="text-sm text-gray-400">Loading...</span>
                  </div>
                ) : user ? (
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() =>
                        setShowProfileDropdown(!showProfileDropdown)
                      }
                      className="flex items-center space-x-2 hover:bg-gray-100 rounded-lg px-2 py-1 transition-colors"
                    >
                      {/* Profile Picture or Initials */}
                      {user.photoURL ? (
                        <Image
                          src={user.photoURL}
                          alt="Profile"
                          width={32}
                          height={32}
                          className="w-8 h-8 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-8 h-8 bg-gradient-to-br from-primary to-cyan-500 rounded-full flex items-center justify-center">
                          <span className="text-white text-xs font-medium">
                            {getUserInitials(user.name || user.email || "U")}
                          </span>
                        </div>
                      )}

                      <span className="text-sm text-gray-800 font-medium">
                        {user.name || user.email || "User"}
                      </span>

                      <ChevronDown
                        size={16}
                        className={`text-gray-500 transition-transform ${
                          showProfileDropdown ? "rotate-180" : ""
                        }`}
                      />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center space-x-2">
                    <div className="w-8 h-8 bg-gray-200 rounded-full animate-pulse"></div>
                    <span className="text-sm text-gray-400">
                      Loading user...
                    </span>
                  </div>
                )}

                {/* Profile Dropdown */}
                {showProfileDropdown && user && (
                  <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50 profile-dropdown">
                    <div className="px-4 py-2 border-b border-gray-100">
                      <p className="text-sm font-medium text-gray-900">
                        {user.name || user.email}
                      </p>
                      <p className="text-xs text-gray-500">{user.email}</p>
                    </div>

                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                    >
                      <LogOut size={16} className="mr-2" />
                      Logout
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Subheader */}
      <div className="bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between">
          <div className="flex items-center">
            {showBackButton && (
              <button
                onClick={onBackClick}
                className="inline-flex items-center justify-center w-8 h-8 bg-primary/20 text-primary rounded-full mr-3 hover:bg-primary/30"
              >
                <ArrowLeft size={18} />
              </button>
            )}
            <span className="text-gray-900 font-medium text-xl">{title}</span>
          </div>

          {actions && (
            <div className="flex items-center space-x-3">{actions}</div>
          )}
        </div>
      </div>
    </>
  );
}
