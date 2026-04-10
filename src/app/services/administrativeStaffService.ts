import { db } from "./firebase";
import { collection, getDocs, doc, getDoc, deleteDoc } from "firebase/firestore";

export interface AdministrativeStaff {
  id: string;
  createdAt: Date; 
  createdBy: string;
  email: string;
  firstName: string;
  secondName: string;
}

const COLLECTION = "administrative_staff";

export async function getAllAdministrativeStaff(): Promise<AdministrativeStaff[]> {
  const ref = collection(db, COLLECTION);
  const snapshot = await getDocs(ref);

  return snapshot.docs.map((d) => {
    const data = d.data();

    return {
      id: d.id,
      createdAt: data.createdAt?.toDate() ?? null,
      createdBy: data.createdBy ?? "",
      email: data.email ?? "",
      firstName: data.firstName ?? "",
      secondName: data.secondName ?? ""
    };
  });
}

export async function getAdministrativeStaffById(id: string): Promise<AdministrativeStaff | null> {
  const ref = doc(db, COLLECTION, id);
  const snapshot = await getDoc(ref);

  if (!snapshot.exists()) return null;

  const data = snapshot.data();

  return {
    id: snapshot.id,
    createdAt: data.createdAt?.toDate() ?? null,
    createdBy: data.createdBy ?? "",
    email: data.email ?? "",
    firstName: data.firstName ?? "",
    secondName: data.lastName ?? ""
  };
}

export async function deleteAdministrativeStaffById(id: string): Promise<void> {
  try {
    const ref = doc(db, COLLECTION, id);
    await deleteDoc(ref);
  } catch (error) {
    console.error("Error deleting administrative staff:", error);
    throw error;
  }
}