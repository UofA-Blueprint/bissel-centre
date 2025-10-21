import { NextResponse } from "next/server";
import { handleITAdminLogin } from "@/app/admin/actions";

// POST /admin/api/get-custom-token
// body: { identificationNumber: string }
// response: { customToken: string } | { error: string }
// Get a custom token for IT admin login

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const identificationNumber =
      body?.identificationNumber ?? body?.IdentificationNumber ?? null;

    if (!identificationNumber || typeof identificationNumber !== "string") {
      return NextResponse.json(
        { error: "Missing identificationNumber" },
        { status: 400 }
      );
    }

    const customToken = await handleITAdminLogin(identificationNumber.trim());
    if (!customToken) {
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 }
      );
    }

    return NextResponse.json({ customToken });
  } catch (err) {
    console.error("get-custom-token error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
