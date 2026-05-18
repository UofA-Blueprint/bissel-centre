import "../globals.css";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { initAdmin } from "@/app/services/firebaseAdmin";

export default async function ReportsLayout({
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

  if (decodedClaims.admin === true) {
    redirect("/admin/dashboard");
  }

  const staffDoc = await admin
    .firestore()
    .collection("administrative_staff")
    .doc(decodedClaims.uid)
    .get();

  if (!staffDoc.exists) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 max-h-screen">
      <main className="mx-auto max-w-8xl p-6">{children}</main>
    </div>
  );
}
