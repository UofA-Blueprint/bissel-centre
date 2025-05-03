"use client";

import React, { useState } from "react";
import { Inter } from "next/font/google";
import LogoHeader from "@/app/components/LogoHeader";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "@/app/services/firebase";
import { getAuth } from 'firebase-admin/auth';

const inter = Inter({ subsets: ["latin"] });

function AdminLoginCard() {
  const [adminId, setAdminId] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    setErrorMessage("");
    setLoading(true);
    e.preventDefault();
    try {
      const q = query(collection(db, "it_admin"), where("hashedIdentificationNumber", "==", adminId));
      const querySnapshot = await getDocs(q);
      if (!querySnapshot.empty) {
        console.log(querySnapshot.docs[0].data());
      } else {
        setErrorMessage("Invalid Credentials");
      }
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
