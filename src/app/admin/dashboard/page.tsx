// app/admin/page.tsx

import { getAdminSession } from "@/app/admin/actions";
import { redirect } from 'next/navigation';

export default async function AdminDashboardPage() {
  const session = await getAdminSession();

  if (!session) {
    // Not authenticated or not an admin
    redirect('/login'); // or display custom unauthorized message
  }

  return (
    <main>
      <h1>Welcome, Admin {session.name || session.email}</h1>
      {/* Admin content goes here */}
    </main>
  );
}
