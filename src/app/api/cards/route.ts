"use server";

import { NextRequest, NextResponse } from "next/server";
import { initAdmin } from "@/app/services/firebaseAdmin";
import admin from "firebase-admin";
import { ArcCard, ArcCardInput } from "@/app/cards/types";
import { cookies } from "next/headers";

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

// GET /api/cards - Fetch all cards
export async function GET() {
  try {
    const access = await verifyStaffAccess();
    if ("error" in access) {
      return access.error;
    }
    const { db } = access;

    const cardsSnapshot = await db.collection("arc_cards").get();

    // Check if migration has been run by looking for issues collection
    const migrationDoc = await db.collection("_migrations").doc("issues_v1").get();
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
      const userNames = new Map<string, string>();
      for (const userId of userIds) {
        try {
          const userDoc = await db.collection("users").doc(userId).get();
          if (userDoc.exists) {
            const userData = userDoc.data();
            userNames.set(userId, `${userData?.firstName || ""} ${userData?.secondName || ""}`.trim());
          }
        } catch {
          // User not found
        }
      }

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
      for (const doc of cardsSnapshot.docs) {
        const data = doc.data();
        
        let passRecipient = data.passRecipient || "";
        if (data.userId && !passRecipient) {
          try {
            const userDoc = await db.collection("users").doc(data.userId).get();
            if (userDoc.exists) {
              const userData = userDoc.data();
              passRecipient = `${userData?.firstName || ""} ${userData?.secondName || ""}`.trim();
            }
          } catch {
            // User not found
          }
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
      const newCard = {
        currentUserId: cardInput.currentUserId || null,
        allocationDate: cardInput.allocationDate,
        status: cardInput.status,
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
