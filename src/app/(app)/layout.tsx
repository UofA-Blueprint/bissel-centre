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
    // Hot render path (every navigation): skip the revocation round-trip and
    // read display info from the session claims instead of a getUser() call —
    // one network call instead of three. Session cookies expire in ≤5 days
    // and write endpoints still verify with revocation (SCALE-05).
    const decodedClaims = await admin
      .auth()
      .verifySessionCookie(sessionCookie);
    isAdmin = decodedClaims.admin === true;
    if (!isAdmin) {
      const staffDoc = await admin
        .firestore()
        .collection("administrative_staff")
        .doc(decodedClaims.uid)
        .get();
      if (!staffDoc.exists || staffDoc.data()?.isDeleted === true) {
        redirect("/login");
      }
    }
    user = {
      name: (decodedClaims.name as string | undefined) || "",
      email: decodedClaims.email || "",
      photoURL: (decodedClaims.picture as string | undefined) || "",
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
