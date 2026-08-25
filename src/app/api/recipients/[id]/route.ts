import { NextRequest, NextResponse } from "next/server";
import { FieldPath, FieldValue } from "firebase-admin/firestore";
import { decryptPhone, encryptPhone } from "@/utils/phoneEncryption";
import { getStaffAccess } from "@/app/api/_lib/staffAccess";
import { processRecipientPhoto } from "@/app/services/recipientPhotoService";
import {
  deleteSearchIndexEntry,
  upsertSearchIndexEntry,
} from "@/app/services/searchIndexService";

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

type ManageAction = "FLAG" | "UNFLAG" | "BAN" | "UNBAN" | "DELETE";
const EDMONTON_TIMEZONE = "America/Edmonton";

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
  "journey",
  "mostCommonReason",
  "secondMostCommonReason",
  "housingOption",
  "notes",
] as const;

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function toIsoDate(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "string") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? value : parsed.toISOString();
  }
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString();
  }
  const candidate = value as { toDate?: () => Date };
  if (typeof candidate?.toDate === "function") {
    const date = candidate.toDate();
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }
  return null;
}

function parseDateOnlyAtNoonUtc(value: string): string | null {
  const raw = String(value || "").trim();
  if (!raw) return null;
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) {
    return new Date(
      `${iso[1]}-${iso[2]}-${iso[3]}T12:00:00.000Z`,
    ).toISOString();
  }
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function formatEdmontonDate(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: EDMONTON_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  if (!year || !month || !day) return "";
  return `${year}-${month}-${day}`;
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
    journey: text(additional.journey) || null,
    mostCommonReason: text(additional.mostCommonReason) || null,
    secondMostCommonReason: text(additional.secondMostCommonReason) || null,
    housingOption: text(additional.housingOption) || null,
    notes: text(additional.notes) || null,
  };

  if (
    !updates.firstName ||
    !updates.secondName ||
    !updates.email ||
    !updates.postalCode
  ) {
    return {
      error: "First name, last name, email, and postal code are required.",
    };
  }

  if (
    !/^[A-Za-z]\d[A-Za-z]\s?\d[A-Za-z]\d$/.test(updates.postalCode as string)
  ) {
    return { error: "Invalid postal code format." };
  }

  return { updates };
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const access = await getStaffAccess();
  if ("error" in access) {
    return NextResponse.json(
      { error: access.error },
      { status: access.status },
    );
  }

  const { id } = await params;
  const [snapshot, photoSnap, historySnap, currentCardSnap] = await Promise.all(
    [
      access.db.collection("users").doc(id).get(),
      access.db.collection("user_photos").doc(id).get(),
      access.db.collection("history").where("userId", "==", id).get(),
      access.db
        .collection("arc_cards")
        .where("currentUserId", "==", id)
        .limit(1)
        .get(),
    ],
  );
  if (!snapshot.exists) {
    return NextResponse.json({ error: "Recipient not found" }, { status: 404 });
  }

  const data = snapshot.data() ?? {};
  const modifiedByIds = Array.from(
    new Set(
      historySnap.docs
        .map((doc) => String(doc.data()?.modifiedBy ?? "").trim())
        .filter((value) => value.length > 0),
    ),
  );
  const staffNameById = new Map<string, string>();
  if (modifiedByIds.length > 0) {
    const chunks: string[][] = [];
    for (let i = 0; i < modifiedByIds.length; i += 10) {
      chunks.push(modifiedByIds.slice(i, i + 10));
    }
    for (const chunk of chunks) {
      const staffSnap = await access.db
        .collection("administrative_staff")
        .where(FieldPath.documentId(), "in", chunk)
        .get();
      for (const doc of staffSnap.docs) {
        const staff = doc.data();
        const first = String(staff.firstName ?? "").trim();
        const last = String(staff.lastName ?? staff.secondName ?? "").trim();
        const full = `${first} ${last}`.trim();
        staffNameById.set(doc.id, full || String(staff.email ?? doc.id));
      }
    }
  }

  const historyRows: Array<{
    id: string;
    dateModified: string | null;
    modifiedBy: string;
    actionTaken: string;
    reason: string;
  }> = [];

  for (const doc of historySnap.docs) {
    const row = doc.data() ?? {};
    const modifiedById = String(row.modifiedBy ?? "");
    historyRows.push({
      id: `history-${doc.id}`,
      dateModified: toIsoDate(row.date),
      modifiedBy: staffNameById.get(modifiedById) || "Staff member",
      actionTaken: String(row.event ?? "Update"),
      reason: String(row.reason ?? row.notes ?? "").trim(),
    });
  }

  historyRows.sort((a, b) => {
    const aTime = a.dateModified ? new Date(a.dateModified).getTime() : 0;
    const bTime = b.dateModified ? new Date(b.dateModified).getTime() : 0;
    return bTime - aTime;
  });

  return NextResponse.json({
    id: snapshot.id,
    personalDetails: {
      firstName: data.firstName ?? "",
      lastName: data.secondName ?? "",
      alias: Array.isArray(data.aliases) ? (data.aliases[0] ?? "") : "",
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
    photoUpload: {
      imageUrl:
        photoSnap.exists || data.picture
          ? `/api/users/${encodeURIComponent(id)}/photo?v=${encodeURIComponent(
              String(
                photoSnap.data()?.updatedAt?.toMillis?.() ??
                  data.updatedAt?.toMillis?.() ??
                  "legacy",
              ),
            )}`
          : "",
      thumbnail: data.photoThumb ?? "",
    },
    accountState: {
      banned: data.banned === true,
      flagged: data.flagged === true,
    },
    arcCard: currentCardSnap.empty
      ? {
          arcCardDigits: "",
          currentCardId: "",
          currentStatus: "Unattributed",
          currentDepartment: "",
          allocationDate: "",
        }
      : (() => {
          const cardDoc = currentCardSnap.docs[0];
          const card = cardDoc.data() ?? {};
          return {
            arcCardDigits: String(card.arcCardNumber ?? ""),
            currentCardId: cardDoc.id,
            currentStatus: String(card.status ?? "Active"),
            currentDepartment: String(card.department ?? ""),
            allocationDate: String(card.allocationDate ?? ""),
          };
        })(),
    history: historyRows,
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const access = await getStaffAccess();
  if ("error" in access) {
    return NextResponse.json(
      { error: access.error },
      { status: access.status },
    );
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
    arcCard?: { arcCardDigits?: unknown };
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

  const submittedPhoto = text(body.photoUpload?.imageUrl);
  let processedPhoto: Awaited<ReturnType<typeof processRecipientPhoto>> | null =
    null;
  if (submittedPhoto.startsWith("data:")) {
    try {
      processedPhoto = await processRecipientPhoto(submittedPhoto);
    } catch (error) {
      return NextResponse.json(
        {
          error:
            error instanceof Error ? error.message : "Invalid recipient photo.",
        },
        { status: 400 },
      );
    }
  }

  const previous = existing.data() ?? {};
  const changedFields: string[] = EDITABLE_FIELDS.filter((field) => {
    const before =
      field === "phone"
        ? (previous.phone ?? previous.phoneNumber ?? null)
        : previous[field];
    return (
      JSON.stringify(before ?? null) !==
      JSON.stringify(result.updates[field] ?? null)
    );
  });
  if (processedPhoto) changedFields.push("picture");
  const recipientUpdates = {
    ...result.updates,
    ...(processedPhoto
      ? { photoThumb: processedPhoto.photoThumb, picture: FieldValue.delete() }
      : {}),
  };
  const searchData = { ...previous, ...result.updates };

  const shouldProcessArcCardChange = Object.prototype.hasOwnProperty.call(
    body,
    "arcCard",
  );
  const requestedArcCardDigits = text(body.arcCard?.arcCardDigits).replace(
    /\D/g,
    "",
  );
  const nowServerTimestamp = FieldValue.serverTimestamp();
  const nowDate = new Date();
  const cardActionNotes: string[] = [];

  if (!shouldProcessArcCardChange) {
    const batch = access.db.batch();
    batch.update(recipientRef, {
      ...recipientUpdates,
      updatedAt: nowServerTimestamp,
    });
    if (processedPhoto) {
      batch.set(access.db.collection("user_photos").doc(id), {
        picture: processedPhoto.picture,
        updatedAt: nowServerTimestamp,
      });
    }
    upsertSearchIndexEntry(batch, access.db, id, searchData);
    batch.create(access.db.collection("history").doc(), {
      date: nowServerTimestamp,
      userId: id,
      modifiedBy: access.uid,
      event: "Profile Update",
      notes: `Updated fields: ${changedFields.join(", ") || "none"}`,
    });
    await batch.commit();
    return NextResponse.json({ success: true, changedFields });
  }

  await access.db.runTransaction(async (tx) => {
    const currentCardQuery = access.db
      .collection("arc_cards")
      .where("currentUserId", "==", id)
      .limit(1);
    const currentCardResult = await tx.get(currentCardQuery);
    const currentCardDoc = currentCardResult.empty
      ? null
      : currentCardResult.docs[0];

    let targetCardDoc: FirebaseFirestore.QueryDocumentSnapshot | null = null;
    if (shouldProcessArcCardChange && requestedArcCardDigits) {
      const targetCardQuery = access.db
        .collection("arc_cards")
        .where("arcCardNumber", "==", requestedArcCardDigits)
        .limit(1);
      const targetCardResult = await tx.get(targetCardQuery);
      if (targetCardResult.empty) {
        throw new Error("Selected ARC card does not exist");
      }
      targetCardDoc = targetCardResult.docs[0];
      const targetCardData = targetCardDoc.data() as {
        currentUserId?: string | null;
        status?: string;
      };
      if (targetCardData.currentUserId && targetCardData.currentUserId !== id) {
        throw new Error("Selected ARC card is already assigned");
      }
      if (
        targetCardData.currentUserId !== id &&
        targetCardData.status !== "Unattributed"
      ) {
        throw new Error(
          "Selected ARC card must be Unattributed before reassignment",
        );
      }
    }

    const currentCardId = currentCardDoc?.id ?? "";
    const nextCardId = targetCardDoc?.id ?? "";
    const hasCardChange =
      shouldProcessArcCardChange && currentCardId !== nextCardId;

    let openIssueResult: FirebaseFirestore.QuerySnapshot | null = null;
    if (hasCardChange && currentCardDoc) {
      const openIssueQuery = access.db
        .collection("issues")
        .where("cardId", "==", currentCardDoc.id)
        .where("userId", "==", id)
        .where("returnedAt", "==", null)
        .limit(1);
      openIssueResult = await tx.get(openIssueQuery);
    }

    tx.update(recipientRef, {
      ...recipientUpdates,
      updatedAt: nowServerTimestamp,
    });
    if (processedPhoto) {
      tx.set(access.db.collection("user_photos").doc(id), {
        picture: processedPhoto.picture,
        updatedAt: nowServerTimestamp,
      });
    }
    upsertSearchIndexEntry(tx, access.db, id, searchData);

    if (hasCardChange && currentCardDoc) {
      tx.update(currentCardDoc.ref, {
        currentUserId: null,
        status: "Unattributed",
        updatedAt: nowServerTimestamp,
      });
      if (openIssueResult && !openIssueResult.empty) {
        tx.update(openIssueResult.docs[0].ref, {
          returnedAt: nowServerTimestamp,
          closedCardStatus: "Unattributed",
        });
      }
      cardActionNotes.push(
        `Unassigned previous ARC card ${String(currentCardDoc.data().arcCardNumber ?? currentCardDoc.id)}`,
      );
    }

    if (hasCardChange && targetCardDoc) {
      tx.update(targetCardDoc.ref, {
        currentUserId: id,
        status: "Active",
        updatedAt: nowServerTimestamp,
      });
      tx.set(access.db.collection("issues").doc(), {
        cardId: targetCardDoc.id,
        createdAt: nowServerTimestamp,
        issueDate: formatEdmontonDate(nowDate),
        issuedBy: access.uid,
        notes: "Assigned from recipient profile edit",
        returnedAt: null,
        userId: id,
      });
      tx.update(recipientRef, {
        arcCardNumber: requestedArcCardDigits,
        passesIssued: FieldValue.arrayUnion(targetCardDoc.id),
        updatedAt: nowServerTimestamp,
      });
      cardActionNotes.push(
        `Assigned ARC card ${String(targetCardDoc.data().arcCardNumber ?? targetCardDoc.id)}`,
      );
    } else if (hasCardChange && !targetCardDoc) {
      tx.update(recipientRef, {
        arcCardNumber: FieldValue.delete(),
        updatedAt: nowServerTimestamp,
      });
    } else if (
      shouldProcessArcCardChange &&
      !hasCardChange &&
      requestedArcCardDigits
    ) {
      tx.update(recipientRef, {
        arcCardNumber: requestedArcCardDigits,
        updatedAt: nowServerTimestamp,
      });
    }

    tx.create(access.db.collection("history").doc(), {
      date: nowServerTimestamp,
      userId: id,
      modifiedBy: access.uid,
      event: "Profile Update",
      notes: `Updated fields: ${changedFields.join(", ") || "none"}`,
    });
    if (cardActionNotes.length > 0) {
      tx.create(access.db.collection("history").doc(), {
        date: nowServerTimestamp,
        userId: id,
        modifiedBy: access.uid,
        event: "Card Reassignment",
        notes: cardActionNotes.join(" | "),
      });
    }
  });

  return NextResponse.json({ success: true, changedFields });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const access = await getStaffAccess();
  if ("error" in access) {
    return NextResponse.json(
      { error: access.error },
      { status: access.status },
    );
  }

  const { id } = await params;
  const recipientRef = access.db.collection("users").doc(id);
  const recipientSnap = await recipientRef.get();
  if (!recipientSnap.exists) {
    return NextResponse.json({ error: "Recipient not found" }, { status: 404 });
  }

  let body: { action?: unknown; reason?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const action = String(body.action ?? "").toUpperCase() as ManageAction;
  const reason = text(body.reason);

  if (!["FLAG", "UNFLAG", "BAN", "UNBAN", "DELETE"].includes(action)) {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  if (
    (action === "FLAG" ||
      action === "UNFLAG" ||
      action === "BAN" ||
      action === "UNBAN") &&
    reason.length === 0
  ) {
    return NextResponse.json(
      { error: "Reason is required for this action" },
      { status: 400 },
    );
  }

  if (action === "FLAG") {
    const batch = access.db.batch();
    batch.update(recipientRef, {
      flagged: true,
      flagReason: reason,
      updatedAt: FieldValue.serverTimestamp(),
    });
    batch.create(access.db.collection("history").doc(), {
      date: FieldValue.serverTimestamp(),
      userId: id,
      modifiedBy: access.uid,
      event: "Recipient Flagged",
      notes: reason,
      reason,
    });
    await batch.commit();
    return NextResponse.json({ success: true });
  }

  if (action === "UNFLAG") {
    const batch = access.db.batch();
    batch.update(recipientRef, {
      flagged: false,
      flagReason: FieldValue.delete(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    batch.create(access.db.collection("history").doc(), {
      date: FieldValue.serverTimestamp(),
      userId: id,
      modifiedBy: access.uid,
      event: "Recipient Unflagged",
      notes: reason,
      reason,
    });
    await batch.commit();
    return NextResponse.json({ success: true });
  }

  if (action === "BAN") {
    const now = FieldValue.serverTimestamp();
    const cardsSnap = await access.db
      .collection("arc_cards")
      .where("currentUserId", "==", id)
      .get();
    const openIssuesSnap = await access.db
      .collection("issues")
      .where("userId", "==", id)
      .where("returnedAt", "==", null)
      .get();

    const batch = access.db.batch();
    const recipientUpdates: Record<string, unknown> = {
      banned: true,
      banReason: reason,
      flagged: false,
      flagReason: FieldValue.delete(),
      arcCardNumber: FieldValue.delete(),
      updatedAt: now,
    };
    const issuedCardIds = cardsSnap.docs.map((d) => d.id);
    if (issuedCardIds.length > 0) {
      recipientUpdates.passesIssued = FieldValue.arrayUnion(...issuedCardIds);
    }
    batch.update(recipientRef, recipientUpdates);
    batch.set(access.db.collection("banned_users").doc(id), {
      userId: id,
      banReason: reason,
      bannedAt: now,
      bannedBy: access.uid,
      notes: reason,
    });
    for (const cardDoc of cardsSnap.docs) {
      batch.update(cardDoc.ref, {
        currentUserId: null,
        status: "Unattributed",
        updatedAt: now,
      });
    }
    for (const issueDoc of openIssuesSnap.docs) {
      batch.update(issueDoc.ref, {
        returnedAt: now,
        closedCardStatus: "Unattributed",
      });
    }
    batch.create(access.db.collection("history").doc(), {
      date: now,
      userId: id,
      modifiedBy: access.uid,
      event: "Recipient Banned",
      notes: reason,
      reason,
    });
    await batch.commit();
    return NextResponse.json({ success: true });
  }

  if (action === "UNBAN") {
    const now = FieldValue.serverTimestamp();
    const bannedDocsSnap = await access.db
      .collection("banned_users")
      .where("userId", "==", id)
      .get();
    const batch = access.db.batch();
    batch.update(recipientRef, {
      banned: false,
      banReason: FieldValue.delete(),
      updatedAt: now,
    });
    for (const bannedDoc of bannedDocsSnap.docs) {
      batch.delete(bannedDoc.ref);
    }
    batch.create(access.db.collection("history").doc(), {
      date: now,
      userId: id,
      modifiedBy: access.uid,
      event: "Recipient Unbanned",
      notes: reason,
      reason,
    });
    await batch.commit();
    return NextResponse.json({ success: true });
  }

  const [cardsSnap, issuesSnap, historySnap, bannedSnap] = await Promise.all([
    access.db.collection("arc_cards").where("currentUserId", "==", id).get(),
    access.db.collection("issues").where("userId", "==", id).get(),
    access.db.collection("history").where("userId", "==", id).get(),
    access.db.collection("banned_users").where("userId", "==", id).get(),
  ]);

  const batch = access.db.batch();
  const now = FieldValue.serverTimestamp();
  for (const cardDoc of cardsSnap.docs) {
    batch.update(cardDoc.ref, {
      currentUserId: null,
      status: "Unattributed",
      updatedAt: now,
    });
  }
  for (const issueDoc of issuesSnap.docs) {
    batch.delete(issueDoc.ref);
  }
  for (const historyDoc of historySnap.docs) {
    batch.delete(historyDoc.ref);
  }
  for (const bannedDoc of bannedSnap.docs) {
    batch.delete(bannedDoc.ref);
  }
  batch.delete(access.db.collection("user_photos").doc(id));
  deleteSearchIndexEntry(batch, access.db, id);
  batch.delete(recipientRef);
  await batch.commit();

  try {
    await access.app.auth().deleteUser(id);
  } catch (error: unknown) {
    const code = (error as { code?: string } | null)?.code;
    if (code !== "auth/user-not-found") {
      console.error("Failed deleting auth user for recipient:", error);
    }
  }

  return NextResponse.json({ success: true });
}
