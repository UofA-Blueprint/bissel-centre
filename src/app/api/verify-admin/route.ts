import { NextRequest, NextResponse } from "next/server";
import { checkAdmin } from "../../admin/actions";
import { hashITIDNumber } from "../../../../utils/hashITIDNumber";

export async function POST(request: NextRequest) {
  try {
    const { identificationNumber } = await request.json();

    if (!identificationNumber) {
      return NextResponse.json(
        { error: "Identification number is required" },
        { status: 400 }
      );
    }

    const hashedID = hashITIDNumber(identificationNumber);
    const isAdmin = await checkAdmin(hashedID);

    if (isAdmin) {
      return NextResponse.json({ success: true, hashedID });
    } else {
      return NextResponse.json(
        { error: "Identification number not found" },
        { status: 404 }
      );
    }
  } catch (error) {
    console.error("Error verifying admin:", error);
    return NextResponse.json(
      { error: "Failed to verify identification number. Please try again." },
      { status: 500 }
    );
  }
}
