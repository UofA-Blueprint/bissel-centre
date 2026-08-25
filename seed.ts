import * as admin from 'firebase-admin';
import serviceAccount from './serviceAccountKey.json';

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
});

const db = admin.firestore();

interface UserProfile {
  firstName: string;
  secondName: string;
  picture: string;
  genderIdentity: string;
  aliases: string[];
  dateOfBirth: string;
  arcCardNumber: string;
  address: string;
  postalCode: string;
  passesIssued: string[];
  banned: boolean;
  banReason: string;
  notes: string;
  status: string;
  createdAt: admin.firestore.FieldValue;
  createdBy: string;
  updatedAt: admin.firestore.FieldValue;
  email: string;
  phone: string | null;
}

async function seedUsers(staffId1: string, staffId2: string, staffId3: string) {
  const user1: UserProfile = {
    firstName: "Alice",
    secondName: "Smith",
    picture: "https://example.com/alice.jpg",
    genderIdentity: "female",
    aliases: ["Ally", "Alle", "Al"],
    dateOfBirth: "1990-01-01",
    arcCardNumber: "1234567",
    address: "123 Main St",
    postalCode: "A1B2C3",
    passesIssued: [],
    banned: false,
    banReason: "",
    notes: "Test user",
    status: "Active",
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    createdBy: staffId1,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    email: "alice@example.com",
    phone: null,
  };
  const user2: UserProfile = {
    firstName: "Jared",
    secondName: "D",
    picture: "https://example.com/jared.jpg",
    genderIdentity: "male",
    aliases: ["Jackal"],
    dateOfBirth: "2000-01-01",
    arcCardNumber: "",
    address: "123 Strathcona St",
    postalCode: "T1B2C3",
    passesIssued: [],
    banned: true,
    banReason: "Violation of program terms",
    notes: "Test user 2",
    status: "Inactive",
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    createdBy: staffId3,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    email: "jared@example.com",
    phone: null,
  };

  try {
    const docRef1 = await db.collection('users').add(user1);
    console.log("User1 seeded with ID:", docRef1.id);
    const docRef2 = await db.collection('users').add(user2);
    console.log("User2 seeded with ID:", docRef2.id);
    return { id1: docRef1.id, id2: docRef2.id };
  } catch (error) {
    console.error("Error seeding users:", error);
    throw error;
  }
}

