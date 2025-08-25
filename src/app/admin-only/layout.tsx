import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { initAdmin } from "@/app/services/firebaseAdmin";

async function verifyAdminSession() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("session")?.value;

  if (!sessionCookie) {
    redirect("/admin/login");
  }

  try {
    const admin = await initAdmin();
    const decodedClaims = await admin
      .auth()
      .verifySessionCookie(sessionCookie, true);

    // Check if user has admin privileges
    if (!decodedClaims.admin) {
      redirect("/admin/login"); // Redirect non-admin users to admin login
    }

    return decodedClaims;
  } catch {
    redirect("/admin/login");
  }
}

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Verify admin session on server side
  await verifyAdminSession();

  return <div className="min-h-screen bg-gray-50">{children}</div>;
}
