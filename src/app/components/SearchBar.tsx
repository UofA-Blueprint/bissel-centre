"use client";

import Image from "next/image";
import React from "react";

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** Action buttons rendered in the row beneath the input. */
  children?: React.ReactNode;
  /** Extra classes on the outer container (layout / positioning). */
  className?: string;
}

// Shared search box used by the staff and admin dashboards.
export default function SearchBar({
  value,
  onChange,
  placeholder = "Search...",
  children,
  className = "",
}: SearchBarProps) {
  return (
    <div
      className={`bg-[#A8A29E] rounded-2xl shadow-md w-full px-3 pt-3 pb-2 sm:px-4 sm:pt-4 sm:pb-3 ${className}`}
    >
      {/* Search input row */}
      <div
        className={`flex items-center bg-white rounded-xl px-4 py-2 sm:px-5 sm:py-3 ${
          children ? "mb-3 sm:mb-4" : ""
        }`}
      >
        <input
          type="text"
          placeholder={placeholder}
          className="flex-1 outline-none text-gray-700 text-base sm:text-lg bg-white"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        <button className="ml-2 shrink-0 p-2 sm:p-2.5 bg-cyan-500 hover:bg-cyan-600 rounded-full">
          <Image src="/search-enter.svg" alt="Search" width={20} height={20} />
        </button>
      </div>

      {/* Action buttons row */}
      {children && (
        <div className="flex justify-between items-center text-white text-xs sm:text-sm px-1">
          {children}
        </div>
      )}
    </div>
  );
}
