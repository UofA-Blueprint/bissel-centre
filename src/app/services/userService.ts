import { db } from "./firebase";
import {
  doc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
  updateDoc,
  deleteDoc,
  addDoc,
  Timestamp,
} from "firebase/firestore";

export interface User {
  id: string;
  firstName: string;
  secondName: string;
  picture?: string;
  genderIdentity: string;
  aliases: string[];
  dateOfBirth: string;
  arcCardNumber?: string;
  address: string;
  postalCode: string;
  passesIssued: string[];
  banned: boolean;
  banReason?: string;
  notes?: string;
  status?: "Active" | "Inactive"; // Account status (different from banned)
  createdAt: Date | string;
  createdBy: string;
  updatedAt?: Date | string;
  email?: string;
  phoneNumber?: string;
}

export interface ArcCard {
  id: string;
  userId: string;
  allocationDate: string;
  department: string;
  arcCardNumber: string;
  securityCode: string;
  status: "Active" | "Unattributed" | "Expired" | "Unloaded";
  monthsRemaining: number;
  issuedAt: Date;
}

export interface HistoryEntry {
  id: string;
  date: Date;
  userId: string;
  modifiedBy: string;
  event: string;
  notes: string;
  reason?: string; // For override reasons
}

export interface BannedUser {
  id: string;
  userId: string;
  banReason: string;
  bannedAt: Date;
  bannedBy: string;
  notes: string;
}

// Fetch user by ID
export async function getUserById(userId: string): Promise<User | null> {
  try {
    const userDoc = await getDoc(doc(db, "users", userId));
    if (userDoc.exists()) {
      const userData = userDoc.data();
      return {
        id: userDoc.id,
        ...userData,
        createdAt: userData.createdAt?.toDate?.() || userData.createdAt,
        updatedAt: userData.updatedAt?.toDate?.() || userData.updatedAt,
      } as User;
    }
    return null;
  } catch (error) {
    console.error("Error fetching user:", error);
    throw error;
  }
}

// Fetch ARC cards for a user
export async function getArcCardsByUserId(userId: string): Promise<ArcCard[]> {
  try {
    // Temporarily removed orderBy to avoid index requirement
    // TODO: Create Firebase composite index, then restore: orderBy("issuedAt", "desc")
    const q = query(collection(db, "arc_cards"), where("userId", "==", userId));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      issuedAt: doc.data().issuedAt?.toDate?.() || doc.data().issuedAt,
    })) as ArcCard[];
  } catch (error) {
    console.error("Error fetching ARC cards:", error);
    throw error;
  }
}

// Fetch history for a user
export async function getHistoryByUserId(
  userId: string
): Promise<HistoryEntry[]> {
  try {
    // Temporarily removed orderBy to avoid index requirement
    // TODO: Create Firebase composite index, then restore: orderBy("date", "desc")
    const q = query(collection(db, "history"), where("userId", "==", userId));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      date: doc.data().date?.toDate?.() || doc.data().date,
    })) as HistoryEntry[];
  } catch (error) {
    console.error("Error fetching history:", error);
    throw error;
  }
}

// Check if user is banned
export async function getBannedUserInfo(
  userId: string
): Promise<BannedUser | null> {
  try {
    const q = query(
      collection(db, "banned_users"),
      where("userId", "==", userId)
    );
    const querySnapshot = await getDocs(q);
    if (!querySnapshot.empty) {
      const doc = querySnapshot.docs[0];
      return {
        id: doc.id,
        ...doc.data(),
        bannedAt: doc.data().bannedAt?.toDate?.() || doc.data().bannedAt,
      } as BannedUser;
    }
    return null;
  } catch (error) {
    console.error("Error fetching banned user info:", error);
    throw error;
  }
}

// Update user
export async function updateUser(
  userId: string,
  userData: Partial<User>
): Promise<void> {
  try {
    const userRef = doc(db, "users", userId);
    await updateDoc(userRef, {
      ...userData,
      updatedAt: Timestamp.now(),
    });
  } catch (error) {
    console.error("Error updating user:", error);
    throw error;
  }
}

// Ban user
export async function banUser(
  userId: string,
  banReason: string,
  bannedBy: string,
  notes: string
): Promise<void> {
  try {
    // Update user's banned status
    await updateUser(userId, { banned: true, banReason });

    // Add to banned_users collection
    await addDoc(collection(db, "banned_users"), {
      userId,
      banReason,
      bannedAt: Timestamp.now(),
      bannedBy,
      notes,
    });

    // Add to history
    await addDoc(collection(db, "history"), {
      date: Timestamp.now(),
      userId,
      modifiedBy: bannedBy,
      event: "Ban",
      notes: `User banned: ${banReason}`,
    });
  } catch (error) {
    console.error("Error banning user:", error);
    throw error;
  }
}

