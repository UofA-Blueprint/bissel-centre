"use server";

import { NextRequest, NextResponse } from "next/server";
import { initAdmin } from "@/app/services/firebaseAdmin";
import admin from "firebase-admin";

export type CardStatus =
  | "Active"
  | "Unattributed"
  | "Expired"
  | "Unloaded"
  | "Cancelled";

export type CardDepartment =
  | "Mental Health"
  | "Emergency"
  | "Case MCT"
  | "Newcomer Volunteer"
  | "Reception"
  | "Housing"
  | "FE/Comm Bridge"
  | "FASS"
  | "Child Care"
  | "Employment"
  | "HELP Program";

export interface ArcCard {
  id: string;
  userId?: string;
  allocationDate: string;
  status: CardStatus;
  department: CardDepartment;
  arcCardNumber: string; // final7Digits in UI
  securityCode: string;
  passRecipient: string;
  issueDates: string[];
  notes: string;
  createdAt?: admin.firestore.Timestamp;
  updatedAt?: admin.firestore.Timestamp;
}

export interface ArcCardInput {
  userId?: string;
  allocationDate: string;
  status: CardStatus;
  department: CardDepartment;
  arcCardNumber: string;
  securityCode: string;
  passRecipient?: string;
  issueDates?: string[];
  notes?: string;
}
// GET /api/cards - Fetch all cards
export async function GET() {
  try {
    const app = await initAdmin();
    const db = app.firestore();
    const cardsSnapshot_ = await db.collection("arc_cards").get();
    console.log("Fetched cards snapshot:", cardsSnapshot_.docs.map(doc => ({ id: doc.id, data: doc.data() })));
    const cardsSnapshot = await db
      .collection("arc_cards")
      .orderBy("issuedAt", "desc")
      .get();

    const cards: ArcCard[] = [];

    for (const doc of cardsSnapshot.docs) {
      const data = doc.data();
      
      // If there's a userId, fetch the user's name for passRecipient
      let passRecipient = data.passRecipient || "";
      if (data.userId && !passRecipient) {
        try {
          const userDoc = await db.collection("users").doc(data.userId).get();
          if (userDoc.exists) {
            const userData = userDoc.data();
            passRecipient = `${userData?.firstName || ""} ${userData?.secondName || ""}`.trim();
          }
        } catch {
            console.log(`User with ID ${data.userId} not found for card ${doc.id}`);
          // User not found, keep empty recipient
        }
      }

      cards.push({
        id: doc.id,
        userId: data.userId || "",
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
    const app = await initAdmin();
    const db = app.firestore();

    const body = await request.json();
    const cardsToCreate: ArcCardInput[] = Array.isArray(body.cards)
      ? body.cards
      : [body];

    const createdCards: ArcCard[] = [];

    for (const cardInput of cardsToCreate) {
      const newCard = {
        userId: cardInput.userId || "",
        allocationDate: cardInput.allocationDate,
        status: cardInput.status,
        department: cardInput.department,
        arcCardNumber: cardInput.arcCardNumber,
        securityCode: cardInput.securityCode,
        passRecipient: cardInput.passRecipient || "",
        issueDates: cardInput.issueDates || [cardInput.allocationDate],
        notes: cardInput.notes || "",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      const docRef = await db.collection("arc_cards").add(newCard);
      
      createdCards.push({
        id: docRef.id,
        ...newCard,
        createdAt: undefined,
        updatedAt: undefined,
      } as ArcCard);
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
