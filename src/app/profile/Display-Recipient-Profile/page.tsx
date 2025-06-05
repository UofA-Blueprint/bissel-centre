"use client";

import React, { useState, useEffect } from "react";
import {
  Bell,
  Settings,
  Edit,
  ArrowLeft,
  UserCircle,
  Trash,
  Plus,
  ArrowRight,
} from "lucide-react";

interface User {
  id: string;
  firstName: string;
  secondName: string;
  picture?: string;
  genderIdentity: string;
  aliases: string[];
  dateOfBirth: string;
  arcCardNumber?: string;
  address: string;
  postalCode: string;
  passesIssued: string[];
  banned: boolean;
  banReason?: string;
  notes?: string;
  createdAt: Date | string;
  createdBy: string;
  updatedAt?: Date | string;
  email?: string;
  phoneNumber?: string;
}

export default function DisplayRecipientProfile() {
  const [user, setUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<
    "overview" | "arcCard" | "history"
  >("overview");
  const [loading, setLoading] = useState(true);
  const [showManagePopover, setShowManagePopover] = useState(false);

  useEffect(() => {
    // Mock user data to match the image
    setUser({
      id: "demo-user-id",
      firstName: "Placeholder",
      secondName: "Placeholder",
      genderIdentity: "Placeholder",
      aliases: ["Placeholder"],
      dateOfBirth: "Placeholder",
      address: "Placeholder",
      postalCode: "Placeholder",
      passesIssued: [],
      banned: false, // Changed to false to match image
      banReason: "Demo ban reason",
      notes: "Demo user for testing purposes",
      createdAt: new Date(),
      createdBy: "admin",
      email: "Placeholder",
      phoneNumber: "Placeholder",
    });

    setLoading(false);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-lg text-gray-700">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-lg text-gray-700">User not found</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <div className="flex items-center">
              <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
                <span className="text-white font-bold text-sm">B</span>
              </div>
              <span className="text-primary font-semibold text-lg ml-1">
                Bissell
              </span>
            </div>

            {/* Centered Nav */}
            <div className="flex-1 flex justify-center">
              <nav className="flex h-full">
                <a
                  href="#"
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
                <span className="text-sm text-gray-800">Destyni DeLuca</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* "Profile" Subheader */}
      <div className="bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between">
          <div className="flex items-center">
            <span className="inline-flex items-center justify-center w-8 h-8 bg-primary/20 text-primary rounded-full mr-3">
              <ArrowLeft size={18} />
            </span>
            <span className="text-gray-900 font-medium text-xl">Profile</span>
          </div>

          {/* Action buttons moved here from navbar */}
          <div className="flex items-center space-x-3">
            <button className="bg-primary hover:bg-primary/80 text-white px-4 py-2 rounded-md text-sm flex items-center">
              <Plus size={16} className="mr-1" /> Renew Card
            </button>
            <button className="bg-primary hover:bg-primary/80 text-white px-4 py-2 rounded-md text-sm flex items-center">
              Issue Card <ArrowRight size={16} className="ml-1" />
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex">
          {/* Sidebar */}
          <div className="w-64 bg-white rounded-lg shadow-sm p-6 min-h-[70vh] relative flex flex-col justify-between">
            <nav className="space-y-2">
              <button
                className={`w-full text-left px-3 py-2 rounded ${
                  activeTab === "overview"
                    ? "bg-blue-100 text-gray-900"
                    : "text-gray-700 hover:bg-gray-50"
                }`}
                onClick={() => setActiveTab("overview")}
              >
                Overview
              </button>
              <button
                className={`w-full text-left px-3 py-2 rounded ${
                  activeTab === "arcCard"
                    ? "bg-blue-100 text-gray-900"
                    : "text-gray-700 hover:bg-gray-50"
                }`}
                onClick={() => setActiveTab("arcCard")}
              >
                ARC Card
              </button>
              <button
                className={`w-full text-left px-3 py-2 rounded ${
                  activeTab === "history"
                    ? "bg-blue-100 text-gray-900"
                    : "text-gray-700 hover:bg-gray-50"
                }`}
                onClick={() => setActiveTab("history")}
              >
                History
              </button>
            </nav>

            {/* Manage Account Button (positioned at bottom) */}
            <div className="relative mt-auto pt-4">
              <button
                className="w-full text-left px-3 py-2 bg-primary text-white hover:bg-primary/80 rounded flex items-center justify-between"
                onClick={() => setShowManagePopover(!showManagePopover)}
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
                      <button className="w-full text-left px-4 py-3 flex items-center hover:bg-gray-50">
                        <div className="w-8 h-8 bg-primary/20 rounded-full flex items-center justify-center mr-3">
                          <Edit size={14} className="text-primary" />
                        </div>
                        <span className="flex-1 text-sm text-gray-800">
                          Edit Profile
                        </span>
                        <ArrowRight size={14} className="text-gray-400" />
                      </button>
                    </li>
                    <li>
                      <button className="w-full text-left px-4 py-3 flex items-center hover:bg-gray-50">
                        <div className="w-8 h-8 bg-primary/20 rounded-full flex items-center justify-center mr-3">
                          <UserCircle size={14} className="text-primary" />
                        </div>
                        <span className="flex-1 text-sm text-gray-800">
                          Account Status
                        </span>
                        <ArrowRight size={14} className="text-gray-400" />
                      </button>
                    </li>
                    <li>
                      <button className="w-full text-left px-4 py-3 flex items-center hover:bg-gray-50">
                        <div className="w-8 h-8 bg-primary/20 rounded-full flex items-center justify-center mr-3">
                          <Trash size={14} className="text-primary" />
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

          {/* Main Content */}
          <div className="flex-1 ml-4">
            <div className="bg-white rounded-lg shadow-sm overflow-hidden">
              {/* Profile Header - centered with no bottom border */}
              <div className="p-6 flex flex-col items-center">
                {/* Avatar */}
                <div className="relative mb-4">
                  <div className="w-24 h-24 bg-purple-200 rounded-full overflow-hidden flex items-center justify-center">
                    <UserCircle size={56} className="text-purple-300" />
                  </div>
                  <button
                    className="absolute top-1 right-1 bg-white p-1 rounded-full border border-gray-200 hover:bg-gray-50"
                    onClick={() => {
                      /* Handle avatar edit */
                    }}
                  >
                    <Edit size={14} className="text-primary" />
                  </button>
                </div>
                <div className="text-center">
                  <div className="flex items-center justify-center space-x-2">
                    <h1 className="text-2xl font-semibold text-gray-900">
                      Full Name (Alias)
                    </h1>
                    {user.banned && (
                      <span className="text-red-500 text-xl">🚩</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Tab Content */}
              {activeTab === "overview" && (
                <div className="p-6">
                  {/* Personal Details Card with grey background */}
                  <div className="bg-gray-50 rounded-lg p-6 shadow-sm">
                    <div className="flex items-center mb-6">
                      <h3 className="text-lg font-semibold text-gray-800">
                        Personal Details
                      </h3>
                      <div className="flex-grow border-t border-gray-200 ml-4" />
                    </div>

                    <div className="grid grid-cols-3 gap-x-8 gap-y-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-900 mb-1">
                          First Name
                        </label>
                        <div className="text-gray-500">Placeholder</div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-900 mb-1">
                          Last Name
                        </label>
                        <div className="text-gray-500">Placeholder</div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-900 mb-1">
                          Alias
                        </label>
                        <div className="text-gray-500">Placeholder</div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-900 mb-1">
                          Gender Identity
                        </label>
                        <div className="text-gray-500">Placeholder</div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-900 mb-1">
                          Date of Birth
                        </label>
                        <div className="text-gray-500">Placeholder</div>
                      </div>
                      <div></div>

                      <div>
                        <label className="block text-sm font-medium text-gray-900 mb-1">
                          Email
                        </label>
                        <div className="text-gray-500">Placeholder</div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-900 mb-1">
                          Phone Number
                        </label>
                        <div className="text-gray-500">Placeholder</div>
                      </div>
                      <div></div>

                      <div>
                        <label className="block text-sm font-medium text-gray-900 mb-1">
                          Address
                        </label>
                        <div className="text-gray-500">Placeholder</div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-900 mb-1">
                          Postal Code: In what area did the recipient stay last
                          night? <span className="text-red-500">*</span>
                        </label>
                        <div className="text-gray-500">Placeholder</div>
                      </div>
                    </div>
                  </div>

                  {/* Additional Information with grey background */}
                  <div className="mt-8 bg-gray-50 rounded-lg p-6 shadow-sm">
                    <h3 className="text-lg font-semibold text-gray-800 mb-4">
                      Additional Information
                    </h3>
                    <p className="text-gray-500">
                      No additional information available.
                    </p>
                  </div>
                </div>
              )}

              {activeTab === "arcCard" && (
                <div className="p-6 text-gray-500">
                  {/* ARC Card content goes here */}
                  ARC Card content placeholder.
                </div>
              )}

              {activeTab === "history" && (
                <div className="p-6 text-gray-500">
                  {/* History content goes here */}
                  History content placeholder.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
