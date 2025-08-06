import React from "react";
import { Inter } from "next/font/google";
import Logo from "./Logo";
import Image from "next/image";

const inter = Inter({ subsets: ["latin"] });

export default function LogoHeader() {
  return (
    <div className={`top-bissell-header ${inter.className}`}>
      <Image src="/logo.png" alt="Bissell Centre Logo" width={200} height={64} />
    </div>
  );
}
