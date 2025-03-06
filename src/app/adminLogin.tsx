import React from "react";
import { Inter } from "next/font/google";
import LogoHeader from "./components/LogoHeader";

const inter = Inter({ subsets: ["latin"] });

function AdminLoginCard() {
  return (
    <div style={{flex:2}}>
    <div className={`${inter.className} login-card`}>
      <form action="" className="login-form">
        <h1 style={{fontSize: 40}}>Admin Login</h1>
        <div style={{display: "flex", flexDirection: "column", gap: 32, marginTop: 32}}>
          <div>
            <input className="text-box-entry" type="text" id="admin-id" name="admin-id" placeholder="Admin ID" />
            <input className="text-box-entry" type="password" id="password" name="password" placeholder="Password" />
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
