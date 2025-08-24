import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { initAdmin } from "@/app/services/firebaseAdmin";

async function verifySession() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("session")?.value;

  if (!sessionCookie) {
    redirect("/login");
  }

  try {
    const admin = await initAdmin();
    const decodedClaims = await admin
      .auth()
      .verifySessionCookie(sessionCookie, true);
    return decodedClaims;
  } catch (error) {
    console.error("Session verification failed:", error);
    redirect("/login");
  }
}

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Verify session on server side
  await verifySession();

  return <div className="min-h-screen bg-gray-50">{children}</div>;
}
