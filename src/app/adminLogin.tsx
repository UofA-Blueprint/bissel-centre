import React from "react";
import { Inter } from "next/font/google";
import LogoHeader from "./components/LogoHeader";

const inter = Inter({ subsets: ["latin"] });

function AdminLoginCard() {
  return (
    <div style={{flex:2}}>
    <div className={`${inter.className} login-card`}>
      <form action="" className="login-form">
        <h1 style={{fontSize: 24}}>Admin</h1>
        <div style={{display: "flex", flexDirection: "column", gap: 32, marginTop: 32}}>
          <div>
            <label htmlFor="admin-id">Identification Number</label> <br />
            <input className="text-box-entry" type="number" id="admin-id" name="admin-id" placeholder="Identification Number" /> <br />
            <label htmlFor="admin-id">Password</label> <br />
            <input className="text-box-entry" type="password" id="password" name="password" placeholder="Password" /> <br />
          </div>
          {/* ask for  forgot password ?*/}
      
          <button type="button" style={{float: "right"}}>Forgot Password?</button>
          <button type="submit" className="form-submit-button">Sign In</button>
        </div>
      </form>
      </div>
    </div>
  );
}

export default function AdminLogin() {
  return (
    <div className="hcenter center-window">
      <LogoHeader />'
      <AdminLoginCard />
    </div>
  );
}
