"use client";

import { useEffect, useState } from "react";
import { Bell, ChevronDown, LogOut } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import { auth } from "@/app/services/firebase";

export interface NavUser {
  name?: string;
  email: string;
  photoURL?: string;
}

const NAV_ITEMS = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "Cards", href: "/cards" },
  { label: "Reports", href: "/reports" },
  { label: "Admin", href: "/it-admin" },
];

export default function TopNav({ user }: { user: NavUser }) {
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Element;
      if (showProfileDropdown && !target.closest(".profile-dropdown")) {
        setShowProfileDropdown(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
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

  const getUserInitials = (name: string) =>
    name
      .split(" ")
      .map((word) => word.charAt(0))
      .join("")
      .toUpperCase()
      .slice(0, 2);

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + "/");

  return (
    <div className="bg-white shadow-sm border-b">
      <div className="px-6 sm:px-10 lg:px-16">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center h-20">
          {/* Logo */}
          <div className="flex items-center justify-self-start">
            <Link href="/dashboard" className="ml-1">
              <Image
                src="/logo.png"
                alt="ARC Card"
                width={100}
                height={100}
                className="rounded-lg"
                priority
              />
            </Link>
          </div>

          {/* Centered Nav */}
          <div className="flex justify-center self-stretch">
            <nav className="flex h-full">
              {NAV_ITEMS.map(({ label, href }) => (
                <Link
                  key={href}
                  href={href}
                  className={`px-8 flex items-center text-lg border-t-4 border-t-transparent border-b-4 ${
                    isActive(href)
                      ? "border-primary text-gray-900 font-bold"
                      : "border-transparent text-gray-500 font-semibold hover:text-gray-700 hover:border-gray-300"
                  }`}
                >
                  {label}
                </Link>
              ))}
            </nav>
          </div>

          {/* Right Actions */}
          <div className="flex items-center space-x-4 justify-self-end">
            <button className="text-gray-500 hover:text-gray-700">
              <Bell size={20} />
            </button>

            <div className="relative">
              <button
                onClick={() => setShowProfileDropdown(!showProfileDropdown)}
                className="flex items-center space-x-2 hover:bg-gray-100 rounded-lg px-2 py-1 transition-colors"
              >
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

              {showProfileDropdown && (
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
  );
}
