"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { auth } from "@/app/services/firebase";
import {
  signInWithEmailAndPassword,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
} from "firebase/auth";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/app/services/firebase";

export default function AdminLoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [rememberMe, setRememberMe] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  const handleSignIn = async () => {
    setError(null);
    setLoading(true);

    try {
      // Set persistence based on "Remember Me"
      await setPersistence(
        auth,
        rememberMe ? browserLocalPersistence : browserSessionPersistence
      );

      // Sign in the user
      await signInWithEmailAndPassword(auth, email, password);

      const q = query(
        collection(db, "it_admin"),
        where("userID", "==", auth.currentUser?.uid)
      );
      const querySnapshot = await getDocs(q);
      if (querySnapshot.empty) {
        setError("User does not exist in the database.");
        return;
      }
      // Redirect to admin dashboard
      router.push("/admin/dashboard");
    } catch {
      setError("Invalid credentials. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-gray-50">
      {/* Logo */}
      <div className="mb-6">
        <Image
          src="/BissellLogo_Blue 1.svg"
          alt="Bissell Logo"
          width={200}
          height={80}
          className="mx-auto"
        />
      </div>

      {/* Sign In Card */}
      <div className="w-full max-w-sm bg-white rounded-lg shadow-lg p-6">
        <h1 className="text-2xl font-bold mb-4 text-center">Sign In</h1>

        {/* Error Message */}
        {error && (
          <div className="bg-red-100 text-red-700 p-2 mb-4 rounded">
            {error}
          </div>
        )}

        {/* Email Input */}
        <div className="mb-4">
          <label className="block text-gray-700 mb-1">Email Address</label>
          <input
            type="email"
            className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none"
            placeholder="Enter your admin email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        {/* Password Input */}
        <div className="mb-4">
          <label className="block text-gray-700 mb-1">Password</label>
          <input
            type="password"
            className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none"
            placeholder="Enter your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        {/* Remember Me + Forgot Password */}
        <div className="flex items-center justify-between mb-6">
          <label className="flex items-center text-sm text-gray-600">
            <input
              type="checkbox"
              className="mr-2"
              checked={rememberMe}
              onChange={() => setRememberMe(!rememberMe)}
            />
            Remember Me
          </label>
          <button
            type="button"
            className="text-sm text-blue-600 hover:underline"
            onClick={() => {
              setError("Please contact support for password reset.");
            }}
          >
            Forgot Password?
          </button>
        </div>

        {/* Sign In Button */}
        <button
          onClick={handleSignIn}
          disabled={loading}
          className="w-full bg-primary text-white py-2 rounded hover:bg-opacity-80 transition-all"
        >
          {loading ? "Signing in..." : "Sign In"}
        </button>
      </div>
    </div>
  );
}
