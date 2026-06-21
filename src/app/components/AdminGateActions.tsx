"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import { auth } from "@/app/services/firebase";

// Buttons shown on the /it-admin gate for users who aren't IT admins.
export default function AdminGateActions() {
  const router = useRouter();

  // The viewer is signed in as staff, and middleware bounces a staff session
  // away from /admin/login. So clear the session first, then send them to the
  // admin login to sign in as an IT admin.
  const handleAdminLogin = async () => {
    try {
      await fetch("/api/logout", { method: "POST" });
      await signOut(auth);
    } catch (error) {
      console.error("Logout failed:", error);
    }
    router.push("/admin/login");
  };

  return (
    <div className="flex flex-col sm:flex-row items-center gap-3">
      <Link
        href="/dashboard"
        className="px-6 py-2.5 rounded-lg bg-primary text-white font-medium hover:bg-cyan-600 transition-colors"
      >
        Return to Dashboard
      </Link>
      <button
        onClick={handleAdminLogin}
        className="px-6 py-2.5 rounded-lg border border-gray-300 text-gray-700 font-medium hover:bg-gray-100 transition-colors"
      >
        Log in as IT Admin
      </button>
    </div>
  );
}
