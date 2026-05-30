"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";

type BackNavigationProps = {
  href: string;
  label: string;
  className?: string;
};

export default function BackNavigation({
  href,
  label,
  className = "",
}: BackNavigationProps) {
  return (
    <div className={`w-full ${className}`}>
      <Link
        href={href}
        className="inline-flex items-center gap-2 rounded-lg border border-cyan-200 bg-white/80 px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:border-cyan-400 hover:bg-cyan-50 hover:text-cyan-700"
      >
        <ArrowLeft className="h-4 w-4" />
        <span>{label}</span>
      </Link>
    </div>
  );
}
