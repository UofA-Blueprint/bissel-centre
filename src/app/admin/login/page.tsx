"use client";

import React, { useState } from "react";
import { Inter } from "next/font/google";
import LogoHeader from "@/app/components/LogoHeader";
import { handleITAdminLogin } from "@/app/admin/actions";
import { signInWithCustomToken } from "firebase/auth";
import { auth } from "@/app/services/firebase";
import { useRouter } from "next/navigation";

const inter = Inter({ subsets: ["latin"] });

function AdminLoginCard() {
  const [adminId, setAdminId] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    setErrorMessage("");
    setLoading(true);
    e.preventDefault();
    try {
      const customToken = await handleITAdminLogin(adminId);
      if (customToken === null) {
        setErrorMessage("Invalid Credentials");
        return;
      }

      await signInWithCustomToken(auth, customToken);
      console.log("Signed in");
      const idToken = await auth.currentUser?.getIdToken();

      const response = await fetch("/admin/api", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      });

      if (response.ok) {
        console.log("Logged in");
        router.push("/profile/Display-Recipient-Profile");
      } else {
        console.log("Failed to log in");
        setErrorMessage("Invalid Credentials");
      }
    } catch (error) {
      console.log(error);
      setErrorMessage("Invalid Credentials");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ flex: 2 }}>
      <div className={`${inter.className} login-card`}>
        <form
          action=""
          className={`login-form ${
            loading ? "opacity-50 pointer-events-none" : ""
          }`}
          onSubmit={handleSubmit}
        >
          <h1 style={{ fontSize: 24 }}>Admin</h1>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 32,
              marginTop: 32,
            }}
          >
            <div>
              <label htmlFor="admin-id">Identification Number</label> <br />
              <input
                className="text-box-entry"
                required={true}
                type="text"
                aria-label="admin-id"
                id="admin-id"
                name="admin-id"
                placeholder="Identification Number"
                value={adminId}
                onChange={(e) => setAdminId(e.target.value)}
              />{" "}
              <br />
            </div>
            {errorMessage ? (
              <div className="error-message">
                <p>{errorMessage}</p>
              </div>
            ) : null}
            <button
              type="submit"
              className="form-submit-button"
              disabled={loading}
              aria-label="sign-in"
            >
              Sign In
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function AdminLogin() {
  return (
    <div className="hcenter center-window">
      <LogoHeader />
      <AdminLoginCard />
    </div>
  );
}
