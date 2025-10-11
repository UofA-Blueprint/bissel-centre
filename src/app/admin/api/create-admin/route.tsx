import { NextRequest, NextResponse } from "next/server";
import { createAdmin, checkAdmin } from "@/app/admin/actions";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, firstName, lastName, identificationNumber } = body ?? {};

    if (!email || !firstName || !lastName || !identificationNumber) {
      return NextResponse.json(
        {
          error:
            "Missing required fields: email, firstName, lastName, identificationNumber",
        },
        { status: 400 }
      );
    }

    // verify the requester is an authorized IT admin
    const isAuthorized = await checkAdmin(identificationNumber);
    if (!isAuthorized) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    const displayName = `${firstName} ${lastName}`;
    const result = await createAdmin(email, displayName);

    if (!result || !result.user) {
      return NextResponse.json(
        { error: "Failed to create admin user" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      uid: result.user.uid,
      rawId: result.rawId,
    });
  } catch (err: any) {
    console.error("create-admin route error:", err);
    const message = err?.message ?? "Unexpected error creating admin user";
    const status = err?.code === "auth/email-already-exists" ? 409 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
