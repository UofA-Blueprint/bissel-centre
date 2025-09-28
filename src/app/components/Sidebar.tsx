"use client";

import React from "react";
import {
  Settings,
  Edit,
  UserCircle,
  Trash,
  ArrowRight,
  Flag,
  FlagOff,
} from "lucide-react";

interface SidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  showManagePopover: boolean;
  onToggleManagePopover: () => void;
  onEditProfile: () => void;
  onAccountStatus: () => void;
  onDeleteAccount: () => void;
  onToggleBan: () => void;
  isBanned: boolean;
  userStatus?: "Active" | "Inactive";
}

export default function Sidebar({
  activeTab,
  onTabChange,
  showManagePopover,
  onToggleManagePopover,
  onEditProfile,
  onAccountStatus,
  onDeleteAccount,
  onToggleBan,
  isBanned,
  userStatus = "Active",
}: SidebarProps) {
  const tabs = [
    { id: "overview", label: "Overview" },
    { id: "arcCard", label: "ARC Card" },
    { id: "history", label: "History" },
  ];

  return (
    <div className="w-64 bg-white rounded-lg shadow-sm p-6 min-h-[70vh] relative flex flex-col justify-between">
      <nav className="space-y-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`w-full text-left px-3 py-2 rounded ${
              activeTab === tab.id
                ? "bg-blue-100 text-gray-900"
                : "text-gray-700 hover:bg-gray-50"
            }`}
            onClick={() => onTabChange(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {/* Manage Account Button (positioned at bottom) */}
      <div className="relative mt-auto pt-4">
        <button
          className="w-full text-left px-3 py-2 bg-primary text-white hover:bg-primary/80 rounded flex items-center justify-between"
          onClick={onToggleManagePopover}
        >
          <div className="flex items-center">
            <Settings size={16} className="mr-2" />
            <span>Manage Account</span>
          </div>
        </button>

        {showManagePopover && (
          <div className="absolute right-0 bottom-full mb-2 bg-white rounded-lg shadow-lg w-60 z-10">
            <div className="px-4 py-3 border-b border-gray-100">
              <h3 className="text-sm font-medium text-gray-800">
                Account Actions
              </h3>
            </div>
            <ul className="divide-y divide-gray-100">
              <li>
                <button
                  className="w-full text-left px-4 py-3 flex items-center hover:bg-gray-50"
                  onClick={onEditProfile}
                >
                  <div className="w-8 h-8 bg-primary/20 rounded-full flex items-center justify-center mr-3">
                    <Edit size={14} className="text-primary" />
                  </div>
                  <span className="flex-1 text-sm text-gray-800">
                    Edit Profile
                  </span>
                  <ArrowRight size={14} className="text-gray-400" />
                </button>
              </li>{" "}
              <li>
                <button
                  className="w-full text-left px-4 py-3 flex items-center hover:bg-gray-50"
                  onClick={onAccountStatus}
                >
                  <div className="w-8 h-8 bg-primary/20 rounded-full flex items-center justify-center mr-3">
                    <UserCircle size={14} className="text-primary" />
                  </div>
                  <div className="flex-1">
                    <div className="text-sm text-gray-800">Account Status</div>
                    <div className="flex items-center mt-1">
                      <div
                        className={`w-2 h-2 rounded-full mr-2 ${
                          userStatus === "Active"
                            ? "bg-green-500"
                            : "bg-gray-400"
                        }`}
                      ></div>
                      <span
                        className={`text-xs ${
                          userStatus === "Active"
                            ? "text-green-600"
                            : "text-gray-500"
                        }`}
                      >
                        {userStatus}
                      </span>
                    </div>
                  </div>
                  <ArrowRight size={14} className="text-gray-400" />
                </button>
              </li>
              <li>
                <button
                  className="w-full text-left px-4 py-3 flex items-center hover:bg-gray-50"
                  onClick={onToggleBan}
                >
                  <div className="w-8 h-8 bg-primary/20 rounded-full flex items-center justify-center mr-3">
                    {isBanned ? (
                      <FlagOff size={14} className="text-primary" />
                    ) : (
                      <Flag size={14} className="text-primary" />
                    )}
                  </div>
                  <span className="flex-1 text-sm text-gray-800">
                    {isBanned ? "Remove Flag" : "Flag User"}
                  </span>
                  <ArrowRight size={14} className="text-gray-400" />
                </button>
              </li>
              <li>
                <button
                  className="w-full text-left px-4 py-3 flex items-center hover:bg-gray-50 text-red-600"
                  onClick={onDeleteAccount}
                >
                  <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center mr-3">
                    <Trash size={14} className="text-red-600" />
                  </div>
                  <span className="flex-1 text-sm">Delete Account</span>
                  <ArrowRight size={14} className="text-gray-400" />
                </button>
              </li>
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
