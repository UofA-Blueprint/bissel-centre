"use client";

import React, { useState } from "react";
import { Inter } from "next/font/google";
import LogoHeader from "@/app/components/LogoHeader";
import { handleITAdminLogin } from "@/app/admin/actions";
import firebase from "firebase/compat/app";
import { signInWithCustomToken } from "firebase/auth";
import { auth } from "@/app/services/firebase";
import { useRouter } from "next/navigation";

const inter = Inter({ subsets: ["latin"] });

function AdminLoginCard() {
  const [adminId, setAdminId] = useState("");
  const [password, setPassword] = useState("");
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
      
      signInWithCustomToken(auth, customToken)
      .then (async () =>  {
        console.log("Signed in")
        const idToken = await auth.currentUser?.getIdToken();
      // this call sets the session cookie
        return fetch("/admin/api", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ idToken }),
        });
      }).then((response) => {
        console.log(response);
        if (response.ok) {
          console.log("Logged in");
          router.push("/admin/dashboard");
        } else {
          console.log("Failed to log in");
          setErrorMessage("Invalid Credentials");
        }
      });

      
    } catch (error) {
      console.log(error);
      setErrorMessage("Invalid Credentials");
    }
    setLoading(false);
  };

  return (
    <div style={{flex:2}}>
    <div className={`${inter.className} login-card`}>
      <form action="" className="login-form" onSubmit={handleSubmit}>
        <h1 style={{fontSize: 24}}>Admin</h1>
        <div style={{display: "flex", flexDirection: "column", gap: 32, marginTop: 32}}>
          <div>
            <label htmlFor="admin-id">Identification Number</label> <br />
            <input className="text-box-entry" type="text" aria-label="admin-id" id="admin-id" name="admin-id" placeholder="Identification Number" onChange={(e) => setAdminId(e.target.value)} /> <br />
            <label htmlFor="admin-id">Password</label> <br />
            <input className="text-box-entry" type="password" id="password" name="password" placeholder="Password" /> <br />
          </div>
          {/* ask for  forgot password ?*/}
      
          <button type="button" style={{float: "right"}}>Forgot Password?</button>
          {errorMessage? <div className="error-message">
            <p>{errorMessage}</p>
          </div> : null}
          <button type="submit" className="form-submit-button" disabled={loading} aria-label="sign-in">Sign In</button>
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
