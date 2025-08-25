"use client";

import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, Home, Search, AlertTriangle } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-cyan-50 flex flex-col items-center justify-center px-4 relative overflow-hidden">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute top-20 left-20 w-32 h-32 bg-primary rounded-full blur-3xl"></div>
        <div className="absolute bottom-20 right-20 w-40 h-40 bg-primary rounded-full blur-3xl"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-24 h-24 bg-primary rounded-full blur-2xl"></div>
      </div>

      <div className="relative z-10 max-w-lg w-full text-center">
        {/* Logo */}
        <div className="mb-8 flex justify-center">
          <Image
            src="/BissellLogo_Blue 1.svg"
            alt="Bissell Logo"
            width={150}
            height={75}
            className="max-w-xs"
            priority
          />
        </div>

        {/* 404 Icon */}
        <div className="mb-8">
          <div className="relative">
            <div className="text-8xl font-bold text-gray-100 mb-4 select-none">
              404
            </div>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-20 h-20 bg-gradient-to-br from-primary to-cyan-400 rounded-full flex items-center justify-center shadow-lg">
                <AlertTriangle className="w-10 h-10 text-white" />
              </div>
            </div>
          </div>
        </div>

        {/* Error Message */}
        <h1 className="text-3xl font-bold text-gray-900 mb-4">
          Oops! Page Not Found
        </h1>
        <p className="text-gray-600 mb-8 text-lg leading-relaxed">
          The page you&apos;re looking for seems to have wandered off.
          Don&apos;t worry, we&apos;ll help you find your way back.
        </p>

        {/* Action Buttons */}
        <div className="space-y-4 mb-8">
          <Link
            href="/"
            className="inline-flex items-center justify-center w-full px-8 py-4 bg-gradient-to-r from-primary to-cyan-500 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all duration-200"
          >
            <Home className="w-5 h-5 mr-3" />
            Return Home
          </Link>

          <button
            onClick={() => window.history.back()}
            className="inline-flex items-center justify-center w-full px-8 py-4 bg-white text-gray-700 font-semibold rounded-xl border-2 border-gray-200 hover:border-primary hover:text-primary transition-all duration-200 shadow-sm hover:shadow-md"
          >
            <ArrowLeft className="w-5 h-5 mr-3" />
            Go Back
          </button>
        </div>

        {/* Help Section */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 border border-gray-100 shadow-sm">
          <div className="flex items-center justify-center mb-3">
            <Search className="w-5 h-5 text-primary mr-2" />
            <h3 className="font-semibold text-gray-800">Need Help?</h3>
          </div>
          <p className="text-sm text-gray-600 mb-4">
            If you believe this is an error or need assistance, please contact
            our support team.
          </p>
          <div className="flex justify-center space-x-4">
            <Link
              href="/admin/login"
              className="text-primary hover:text-cyan-600 text-sm font-medium transition-colors"
            >
              Admin Login
            </Link>
            <span className="text-gray-300">|</span>
            <Link
              href="/login"
              className="text-primary hover:text-cyan-600 text-sm font-medium transition-colors"
            >
              User Login
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