// Unban user
export async function unbanUser(
  userId: string,
  unbannedBy: string
): Promise<void> {
  try {
    // Update user's banned status
    await updateUser(userId, { banned: false, banReason: "" });

    // Remove from banned_users collection
    const q = query(
      collection(db, "banned_users"),
      where("userId", "==", userId)
    );
    const querySnapshot = await getDocs(q);
    querySnapshot.docs.forEach(async (docSnapshot) => {
      await deleteDoc(doc(db, "banned_users", docSnapshot.id));
    });

    // Add to history
    await addDoc(collection(db, "history"), {
      date: Timestamp.now(),
      userId,
      modifiedBy: unbannedBy,
      event: "Unban",
      notes: "User unbanned",
    });
  } catch (error) {
    console.error("Error unbanning user:", error);
    throw error;
  }
}

// Issue new ARC card
export async function issueNewArcCard(
  userId: string,
  arcCardNumber: string,
  department: string,
  issuedBy: string,
  override?: { reason: string }
): Promise<void> {
  try {
    // Add new ARC card
    await addDoc(collection(db, "arc_cards"), {
      userId,
      allocationDate: new Date().toISOString().split("T")[0],
      department,
      arcCardNumber,
      securityCode: Math.random().toString(36).substring(2, 8).toUpperCase(),
      status: "Active",
      monthsRemaining: 3,
      issuedAt: Timestamp.now(),
    });

    // Update user's arcCardNumber
    await updateUser(userId, { arcCardNumber });

    // Add to history
    const eventNote = override
      ? `New ARC card issued (Override: ${override.reason})`
      : "New ARC card issued";

    await addDoc(collection(db, "history"), {
      date: Timestamp.now(),
      userId,
      modifiedBy: issuedBy,
      event: override ? "Override" : "Issue Card",
      notes: eventNote,
      ...(override && { reason: override.reason }),
    });
  } catch (error) {
    console.error("Error issuing new ARC card:", error);
    throw error;
  }
}

// Renew ARC card
export async function renewArcCard(
  userId: string,
  arcCardId: string,
  renewedBy: string,
  override?: { reason: string }
): Promise<void> {
  try {
    // Update ARC card months
    const arcCardRef = doc(db, "arc_cards", arcCardId);
    await updateDoc(arcCardRef, {
      monthsRemaining: 3,
      status: "Active",
    });

    // Add to history
    const eventNote = override
      ? `ARC card renewed (Override: ${override.reason})`
      : "ARC card renewed";

    await addDoc(collection(db, "history"), {
      date: Timestamp.now(),
      userId,
      modifiedBy: renewedBy,
      event: override ? "Override" : "Renew Card",
      notes: eventNote,
      ...(override && { reason: override.reason }),
    });
  } catch (error) {
    console.error("Error renewing ARC card:", error);
    throw error;
  }
}

// Update user status
export async function updateUserStatus(
  userId: string,
  status: "Active" | "Inactive",
  modifiedBy: string
): Promise<void> {
  try {
    // Update user's status
    await updateUser(userId, { status });

    // Add to history
    await addDoc(collection(db, "history"), {
      date: Timestamp.now(),
      userId,
      modifiedBy,
      event: "Status Change",
      notes: `Account status changed to ${status}`,
    });
  } catch (error) {
    console.error("Error updating user status:", error);
    throw error;
  }
}

// Delete user
export async function deleteUser(
  userId: string,
  deletedBy: string
): Promise<void> {
  try {
    // Delete user document
    await deleteDoc(doc(db, "users", userId));

    // Clean up related documents
    const arcCardsQuery = query(
      collection(db, "arc_cards"),
      where("userId", "==", userId)
    );
    const bannedUsersQuery = query(
      collection(db, "banned_users"),
      where("userId", "==", userId)
    );
    const historyQuery = query(
      collection(db, "history"),
      where("userId", "==", userId)
    );
    const questionsQuery = query(
      collection(db, "questions"),
      where("userId", "==", userId)
    );

    const [arcCards, bannedUsers, history, questions] = await Promise.all([
      getDocs(arcCardsQuery),
      getDocs(bannedUsersQuery),
      getDocs(historyQuery),
      getDocs(questionsQuery),
    ]);

    const deletePromises = [
      ...arcCards.docs.map((doc) => deleteDoc(doc.ref)),
      ...bannedUsers.docs.map((doc) => deleteDoc(doc.ref)),
      ...history.docs.map((doc) => deleteDoc(doc.ref)),
      ...questions.docs.map((doc) => deleteDoc(doc.ref)),
    ];

    await Promise.all(deletePromises);
  } catch (error) {
    console.error("Error deleting user:", error);
    throw error;
  }
}
