import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { initAdmin } from "@/app/services/firebaseAdmin";
import PageHeader from "@/app/components/PageHeader";
import AdminGateActions from "@/app/components/AdminGateActions";

// The "Admin" tab is visible to everyone in the shared nav, but the page is
// only functional for IT admins. Non-admins get a message instead of being
// redirected, so the rest of the nav stays usable.
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

  if (!isAdmin) {
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

  return (
    <>
      <PageHeader title="Admin" />
      <div className="p-6 max-w-7xl mx-auto w-full">
        <p className="text-gray-700">IT Admin tools are coming soon.</p>
      </div>
    </>
  );
}
