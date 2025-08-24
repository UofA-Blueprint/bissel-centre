"use client";

import React from "react";
import { Bell, ArrowLeft } from "lucide-react";
import Image from "next/image";

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
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-gray-800 rounded-full flex items-center justify-center">
                  <span className="text-white text-xs">D</span>
                </div>
                <span className="text-sm text-gray-800">Admin User</span>
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
