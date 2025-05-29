"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "../../services/firebase";
import Image from "next/image";
import {
  verifyPassword,
  setStaffUser,
  setRememberMe,
  getRememberedEmail,
} from "../../services/auth";

export default function StaffLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMeState] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    // pre-fill remembered email if available
    const rememberedEmail = getRememberedEmail();
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
      const staffQuery = query(
        collection(db, "administrative_staff"),
        where("email", "==", email.toLowerCase().trim())
      );
      const staffSnapshot = await getDocs(staffQuery);

      if (staffSnapshot.empty) {
        setError(
          "Invalid email or password. Please contact IT Admin if you need assistance."
        );
        return;
      }

      const staffDoc = staffSnapshot.docs[0];
      const staffData = staffDoc.data();

      const isPasswordValid = await verifyPassword(
        password,
        staffData.hashedPassword
      );

      if (!isPasswordValid) {
        setError(
          "Invalid email or password. Please contact IT Admin if you need assistance."
        );
        return;
      }

      setRememberMe(email, rememberMe);
      setStaffUser({
        id: staffDoc.id,
        email: staffData.email,
        firstName: staffData.firstName,
        secondName: staffData.secondName,
        createdBy: staffData.createdBy,
      });

      router.push("/staff/dashboard");
    } catch (err) {
      console.error("Login error:", err);
      if (err instanceof Error) {
        setError(`Login failed: ${err.message}`);
      } else {
        setError("An error occurred during login. Please try again.");
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
          <div className="flex justify-between mb-6 flex-col gap-2">
            <h2 className="text-2xl font-bold text-gray-900">Sign In</h2>
            <p className="text-sm text-gray-600">
              Don&apos;t have an account yet?{" "}
              <a
                href="/staff/register"
                className="font-medium text-[#2CC0DE] hover:underline"
              >
                Register
              </a>
            </p>
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
            </div>

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
