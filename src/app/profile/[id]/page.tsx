"use client";

import { useParams } from "next/navigation";

// TODO (Ticket 2.4): Build out the full recipient profile page here.
// - userId is available via useParams
// - Sidebar component exists at @/app/components/Sidebar (already has tabs + manage account)
// - User data services: getUserById, getArcCardsByUserId, getHistoryByUserId, getBannedUserInfo from @/app/services/userService
// - Header component at @/app/components/Header (supports back button + actions slot)
// - Shared types in ../types.ts

export default function ProfilePage() {
  const { id: userId } = useParams<{ id: string }>();

  return (
    <div className="p-6">
      <p>Profile: {userId}</p>
    </div>
  );
}
