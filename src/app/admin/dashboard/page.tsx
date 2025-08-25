"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { deleteUser, getAdminSession, listUsers } from "../actions";

interface User {
  uid: string;
  email: string;
  displayName: string;
  customClaims: any;
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
        // Fetch session data
        const sessionResponse = await getAdminSession();
        console.log("Session response:", sessionResponse);
        if (!sessionResponse) {
          router.push("/admin/login");
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
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [router]);

  async function handleDeleteUser(uid: string) {
    if (!confirm("Are you sure you want to delete this user?")) {
      return;
    }
    setLoading(true);
    try {
      const response = await deleteUser(uid);

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
            <h1 className="text-2xl font-bold text-gray-900">Welcome, Admin {session.name || session.email}</h1>
            <button
              onClick={() => router.push("/admin/login")}
              className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-medium"
            >
              Logout
            </button>
          </div>
        </div>
      </div>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <p className="text-lg text-gray-700 mb-4">List of all administrative staff and IT admins:</p>
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
              <td>{user.email}</td>
              <td>{user.displayName}</td>
              <td>{JSON.stringify(user.customClaims)}</td>
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
