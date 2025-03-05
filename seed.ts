import * as admin from 'firebase-admin';
import * as path from 'path';

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
  createdAt: admin.firestore.FieldValue;
  createdBy: string;
  updatedAt: admin.firestore.FieldValue;
}

async function seedUsers(id1: string, id2: string, id3: string) {
  const user: UserProfile = {
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
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    createdBy: id1,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };
  const user2: UserProfile = {
    firstName: "Jared",
    secondName: "D",
    picture: "https://example.com/jared.jpg",
    genderIdentity: "male",
    aliases: ["Jackal"],
    dateOfBirth: "2025-01-01",
    arcCardNumber: "2234567",
    address: "123 Strathcona St",
    postalCode: "T1B2C3",
    passesIssued: ["3334567"],
    banned: true,
    banReason: "is actually rich. can afford their own arc card",
    notes: "Test user 2",
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    createdBy: id3,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };
  
  try {
    const docRef1 = await db.collection('users').add(user);
    console.log("User1 seeded with ID:", docRef1.id);
    const docRef2 = await db.collection('users').add(user2)
    console.log("User2 seeded with ID:", docRef2.id);
    return {id1: docRef1.id, id2: docRef2.id}
  } catch (error) {
    console.error("Error seeding user:", error);
  }
  
}

async function seedArcCards(id1: string, id2: string) {
  const arcCard1 = {
    userId: id1,
    allocationDate: "2023-01-01",
    department: "Transit Dept",
    arcCardNumber: "1234567",
    securityCode: "ABC123",
    status: "Active",
    monthsRemaining: 3,
    issuedAt: admin.firestore.FieldValue.serverTimestamp(),
  };
  const arcCard2 = {
    userId: id2,
    allocationDate: "2023-01-01",
    department: "Comp Eng Dept",
    arcCardNumber: "2234567",
    securityCode: "213",
    status: "Active",
    monthsRemaining: 3,
    issuedAt: admin.firestore.FieldValue.serverTimestamp(),
  };
  const arcCard3 = {
    userId: id2,
    allocationDate: "2023-01-01",
    department: "Comp Eng Dept",
    arcCardNumber: "3334567",
    securityCode: "321",
    status: "Expired",
    monthsRemaining: 0,
    issuedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  try {
    const docRef = await db.collection('arc_cards').add(arcCard1);
    console.log("ARC card 1 seeded with ID:", docRef.id);
    const docRef2 = await db.collection('arc_cards').add(arcCard2);
    console.log("ARC card 2 seeded with ID:", docRef2.id);
    const docRef3 = await db.collection('arc_cards').add(arcCard3);
    console.log("ARC card 3 seeded with ID:", docRef3.id);
  } catch (error) {
    console.error("Error seeding ARC card:", error);
  }

}
async function seedBannedUsers(id1: string, id2: string, asID2: string) {
    const bannedUser1 = {
        userId: id2,
        banReason: "is actually rich. can afford their own arc card",
        bannedAt: admin.firestore.FieldValue.serverTimestamp(),
        bannedBy: asID2,
        notes: "Had to ban him. Others need it more"
    }
    try {
      const docRef = await db.collection('banned_users').add(bannedUser1);
      console.log("Banned User1 seeded with ID:", docRef.id);
    } catch (error) {
      console.error("Error seeding banned user:", error);
    }
  
}

async function seedITAdmin() {
    const itAdmin1 = {
        email: "itadmin@gmail.com",
        hashedIdentificationNumber: "ABC123",
        firstName: "Steve",
        secondName: "Jobs",
        createdAt: admin.firestore.FieldValue.serverTimestamp()
    }
    try {
      const docRef = await db.collection('it_admin').add(itAdmin1);
      console.log("IT Admin 1 seeded with ID:", docRef.id);
      return docRef.id
    } catch (error) {
      console.error("Error seeding banned IT Admin:", error);
    }
  
}

async function seedAS(itAdminID: string) {
    const as1 = {
        email: "appleTV@gmail.com",
        hashedPassword: "popsicleChaiLatte",
        firstName: "Tim",
        secondName: "Cook",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        createdBy: itAdminID
    }
    const as2 = {
        email: "microsoftTeams@gmail.com",
        hashedPassword: "Mcdavid",
        firstName: "Melinda",
        secondName: "Gates",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        createdBy: itAdminID
    }
    const as3 = {
        email: "gMEET@gmail.com",
        hashedPassword: "SouthCampusFortEdmontonPark",
        firstName: "Larry",
        secondName: "Davis",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        createdBy: itAdminID
    }
    try {
      const docRef1 = await db.collection('administrative_staff').add(as1);
      console.log("AS1 seeded with ID:", docRef1.id);
      const docRef2 = await db.collection('administrative_staff').add(as2);
      console.log("AS2 seeded with ID:", docRef2.id);
      const docRef3 = await db.collection('administrative_staff').add(as3);
      console.log("AS3 seeded with ID:", docRef3.id);
      return {id1: docRef1.id, id2: docRef2.id, id3: docRef3.id }
    } catch (error) {
      console.error("Error seeding AS:", error);
    }
  
}


async function seedHistory(userID: string, asID: string) {
    const hist1 = {
        date: admin.firestore.FieldValue.serverTimestamp(),
        userId: userID,
        modifiedBy: asID,
        event: "Ban",
        notes: ""
    }
    try {
      const docRef = await db.collection('history').add(hist1);
      console.log("History seeded with ID:", docRef.id);
    } catch (error) {
      console.error("Error seeding AS:", error);
    }
  
}

async function seedQuestions(userID1: string) {
    const questions1 = {
        userId: userID1,
        questions: ["Where is this community member in their journey to sustainable and affordable transit?", "Please indicate the MOST COMMON reason the recipient used a bus pass last month", "Please indicate the SECOND MOST COMMON reason the recipient used a bus pass last month", "Please indicate the MOST COMMON housing option the recipient used last month"],
        answers: ["beep", "boop", "boo", "oop"]
    }
    try {
      const docRef = await db.collection('questions').add(questions1);
      console.log("Question seeded with ID:", docRef.id);
    } catch (error) {
      console.error("Error seeding AS:", error);
    }
  
}

async function runSeeds() {
  const adminID = await seedITAdmin();
  const asID = await seedAS(adminID!);
  const asID1 = asID!['id1']
  const asID2 = asID!['id2']
  const asID3 = asID!['id3']
  const idObj = await seedUsers(asID1, asID2, asID3);
  const id1 = idObj!['id1']
  const id2 = idObj!['id2']
  await seedArcCards(id1, id2);
  await seedBannedUsers(id1, id2, asID2);
  await seedHistory(id2, asID2)
  await seedQuestions(id1)
  // Add similar functions to seed banned_users, administrative_staff, it_admin, history, and questions
  console.log("Seeding complete.");
  process.exit(0);
}

runSeeds();
