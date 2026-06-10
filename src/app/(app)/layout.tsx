import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { initAdmin } from "@/app/services/firebaseAdmin";
import TopNav, { NavUser } from "@/app/components/TopNav";

export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("session")?.value;

  if (!sessionCookie) {
    redirect("/login");
  }

  let user: NavUser;
  try {
    const admin = await initAdmin();
    const decodedClaims = await admin
      .auth()
      .verifySessionCookie(sessionCookie, true);
    const userRecord = await admin.auth().getUser(decodedClaims.uid);
    user = {
      name: userRecord.displayName || "",
      email: userRecord.email || "",
      photoURL: userRecord.photoURL || "",
    };
  } catch {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <TopNav user={user} />
      {children}
    </div>
  );
}
