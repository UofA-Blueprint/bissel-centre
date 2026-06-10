import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { initAdmin } from "@/app/services/firebaseAdmin";
import PageHeader from "@/app/components/PageHeader";
import AdminGateActions from "@/app/components/AdminGateActions";

// The "Admin" tab is visible to everyone. IT admins are sent to the real admin
// tools (/admin/dashboard); everyone else gets a sign-in message so the rest of
// the nav stays usable.
export default async function ITAdminPage() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("session")?.value;

  if (!sessionCookie) {
    redirect("/login");
  }

  let isAdmin = false;
  try {
    const admin = await initAdmin();
    const decodedClaims = await admin
      .auth()
      .verifySessionCookie(sessionCookie, true);
    isAdmin = decodedClaims.admin === true;
  } catch {
    redirect("/login");
  }

  if (isAdmin) {
    redirect("/admin/dashboard");
  }

  return (
    <>
      <PageHeader title="Admin" />
      <div className="flex flex-col items-center justify-center gap-6 p-16">
        <p className="text-gray-600 text-lg text-center">
          You need to sign in as an IT Admin to access this page.
        </p>
        <AdminGateActions />
      </div>
    </>
  );
}
