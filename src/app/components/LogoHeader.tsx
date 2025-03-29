import React from "react";
import { Inter } from "next/font/google";
import Logo from "./Logo";

const inter = Inter({ subsets: ["latin"] });

export default function LogoHeader() {
  return (
    <div className={`top-bissell-header ${inter.className}`}>
      <Logo />
      <div>
        <div className="bissell-header-text">Bissell Centre</div>
      </div>
    </div>
  );
}
