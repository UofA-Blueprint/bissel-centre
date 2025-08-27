"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import { auth } from "../../services/firebase";
import { deleteUser, getAdminSession, listUsers } from "../actions";

interface User {
  uid: string;
  email: string | undefined;
  displayName: string | undefined;
  customClaims: Record<string, unknown> | undefined;
}

interface Session {
  name?: string;
  email: string;
}

export default function AdminDashboardPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    async function fetchData() {
      try {
        // First check if there's a valid session
        const sessionCheckResponse = await fetch("/api/user-session");
        if (!sessionCheckResponse.ok) {
          router.replace("/");
          return;
        }

        // Fetch session data
        const sessionResponse = await getAdminSession();
        console.log("Session response:", sessionResponse);
        if (!sessionResponse) {
          router.replace("/");
          return;
        }
        const sessionData = sessionResponse;

        setSession(sessionData);

        // Fetch users data
        const users = await listUsers();
        // if (!usersResponse.ok) {
        //   throw new Error("Failed to fetch users");
        // }
        // const usersData = await usersResponse.json();
        setUsers(users);
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred");
        // On error, redirect to home
        router.replace("/");
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [router]);

  const handleLogout = async () => {
    try {
      await fetch("/api/logout", { method: "POST" });
      await signOut(auth);
      router.replace("/admin/login");
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  async function handleDeleteUser(uid: string) {
    if (!confirm("Are you sure you want to delete this user?")) {
      return;
    }
    setLoading(true);
    try {
      await deleteUser(uid);

      // Remove user from local state
      setUsers(users.filter((user) => user.uid !== uid));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete user");
    }
    setLoading(false);
  }

  if (loading) {
    return (
      <main>
        <p>Loading...</p>
      </main>
    );
  }

  if (error) {
    return (
      <main>
        <p style={{ color: "red" }}>Error: {error}</p>
      </main>
    );
  }

  if (!session) {
    return null; // Will redirect
  }

  return (
    <main>
      <div className="bg-white shadow mb-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <h1 className="text-2xl font-bold text-gray-900">
              Welcome, Admin {session.name || session.email}
            </h1>
            <button
              onClick={handleLogout}
              className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-medium"
            >
              Logout
            </button>
          </div>
        </div>
      </div>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <p className="text-lg text-gray-700 mb-4">
          List of all administrative staff and IT admins:
        </p>
        <table>
          <thead>
            <tr>
              <th>UID</th>
              <th>Email</th>
              <th>Display Name</th>
              <th>Custom Claims</th>
              <th>Delete</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.uid}>
                <td>{user.uid}</td>
                <td>{user.email || "N/A"}</td>
                <td>{user.displayName || "N/A"}</td>
                <td>{JSON.stringify(user.customClaims || {})}</td>
                <td>
                  <button
                    onClick={() => handleDeleteUser(user.uid)}
                    style={{
                      backgroundColor: "#e53e3e",
                      color: "white",
                      border: "none",
                      padding: "0.4rem 0.8rem",
                      borderRadius: "4px",
                      cursor: "pointer",
                    }}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
