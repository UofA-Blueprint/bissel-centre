"use client";

import React, { useState } from "react";
import { Inter } from "next/font/google";
import LogoHeader from "@/app/components/LogoHeader";
import { signInWithCustomToken } from "firebase/auth";
import { auth } from "@/app/services/firebase";
import { useRouter } from "next/navigation";
import "./style.css";

const inter = Inter({ subsets: ["latin"] });

function AdminLoginCard() {
  const [adminId, setAdminId] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [showForgotPassword, setShowForgotPassword] = useState(false);

  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMessage("");
    setLoading(true);

    try {
      const identificationNumber = adminId.trim();
      if (!identificationNumber) {
        setErrorMessage("Please enter your Identification Number");
        setLoading(false);
        return;
      }

      // 1) request custom token from server route
      const tokenResp = await fetch("/admin/api/get-custom-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identificationNumber: adminId }),
      });

      if (!tokenResp.ok) {
        setErrorMessage("Invalid Credentials");
        setLoading(false);
        return;
      }

      const { customToken } = await tokenResp.json();
      if (!customToken) {
        setErrorMessage("Invalid Credentials");
        setLoading(false);
        return;
      }

      // 2) sign in client with custom token
      await signInWithCustomToken(auth, customToken);

      // 3) exchange idToken for session cookie via existing sign-in route
      const idToken = await auth.currentUser?.getIdToken();
      const sessionResp = await fetch("/admin/api/sign-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      });

      if (!sessionResp.ok) {
        setErrorMessage("Failed to establish session");
        setLoading(false);
        return;
      }

      // success -> navigate
      setLoading(false);
      router.push("/admin/dashboard");
    } catch (error) {
      console.error(error);
      setErrorMessage("Invalid Credentials");
      setLoading(false);
    }
  };

  const InfoModal = () => {
    return (
      <div
        className="modal-container"
        style={{ display: showForgotPassword ? "flex" : "none" }}
      >
        <div className="modal">
          <div className="modal-content">
            <h1>Forgot Credentials?</h1>
            <p>
              Unfortunately, we cannot provide credentials for IT Admins. If you
              are an IT Admin and have lost your credentials, please contact the
              Bissel Centre IT department for assistance.
              <br />
              As of now, no such automation exists to reset or retrieve admin
              credentials.
            </p>
          </div>
          <button
            className="modal-close"
            onClick={() => setShowForgotPassword(false)}
          >
            Close
          </button>
        </div>
      </div>
    );
  };
  return (
    <div style={{ flex: 2 }}>
      <InfoModal />
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
                onChange={(e) => setAdminId(e.target.value)}
              />{" "}
              <br />
            </div>
            {/* ask for  forgot password ?*/}

            <button
              type="button"
              style={{ float: "right" }}
              onClick={() => setShowForgotPassword(true)}
            >
              Forgot credentials?
            </button>
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