async function seedArcCards(userId1: string, userId2: string) {
  const arcCard1 = {
    currentUserId: userId1,
    allocationDate: "2023-01-01",
    department: "Transit Dept",
    arcCardNumber: "1234567",
    securityCode: "ABC123",
    status: "Active",
    notes: "",
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };
  const arcCard2 = {
    currentUserId: null,
    allocationDate: "2023-01-01",
    department: "Comp Eng Dept",
    arcCardNumber: "2234567",
    securityCode: "213",
    status: "Unattributed",
    notes: "",
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };
  const arcCard3 = {
    currentUserId: null,
    allocationDate: "2023-01-01",
    department: "Comp Eng Dept",
    arcCardNumber: "3334567",
    securityCode: "321",
    status: "Expired",
    notes: "",
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  try {
    const docRef1 = await db.collection('arc_cards').add(arcCard1);
    console.log("ARC card 1 seeded with ID:", docRef1.id);
    const docRef2 = await db.collection('arc_cards').add(arcCard2);
    console.log("ARC card 2 seeded with ID:", docRef2.id);
    const docRef3 = await db.collection('arc_cards').add(arcCard3);
    console.log("ARC card 3 seeded with ID:", docRef3.id);
    return { card1: docRef1.id, card2: docRef2.id, card3: docRef3.id };
  } catch (error) {
    console.error("Error seeding ARC cards:", error);
    throw error;
  }
}

async function seedIssues(cardId: string, userId: string, staffId: string) {
  const issue = {
    cardId,
    userId,
    issueDate: "2023-01-15",
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    issuedBy: staffId,
    notes: "",
    returnedAt: null,
  };

  try {
    const docRef = await db.collection('issues').add(issue);
    console.log("Issue seeded with ID:", docRef.id);
  } catch (error) {
    console.error("Error seeding issue:", error);
    throw error;
  }
}

async function seedBannedUsers(userId: string, staffId: string) {
  const bannedUser = {
    userId,
    banReason: "Violation of program terms",
    bannedAt: admin.firestore.FieldValue.serverTimestamp(),
    bannedBy: staffId,
    notes: "Banned during test seeding",
  };

  try {
    const docRef = await db.collection('banned_users').add(bannedUser);
    console.log("Banned user seeded with ID:", docRef.id);
  } catch (error) {
    console.error("Error seeding banned user:", error);
    throw error;
  }
}

async function seedAdministrativeStaff(itAdminUid: string) {
  // Staff records use Firebase Auth UID as doc ID in production.
  // For seeding, we generate placeholder UIDs. In real usage, these
  // are created by the register-staff API which creates an Auth user first.
  const staff1 = {
    email: "staff1@example.com",
    firstName: "Tim",
    lastName: "Cook",
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    createdBy: itAdminUid,
    onboardingStatus: "active",
    accountStatus: "active",
    isDeleted: false,
  };
  const staff2 = {
    email: "staff2@example.com",
    firstName: "Melinda",
    lastName: "Gates",
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    createdBy: itAdminUid,
    onboardingStatus: "active",
    accountStatus: "active",
    isDeleted: false,
  };
  const staff3 = {
    email: "staff3@example.com",
    firstName: "Larry",
    lastName: "Davis",
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    createdBy: itAdminUid,
    onboardingStatus: "invited",
    accountStatus: "active",
    isDeleted: false,
  };

  try {
    const docRef1 = await db.collection('administrative_staff').add(staff1);
    console.log("Staff 1 seeded with ID:", docRef1.id);
    const docRef2 = await db.collection('administrative_staff').add(staff2);
    console.log("Staff 2 seeded with ID:", docRef2.id);
    const docRef3 = await db.collection('administrative_staff').add(staff3);
    console.log("Staff 3 seeded with ID:", docRef3.id);
    return { id1: docRef1.id, id2: docRef2.id, id3: docRef3.id };
  } catch (error) {
    console.error("Error seeding administrative staff:", error);
    throw error;
  }
}

async function seedHistory(userId: string, staffId: string) {
  const entry = {
    date: admin.firestore.FieldValue.serverTimestamp(),
    userId,
    modifiedBy: staffId,
    event: "Ban",
    notes: "User banned: Violation of program terms",
  };

  try {
    const docRef = await db.collection('history').add(entry);
    console.log("History seeded with ID:", docRef.id);
  } catch (error) {
    console.error("Error seeding history:", error);
    throw error;
  }
}

async function seedQuestions(userId: string) {
  const entry = {
    userId,
    questions: [
      "Where is this community member in their journey to sustainable and affordable transit?",
      "Please indicate the MOST COMMON reason the recipient used a bus pass last month",
      "Please indicate the SECOND MOST COMMON reason the recipient used a bus pass last month",
      "Please indicate the MOST COMMON housing option the recipient used last month",
    ],
    answers: ["Stabilizing", "Work", "Medical", "Sheltered"],
  };

  try {
    const docRef = await db.collection('questions').add(entry);
    console.log("Questions seeded with ID:", docRef.id);
  } catch (error) {
    console.error("Error seeding questions:", error);
    throw error;
  }
}

async function seedMigrationMarker() {
  try {
    await db.collection('_migrations').doc('issues_v1').set({
      migratedAt: admin.firestore.FieldValue.serverTimestamp(),
      description: "Migrated card issuance history to issues collection",
    });
    console.log("Migration marker seeded: _migrations/issues_v1");
  } catch (error) {
    console.error("Error seeding migration marker:", error);
    throw error;
  }
}

async function runSeeds() {
  console.log("Starting seed...\n");

  // 1. Seed administrative staff (IT admin UID is a placeholder for seed)
  const itAdminUid = "seed-it-admin-placeholder";
  const staffIds = await seedAdministrativeStaff(itAdminUid);

  // 2. Seed recipient users
  const userIds = await seedUsers(staffIds.id1, staffIds.id2, staffIds.id3);

  // 3. Seed ARC cards
  const cardIds = await seedArcCards(userIds.id1, userIds.id2);

  // 4. Seed issues (card 1 -> user 1, issued by staff 1)
  await seedIssues(cardIds.card1, userIds.id1, staffIds.id1);

  // 5. Seed banned user (user 2, banned by staff 2)
  await seedBannedUsers(userIds.id2, staffIds.id2);

  // 6. Seed history
  await seedHistory(userIds.id2, staffIds.id2);

  // 7. Seed questions
  await seedQuestions(userIds.id1);

  // 8. Write migration marker so the app uses the issues collection
  await seedMigrationMarker();

  // 9. Update user 2's passesIssued with the expired card
  await db.collection('users').doc(userIds.id2).update({
    passesIssued: [cardIds.card3],
  });

  console.log("\nSeeding complete.");
  process.exit(0);
}

runSeeds();
