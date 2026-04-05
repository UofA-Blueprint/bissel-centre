import { db } from "./firebase";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
} from "firebase/firestore";

export interface ArcCard {
  id: string;
  userId: string | null; // null = Unattributed card
  allocationDate: string;
  department: string;
  arcCardNumber: string;
  securityCode: string;
  status: "Active" | "Unattributed" | "Expired" | "Unloaded";
  monthsRemaining: number;
  issuedAt?: Date | string | null;
}

// Get a single ARC Card by ID
export async function getArcCardById(id: string): Promise<ArcCard | null> {
  try {
    const ref = doc(db, "arc_cards", id);
    const snapshot = await getDoc(ref);

    if (!snapshot.exists()) return null;

    const data = snapshot.data();

    return {
      id: snapshot.id,
      ...data,
      issuedAt: data.issuedAt?.toDate?.() || data.issuedAt || null,
    } as ArcCard;
  } catch (err) {
    console.error("Error retrieving ARC card:", err);
    throw err;
  }
}

// Get ARC Cards belonging to a specific user
export async function getArcCardsByUserId(userId: string): Promise<ArcCard[]> {
  try {
    const q = query(
      collection(db, "arc_cards"),
      where("userId", "==", userId)
    );

    const snapshot = await getDocs(q);

    return snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        issuedAt: data.issuedAt?.toDate?.() || data.issuedAt || null,
      } as ArcCard;
    });
  } catch (err) {
    console.error("Error retrieving ARC cards for user:", err);
    throw err;
  }
}

// Get available (unattributed) ARC cards that can be issued to a user
export async function getAvailableArcCards(): Promise<ArcCard[]> {
  try {
    const q = query(
      collection(db, "arc_cards"),
      where("status", "==", "Unattributed")
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        issuedAt: data.issuedAt?.toDate?.() || data.issuedAt || null,
      } as ArcCard;
    });
  } catch (err) {
    console.error("Error retrieving available ARC cards:", err);
    throw err;
  }
}

// Get ALL ARC Cards in the system
export async function getAllArcCards(): Promise<ArcCard[]> {
  try {
    const ref = collection(db, "arc_cards");
    const snapshot = await getDocs(ref);

    return snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        issuedAt: data.issuedAt?.toDate?.() || data.issuedAt || null,
      } as ArcCard;
    });
  } catch (err) {
    console.error("Error retrieving all ARC cards:", err);
    throw err;
  }
}
