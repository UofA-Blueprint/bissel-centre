"use client";

import React, { useState } from "react";
import { Inter } from "next/font/google";
import LogoHeader from "@/app/components/LogoHeader";
import { handleITAdminLogin } from "@/app/admin/actions";
import firebase from "firebase/compat/app";
import { signInWithCustomToken } from "firebase/auth";
import { auth } from "@/app/services/firebase";
import { useRouter } from "next/navigation";
import { hashITIDNumber } from "../../../../utils/hashITIDNumber";
import "./style.css";

const inter = Inter({ subsets: ["latin"] });

function AdminLoginCard() {
  const [adminId, setAdminId] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [showForgotPassword, setShowForgotPassword] = useState(false);

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
        setLoading(false);
        return;
      }

      signInWithCustomToken(auth, customToken)
        .then(async () => {
          console.log("Signed in");
          const idToken = await auth.currentUser?.getIdToken();
          // this call sets the session cookie
          return fetch("/admin/api", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ idToken }),
          });
        })
        .then((response) => {
          console.log(response);
          if (response.ok) {
            console.log("Logged in");
            router.push("/admin-only/dashboard");
          } else {
            console.log("Failed to log in");
            setErrorMessage("Invalid Credentials");
            setLoading(false);
          }
        });
    } catch (error) {
      console.log(error);
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

// export async function getServerSideProps({ req }) {
//   const cookies = parse(req.headers.cookie || '');
//   const session = cookies.session || '';

//   try {
//     const decodedToken = await getAuth().verifySessionCookie(session, true);
//     return { props: { user: decodedToken } };
//   } catch (error) {
//     return {
//       redirect: {
//         destination: '/login',
//         permanent: false,
//       },
//     };
//   }
// }

export default function AdminLogin() {
  return (
    <div className="hcenter center-window">
      <LogoHeader />'
      <AdminLoginCard />
    </div>
  );
}
