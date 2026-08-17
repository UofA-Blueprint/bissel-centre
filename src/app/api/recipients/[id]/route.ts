import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { decryptPhone, encryptPhone } from "@/utils/phoneEncryption";
import { getStaffAccess } from "@/app/api/_lib/staffAccess";

type ProfileDetails = {
  firstName?: unknown;
  lastName?: unknown;
  alias?: unknown;
  gender?: unknown;
  phone?: unknown;
  email?: unknown;
  dob?: unknown;
  address?: unknown;
  postalCode?: unknown;
};

type AdditionalInfo = {
  journey?: unknown;
  mostCommonReason?: unknown;
  secondMostCommonReason?: unknown;
  housingOption?: unknown;
  notes?: unknown;
};

const EDITABLE_FIELDS = [
  "firstName",
  "secondName",
  "aliases",
  "genderIdentity",
  "dateOfBirth",
  "email",
  "phone",
  "address",
  "postalCode",
  "picture",
  "journey",
  "mostCommonReason",
  "secondMostCommonReason",
  "housingOption",
  "notes",
] as const;

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function getProfileUpdate(body: {
  personalDetails?: ProfileDetails;
  additionalInfo?: AdditionalInfo;
  photoUpload?: { imageUrl?: unknown };
}) {
  const personal = body.personalDetails ?? {};
  const additional = body.additionalInfo ?? {};
  const updates: Record<string, unknown> = {
    firstName: text(personal.firstName),
    secondName: text(personal.lastName),
    aliases: text(personal.alias) ? [text(personal.alias)] : [],
    genderIdentity: text(personal.gender) || null,
    dateOfBirth: text(personal.dob) || null,
    email: text(personal.email),
    phone: encryptPhone(text(personal.phone) || null),
    address: text(personal.address) || null,
    postalCode: text(personal.postalCode).toUpperCase(),
    picture: text(body.photoUpload?.imageUrl),
    journey: text(additional.journey) || null,
    mostCommonReason: text(additional.mostCommonReason) || null,
    secondMostCommonReason: text(additional.secondMostCommonReason) || null,
    housingOption: text(additional.housingOption) || null,
    notes: text(additional.notes) || null,
  };

  if (!updates.firstName || !updates.secondName || !updates.email || !updates.postalCode) {
    return { error: "First name, last name, email, and postal code are required." };
  }

  if (!/^[A-Za-z]\d[A-Za-z]\s?\d[A-Za-z]\d$/.test(updates.postalCode as string)) {
    return { error: "Invalid postal code format." };
  }

  if (!updates.picture) {
    return { error: "Recipient photo is required." };
  }

  return { updates };
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const access = await getStaffAccess();
  if ("error" in access) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const { id } = await params;
  const snapshot = await access.db.collection("users").doc(id).get();
  if (!snapshot.exists) {
    return NextResponse.json({ error: "Recipient not found" }, { status: 404 });
  }

  const data = snapshot.data() ?? {};
  return NextResponse.json({
    id: snapshot.id,
    personalDetails: {
      firstName: data.firstName ?? "",
      lastName: data.secondName ?? "",
      alias: Array.isArray(data.aliases) ? data.aliases[0] ?? "" : "",
      gender: data.genderIdentity ?? "",
      phone: decryptPhone(data.phone ?? data.phoneNumber ?? null) ?? "",
      email: data.email ?? "",
      dob: data.dateOfBirth ?? "",
      address: data.address ?? "",
      postalCode: data.postalCode ?? "",
    },
    additionalInfo: {
      journey: data.journey ?? "",
      mostCommonReason: data.mostCommonReason ?? "",
      secondMostCommonReason: data.secondMostCommonReason ?? "",
      housingOption: data.housingOption ?? "",
      notes: data.notes ?? "",
    },
    photoUpload: { imageUrl: data.picture ?? "" },
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const access = await getStaffAccess();
  if ("error" in access) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const { id } = await params;
  const recipientRef = access.db.collection("users").doc(id);
  const existing = await recipientRef.get();
  if (!existing.exists) {
    return NextResponse.json({ error: "Recipient not found" }, { status: 404 });
  }

  let body: {
    personalDetails?: ProfileDetails;
    additionalInfo?: AdditionalInfo;
    photoUpload?: { imageUrl?: unknown };
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const result = getProfileUpdate(body);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  const previous = existing.data() ?? {};
  const changedFields = EDITABLE_FIELDS.filter((field) => {
    const before = field === "phone"
      ? previous.phone ?? previous.phoneNumber ?? null
      : previous[field];
    return JSON.stringify(before ?? null) !== JSON.stringify(result.updates[field] ?? null);
  });

  const batch = access.db.batch();
  batch.update(recipientRef, {
    ...result.updates,
    updatedAt: FieldValue.serverTimestamp(),
  });
  batch.create(access.db.collection("history").doc(), {
    date: FieldValue.serverTimestamp(),
    userId: id,
    modifiedBy: access.uid,
    event: "Profile Update",
    notes: `Updated fields: ${changedFields.join(", ") || "none"}`,
  });
  await batch.commit();

  return NextResponse.json({ success: true, changedFields });
}