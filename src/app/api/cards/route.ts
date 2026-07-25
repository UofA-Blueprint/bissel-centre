"use server";

import { NextRequest, NextResponse } from "next/server";
import { initAdmin } from "@/app/services/firebaseAdmin";
import admin from "firebase-admin";
import { ArcCard, ArcCardInput } from "@/app/(app)/cards/types";
import { cookies } from "next/headers";
import { expireOverdueArcCards } from "@/app/services/cardExpiryService";

async function verifyStaffAccess() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("session")?.value;

  if (!sessionCookie) {
    return {
      error: NextResponse.json({ error: "Unauthorized - No session found" }, { status: 401 }),
    };
  }

  const app = await initAdmin();
  const decodedClaims = await app.auth().verifySessionCookie(sessionCookie, true);

  // IT Admins are intentionally restricted from staff cards access.
  if (decodedClaims.admin === true) {
    return {
      error: NextResponse.json(
        { error: "Forbidden - Staff access only" },
        { status: 403 }
      ),
    };
  }

  const db = app.firestore();
  const staffDoc = await db.collection("administrative_staff").doc(decodedClaims.uid).get();

  if (!staffDoc.exists) {
    return {
      error: NextResponse.json(
        { error: "Forbidden - Staff access only" },
        { status: 403 }
      ),
    };
  }

  return { app, db };
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
}

async function fetchUserNamesByIds(
  db: admin.firestore.Firestore,
  userIds: Iterable<string>,
): Promise<Map<string, string>> {
  const ids = Array.from(new Set(Array.from(userIds).filter(Boolean)));
  const result = new Map<string, string>();
  if (ids.length === 0) return result;

  // Firestore "in" query supports a small bounded list per query; chunk safely.
  const idChunks = chunk(ids, 10);
  await Promise.all(
    idChunks.map(async (idsPart) => {
      const snap = await db
        .collection("users")
        .where(admin.firestore.FieldPath.documentId(), "in", idsPart)
        .select("firstName", "secondName")
        .get();

      for (const doc of snap.docs) {
        const data = doc.data() as { firstName?: string; secondName?: string };
        result.set(
          doc.id,
          `${data.firstName || ""} ${data.secondName || ""}`.trim(),
        );
      }
    }),
  );

  return result;
}

