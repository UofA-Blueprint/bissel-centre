"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { auth } from "../services/firebase";
import { signInWithEmailAndPassword } from "firebase/auth";
import Image from "next/image";

export default function StaffLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMeState] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  useEffect(() => {
    // Check if email is remembered in localStorage
    const rememberedEmail = localStorage.getItem("rememberedEmail");
    if (rememberedEmail) {
      setEmail(rememberedEmail);
      setRememberMeState(true);
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      // Authenticate with Firebase Auth
      const userCredential = await signInWithEmailAndPassword(
        auth,
        email,
        password
      );

      // Additional check: verify staff exists in Firestore
      const authResponse = await fetch("/api/authorise-staff", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ uid: userCredential.user.uid }),
      });

      if (!authResponse.ok) {
        const authError = await authResponse.json();
        throw new Error(authError.error || "Staff authorization failed");
      }

      // Get the ID token
      const idToken = await userCredential.user.getIdToken();

      // Create session cookie via API
      const response = await fetch("/api/session-login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ idToken }),
      });

      if (!response.ok) {
        throw new Error("Failed to create session");
      }

      // Handle remember me functionality
      if (rememberMe) {
        localStorage.setItem("rememberedEmail", email);
      } else {
        localStorage.removeItem("rememberedEmail");
      }

      // Redirect to home dashboard after successful login
      router.push("/dashboard");
    } catch (err: unknown) {
      console.error("Login error:", err);

      // Provide user-friendly error messages
      if (err instanceof Error) {
        if (
          err.message.includes("auth/user-not-found") ||
          err.message.includes("auth/wrong-password") ||
          err.message.includes("auth/invalid-credential")
        ) {
          setError("Invalid email or password. Please try again.");
        } else if (err.message.includes("auth/too-many-requests")) {
          setError("Too many failed attempts. Please try again later.");
        } else if (err.message.includes("Failed to create session")) {
          setError("Login failed. Please try again.");
        } else if (
          err.message.includes("Staff member not found in administrative staff")
        ) {
          setError(
            "Access denied. This login is for administrative staff only."
          );
        } else if (err.message.includes("Staff authorization failed")) {
          setError(
            "Access denied. Please contact IT Admin if you need assistance."
          );
        } else {
          setError("Invalid email or password. Please try again.");
        }
      } else {
        setError("Invalid email or password. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = () => {
    alert(
      "Please contact your IT Administrator for password reset assistance."
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col py-12 px-4 sm:px-6 lg:px-8">
      <div className="flex justify-center items-center pt-8 pb-4 mb-20">
        <Image
          src="/BissellLogo_Blue 1.svg"
          alt="Bissell Logo"
          width={200}
          height={100}
          className="max-w-xs"
        />
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-6 shadow rounded-lg">
          {" "}
          <div className="flex justify-between mb-6 flex-col gap-2">
            {" "}
            <h2 className="text-2xl font-bold text-gray-900">Sign In</h2>{" "}
          </div>
          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
              {error}
            </div>
          )}
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-gray-700"
              >
                Email Address
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                disabled={loading}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your admin email"
                className="mt-1 block w-full px-4 py-2 border border-gray-300 rounded-lg placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#2CC0DE] focus:border-transparent"
              />
            </div>
            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-gray-700"
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                disabled={loading}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                className="mt-1 block w-full px-4 py-2 border border-gray-300 rounded-lg placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#2CC0DE] focus:border-transparent"
              />
            </div>
            <div className="flex items-center justify-between">
              <label className="inline-flex items-center text-sm text-gray-700">
                <input
                  id="rememberMe"
                  type="checkbox"
                  checked={rememberMe}
                  disabled={loading}
                  onChange={(e) => setRememberMeState(e.target.checked)}
                  className="h-4 w-4 text-[#2CC0DE] focus:ring-[#2CC0DE] border-gray-300 rounded"
                />
                <span className="ml-2">Remember me</span>
              </label>
              <button
                type="button"
                onClick={handleForgotPassword}
                disabled={loading}
                className="text-sm font-medium text-[#2CC0DE] hover:underline"
              >
                Forgot Password?
              </button>
            </div>{" "}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2 px-4 rounded-lg bg-[#2CC0DE] text-white font-semibold hover:bg-teal-500 focus:outline-none focus:ring-2 focus:ring-[#2CC0DE]"
            >
              {loading ? "Signing In..." : "Sign In"}
            </button>
          </form>
          <p className="mt-6 text-center text-sm text-gray-600">
            Need an account? Contact your IT Administrator.
          </p>
        </div>
      </div>
    </div>
  );
}
