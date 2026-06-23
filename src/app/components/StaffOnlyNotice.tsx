import Link from "next/link";

// Shown on staff-only routes when an IT admin lands there.
export default function StaffOnlyNotice() {
  return (
    <div className="flex flex-col items-center justify-center gap-6 p-16 text-center">
      <p className="max-w-md text-lg text-gray-600">
        This page is for administrative staff. You&apos;re signed in as an IT
        Admin.
      </p>
      <Link
        href="/admin/dashboard"
        className="rounded-lg bg-primary px-6 py-2.5 font-medium text-white transition-colors hover:bg-cyan-600"
      >
        Go to Admin Dashboard
      </Link>
    </div>
  );
}