// GET /api/cards - Fetch all cards
export async function GET() {
  try {
    const access = await verifyStaffAccess();
    if ("error" in access) {
      return access.error;
    }
    const { db } = access;

    // Do not block cards response on maintenance.
    void expireOverdueArcCards(db).catch((expiryError) => {
      console.error("Card expiry sync failed:", expiryError);
    });

    const [cardsSnapshot, migrationDoc] = await Promise.all([
      db.collection("arc_cards").get(),
      // Check if migration has been run by looking for issues collection
      db.collection("_migrations").doc("issues_v1").get(),
    ]);
    const isMigrated = migrationDoc.exists;

    const cards: ArcCard[] = [];

    if (isMigrated) {
      // Post-migration: fetch issues to derive passRecipient and issueDates
      const issuesSnapshot = await db.collection("issues").get();
      
      // Group issues by cardId
      const issuesByCard = new Map<string, Array<{ userId: string; issueDate: string; returnedAt: unknown }>>();
      for (const issueDoc of issuesSnapshot.docs) {
        const issue = issueDoc.data();
        const cardId = issue.cardId;
        if (!issuesByCard.has(cardId)) {
          issuesByCard.set(cardId, []);
        }
        issuesByCard.get(cardId)!.push({
          userId: issue.userId,
          issueDate: issue.issueDate,
          returnedAt: issue.returnedAt,
        });
      }

      // Collect all userIds we need to fetch
      const userIds = new Set<string>();
      for (const doc of cardsSnapshot.docs) {
        const data = doc.data();
        if (data.currentUserId) userIds.add(data.currentUserId);
      }
      for (const issues of issuesByCard.values()) {
        for (const issue of issues) {
          if (issue.userId) userIds.add(issue.userId);
        }
      }

      // Batch fetch users
      const userNames = await fetchUserNamesByIds(db, userIds);

      for (const doc of cardsSnapshot.docs) {
        const data = doc.data();
        const cardIssues = issuesByCard.get(doc.id) || [];
        
        // Get issue dates sorted by date desc
        const issueDates = cardIssues
          .map(i => i.issueDate)
          .sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

        // Get passRecipient from currentUserId
        const passRecipient = data.currentUserId 
          ? userNames.get(data.currentUserId) || ""
          : "";

        cards.push({
          id: doc.id,
          currentUserId: data.currentUserId || null,
          allocationDate: data.allocationDate || "",
          status: data.status || "Unloaded",
          department: data.department || "Emergency",
          arcCardNumber: data.arcCardNumber || "",
          securityCode: data.securityCode || "",
          passRecipient,
          issueDates,
          notes: data.notes || "",
          createdAt: data.createdAt,
          updatedAt: data.updatedAt,
        });
      }
    } else {
      // Pre-migration: use old schema
      const neededUserIds = new Set<string>();
      for (const doc of cardsSnapshot.docs) {
        const data = doc.data();
        if (data.userId && !data.passRecipient) {
          neededUserIds.add(data.userId);
        }
      }
      const userNames = await fetchUserNamesByIds(db, neededUserIds);

      for (const doc of cardsSnapshot.docs) {
        const data = doc.data();
        
        let passRecipient = data.passRecipient || "";
        if (data.userId && !passRecipient) {
          passRecipient = userNames.get(data.userId) || "";
        }

        cards.push({
          id: doc.id,
          currentUserId: data.userId || null,
          allocationDate: data.allocationDate || "",
          status: data.status || "Unloaded",
          department: data.department || "Emergency",
          arcCardNumber: data.arcCardNumber || "",
          securityCode: data.securityCode || "",
          passRecipient,
          issueDates: data.issueDates || [],
          notes: data.notes || "",
          createdAt: data.createdAt,
          updatedAt: data.updatedAt,
        });
      }
    }

    return NextResponse.json({ cards });
  } catch (error) {
    console.error("Error fetching cards:", error);
    return NextResponse.json(
      { error: "Failed to fetch cards" },
      { status: 500 }
    );
  }
}

