import "../../globals.css";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { initAdmin } from "@/app/services/firebaseAdmin";

export default async function ProfileLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("session")?.value;

  if (!sessionCookie) {
    redirect("/login");
  }

  const admin = await initAdmin();
  let decodedClaims;
  try {
    decodedClaims = await admin.auth().verifySessionCookie(sessionCookie, true);
  } catch {
    redirect("/login");
  }

  // IT admins are not allowed on staff profile routes.
  if (decodedClaims.admin === true) {
    redirect("/admin/dashboard");
  }

  // Ensure this is a regular administrative staff member.
  const staffDoc = await admin
    .firestore()
    .collection("administrative_staff")
    .doc(decodedClaims.uid)
    .get();

  if (!staffDoc.exists) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      {children}
    </div>
  );
}
