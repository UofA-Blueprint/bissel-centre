import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { initAdmin } from "@/app/services/firebaseAdmin";

export default async function CardsLayout({
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

  // IT admins get read-only access to the cards page — the page itself renders
  // the "View only" nav banner and disables every mutation control. Staff who
  // aren't in administrative_staff still get bounced back to /login.
  if (decodedClaims.admin !== true) {
    const staffDoc = await admin
      .firestore()
      .collection("administrative_staff")
      .doc(decodedClaims.uid)
      .get();

    if (!staffDoc.exists || staffDoc.data()?.isDeleted === true) {
      redirect("/login");
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 max-h-screen">
      <main className="mx-auto max-w-8xl p-0 sm:p-6">{children}</main>
    </div>
  );
}