// POST /api/cards - Create new card(s)
export async function POST(request: NextRequest) {
  try {
    const access = await verifyStaffAccess();
    if ("error" in access) {
      return access.error;
    }
    const { db } = access;

    const body = await request.json();
    const cardsToCreate: ArcCardInput[] = Array.isArray(body.cards)
      ? body.cards
      : [body];

    // Check if migration has been run
    const createdCards: ArcCard[] = [];
    

    for (const cardInput of cardsToCreate) {
      const status =
        cardInput.status && cardInput.status.trim() !== ""
          ? cardInput.status
          : "Unloaded";

      const newCard = {
        currentUserId: cardInput.currentUserId || null,
        allocationDate: cardInput.allocationDate,
        status,
        department: cardInput.department,
        arcCardNumber: cardInput.arcCardNumber,
        securityCode: cardInput.securityCode,
        notes: cardInput.notes || "",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      const docRef = await db.collection("arc_cards").add(newCard);
      
      // If migrated, card starts with no issues (they get added when issued to someone)
      // The card is created in "Unloaded" state typically
      
      createdCards.push({
        id: docRef.id,
        ...newCard,
        passRecipient: "",
        issueDates: [],
        createdAt: undefined,
        updatedAt: undefined,
      } as unknown as ArcCard);
    }

    return NextResponse.json({ cards: createdCards }, { status: 201 });
  } catch (error) {
    console.error("Error creating card(s):", error);
    return NextResponse.json(
      { error: "Failed to create card(s)" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest){
  try{
    const access = await verifyStaffAccess();
    if ("error" in access){
      return access.error;
    }
    const {db} = access;

    const body = (await request.json()) as {
      id?: string;
      status?: string;
      confirmDangerous?: boolean;
    }

    const {id, status, confirmDangerous = false} = body;

    if (!id || !status){
      return NextResponse.json(
        { error: "Card id and status are required" },
        { status: 400 },
      );
    }

    const allowedStatuses = new Set([
      "Active",
      "Unattributed",
      "Expired",
      "Unloaded",
      "Cancelled",
    ]);

    if (!allowedStatuses.has(status)) {
      return NextResponse.json({ error: "Invalid card status" }, { status: 400 });
    }

    const cardRef = db.collection("arc_cards").doc(id);
    const cardSnap = await cardRef.get();
    if (!cardSnap.exists) {
      return NextResponse.json({ error: "Card not found" }, { status: 404 });
    }
    const cardData = cardSnap.data() as {
      currentUserId?: string | null;
      status?: string;
    };
    const hasHolder = Boolean(cardData.currentUserId);
    const nextStatus = status;
    const reasons: string[] = [];
    if (nextStatus === "Active" && !hasHolder) {
      reasons.push("Setting Active without an assigned recipient.");
    }
    if (nextStatus === "Unattributed" && hasHolder) {
      reasons.push("Setting Unattributed while card is still assigned to a recipient.");
    }
    if (
      (nextStatus === "Unloaded" || nextStatus === "Cancelled") &&
      hasHolder
    ) {
      reasons.push(`Setting ${nextStatus} while card is still assigned.`);
    }
    const isDangerous = reasons.length > 0;
    if (isDangerous && !confirmDangerous) {
      return NextResponse.json(
        {
          error: "Dangerous status change",
          requiresConfirmation: true,
          warning:
            "This status change can create card assignment inconsistencies.",
          reasons,
        },
        { status: 409 },
      );
    }
    await db.runTransaction(async (tx) => {
      const freshCardSnap = await tx.get(cardRef);
      if (!freshCardSnap.exists) {
        throw new Error("Card not found");
      }
    
      const freshCardData = freshCardSnap.data() as {
        currentUserId?: string | null;
      };
    
      const currentUserId = freshCardData.currentUserId ?? null;
    
      const cardUpdates: {
        status: string;
        updatedAt: admin.firestore.FieldValue;
        currentUserId?: null;
      } = {
        status: nextStatus,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };
    
      // Keep card/user mirror fields in sync:
      // any transition away from Active should detach the current holder.
      if (nextStatus !== "Active" && currentUserId) {
        const userRef = db.collection("users").doc(currentUserId);
        const userSnap = await tx.get(userRef);

        // Close any open issue for this card/user so dashboard history-based
        // views no longer treat it as currently active.
        const openIssueQuery = db
          .collection("issues")
          .where("cardId", "==", cardRef.id)
          .where("userId", "==", currentUserId)
          .where("returnedAt", "==", null)
          .limit(1);
        const openIssueSnap = await tx.get(openIssueQuery);

        // All reads above; writes below.
        if (userSnap.exists) {
          tx.update(userRef, {
            arcCardNumber: admin.firestore.FieldValue.delete(),
            passesIssued: admin.firestore.FieldValue.arrayUnion(cardRef.id),
            updatedAt: new Date().toISOString(),
          });
        }

        if (!openIssueSnap.empty) {
          tx.update(openIssueSnap.docs[0].ref, {
            returnedAt: admin.firestore.FieldValue.serverTimestamp(),
            closedCardStatus: nextStatus,
          });
        }

        cardUpdates.currentUserId = null;
      }
    
      tx.update(cardRef, cardUpdates);
    });


  return NextResponse.json({ success: true });
  
  } catch (error) {
    console.error("Error updating card status:", error);
    return NextResponse.json(
      { error: "Failed to update card status" },
      { status: 500 },
    );
  }
}
