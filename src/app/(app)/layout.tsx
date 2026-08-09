import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { initAdmin } from "@/app/services/firebaseAdmin";
import TopNav, { NavUser } from "@/app/components/TopNav";
import { ViewModeProvider } from "./ViewModeContext";

export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("session")?.value;

  if (!sessionCookie) {
    redirect("/login");
  }

  let user: NavUser;
  let isAdmin = false;
  try {
    const admin = await initAdmin();
    const decodedClaims = await admin
      .auth()
      .verifySessionCookie(sessionCookie, true);
    isAdmin = decodedClaims.admin === true;
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
      <TopNav user={user} viewOnly={isAdmin} />
      <ViewModeProvider value={isAdmin ? "admin" : "staff"}>
        {children}
      </ViewModeProvider>
    </div>
  );
}
