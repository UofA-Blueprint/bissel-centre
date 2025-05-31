"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { collection, query, where, getDocs } from "firebase/firestore";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth, db } from "../services/firebase";
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
        email.toLowerCase().trim(),
        password
      );

      // Verify the user exists in administrative_staff collection
      const staffQuery = query(
        collection(db, "administrative_staff"),
        where("email", "==", email.toLowerCase().trim())
      );
      const staffSnapshot = await getDocs(staffQuery);

      if (staffSnapshot.empty) {
        // If user is authenticated but not in staff collection, sign them out
        await auth.signOut();
        setError("Access denied. This login is for administrative staff only.");
        setLoading(false);
        return;
      }

      const staffDoc = staffSnapshot.docs[0];
      const staffData = staffDoc.data();

      // Handle remember me
      if (rememberMe) {
        localStorage.setItem("rememberedEmail", email);
      } else {
        localStorage.removeItem("rememberedEmail");
      }

      // Store staff user data in localStorage
      localStorage.setItem(
        "staffUser",
        JSON.stringify({
          id: staffDoc.id,
          email: staffData.email,
          firstName: staffData.firstName,
          secondName: staffData.secondName,
          createdBy: staffData.createdBy,
          role: staffData.role || "staff",
        })
      );

      router.push("/dashboard");
    } catch (err: any) {
      console.error("Login error:", err);
      if (
        err.code === "auth/user-not-found" ||
        err.code === "auth/wrong-password" ||
        err.code === "auth/invalid-credential"
      ) {
        setError(
          "Invalid email or password. Please contact IT Admin if you need assistance."
        );
      } else if (err.code === "auth/too-many-requests") {
        setError("Too many failed login attempts. Please try again later.");
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
