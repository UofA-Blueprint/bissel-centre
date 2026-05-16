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
  currentUserId?: string | null;
  allocationDate: string;
  department: string;
  arcCardNumber: string;
  securityCode: string;
  status: "Active" | "Unattributed" | "Expired" | "Unloaded" | "Cancelled";
  monthsRemaining?: number;
  issuedAt?: Date | string | null;
}

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

export async function getArcCardsByUserId(userId: string): Promise<ArcCard[]> {
  try {
    const q = query(
      collection(db, "arc_cards"),
      where("currentUserId", "==", userId),
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

export async function getAvailableArcCards(): Promise<ArcCard[]> {
  try {
    const q = query(
      collection(db, "arc_cards"),
      where("status", "==", "Unattributed"),
      where("currentUserId", "==", null),
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
