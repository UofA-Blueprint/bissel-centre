#!/usr/bin/env node
/**
 * Seed a large, realistic recipient population (~400) mixing average names
 * with the hard cases the search stack must handle: Cree SRO and translated
 * surnames, Blackfoot multi-word surnames, Dene orthography (ł, ogonek,
 * glottal stop), Métis French, Somali orthography variants, Vietnamese
 * stacked diacritics, Polish barred-Ł, apostrophe/casing/spacing variants,
 * Mac/Mc and phonetic clusters, mononyms, and street-name aliases.
 *
 * Deterministic: same ids and data every run (re-running overwrites).
 * All ids share the "nameburst_" prefix for easy removal.
 *
 * Usage:
 *   node scripts/seed-name-explosion.mjs
 *   node scripts/seed-name-explosion.mjs --delete
 *
 * Run scripts/rebuild-search-index.mjs afterwards.
 */

import { getAdmin } from "../tests/stress/lib.mjs";

const DELETE = process.argv.includes("--delete");
const PREFIX = "nameburst_";
const CREATED_BY = "name-explosion";
const TARGET_TOTAL = 400;

// ── Curated hard cases ───────────────────────────────────────────
// [firstName, lastName, aliases?, note]
const CURATED = [
  // Blackfoot multi-word surnames (joined/spaced matching must work)
  ["Adrian", "Born With A Tooth"],
  ["Celina", "Many Guns"],
  ["Dwayne", "Weasel Head"],
  ["Irene", "Running Rabbit"],
  ["Marvin", "Good Striker"],
  ["Theresa", "Big Plume"],
  ["Nathan", "Many Fingers"],
  // Cree translated surnames (Alberta)
  ["Delia", "Yellowbird"],
  ["Wesley", "Makokis"],
  ["Bernice", "Steinhauer"],
  ["Gordon", "Auger"],
  ["Priscilla", "Nepoose"],
  ["Leonard", "Bull"],
  ["Charmaine", "Whitford"],
  ["Vernon", "Crane"],
  ["Flora", "Bird"],
  ["Harvey", "Morin"],
  // Cree SRO given names (circumflex vowels)
  ["Mahihkan", "Gladue"],
  ["Sîsîp", "Desjarlais"],
  ["Askiy", "Belcourt"],
  ["Nîpin", "Loyer"],
  ["Kîsik", "Callihoo"],
  // Métis French (diacritics, apostrophes, particles, hyphens)
  ["Yvonne", "L’Hirondelle"],
  ["Baptiste", "Bruneau"],
  ["Adélaïde", "Beaulieu"],
  ["Jean-Baptiste", "Lafleur"],
  ["Marie-Ange", "St. Arnault"],
  ["Célestine", "Dumont"],
  ["Napoléon", "Delorme"],
  ["Léa", "de Montigny"],
  // Dene orthography (ł, ë, ogonek, glottal stop — NFD can't fold these)
  ["Łucie", "Mantla"],
  ["Dëneze", "Lafferty"],
  ["Sahtú", "Blondin"],
  ["ʔamą́", "Catholique"],
  ["Tsıąba", "Football"],
  // Inuit (one syllabics alias — pass-through case)
  ["Qajaq", "Angulalik"],
  ["Siasi", "Kappianaq", ["ᓯᐊᓯ"]],
  ["Panigusiq", "Akana"],
  // Somali — orthography variants of the same names (Maxamed = Mohamed,
  // Cabdi = Abdi, Xasan = Hassan) plus the Mohamed phonetic cluster
  ["Mohamed", "Hassan"],
  ["Muhammad", "Hussein"],
  ["Mohammed", "Warsame"],
  ["Muhamed", "Farah"],
  ["Maxamed", "Cali"],
  ["Cabdi", "Xasan"],
  ["Khadija", "Aden"],
  ["Fatuma", "Abdi"],
  ["Faduma", "Omar"],
  ["Ayaan", "Ibrahim"],
  ["Hodan", "Yusuf"],
  ["Sagal", "Yousef"],
  // Vietnamese (stacked diacritics; Đ is atomic under NFD)
  ["Hoa", "Nguyễn"],
  ["Minh", "Đặng"],
  ["Lan", "Lê"],
  ["Bảo", "Trần"],
  // Ukrainian / Polish (Edmonton communities; Polish barred-Ł)
  ["Łukasz", "Kowalczyk"],
  ["Oksana", "Shevchenko"],
  ["Bohdan", "Melnyk"],
  ["Zbigniew", "Przybylski"],
  ["Nadiya", "Boychuk"],
  ["Taras", "Andruchow"],
  // Apostrophes (ASCII + Irish diacritics + modifier-apostrophe alias)
  ["Ciarán", "O'Brien"],
  ["Siobhán", "O'Neill"],
  ["Keanu", "D'Souza"],
  ["Aminata", "N'Diaye"],
  ["Joe", "Crowchild", ["Tsuutʼina Joe"]],
  // Mac/Mc/Macdonald casing cluster
  ["Angus", "MacDonald"],
  ["Angela", "McDonald"],
  ["Rory", "Macdonald"],
  // Particles
  ["Sofia", "De La Cruz"],
  ["Hendrik", "Van Der Berg"],
  // Phonetic given-name clusters on shared surnames
  ["Steven", "Gladue"],
  ["Stephen", "Gladue"],
  ["Sean", "Auger"],
  ["Shawn", "Auger"],
  ["Shaun", "Auger"],
  ["Geoffrey", "Morin"],
  ["Jeffrey", "Morin"],
  // Spacing / hyphen variants of the same name
  ["Jo Ann", "Smith"],
  ["JoAnn", "Smith"],
  ["Jo-Ann", "Smith"],
  // Data-entry casing reality
  ["JOHN", "SMITH"],
  ["mary", "bird"],
  // Accented given names on local surnames
  ["Zoë", "Lafferty"],
  ["Renée", "Gladue"],
  ["Chloé", "Belcourt"],
  // Long hyphenated
  ["Maximilienne", "Vandenberghe-Kowalczyk"],
  // Mononyms (legal in Alberta; reclaimed names often are)
  ["Keeseekoowenin", ""],
  ["Ininiw", ""],
  // Street-name aliases (how many clients are actually known)
  ["Robert", "Cardinal", ["Smiley"]],
  ["Darlene", "Whiskeyjack", ["Red"]],
  ["Terrance", "Littlechild", ["Bear", "T-Bear"]],
  ["Justin", "Thunderchild", ["JT"]],
  ["Michel", "Desjarlais", ["Frenchie"]],
  ["Verna", "Yellowbird", ["Sunshine"]],
];

// ── Generator pools (fill to TARGET_TOTAL deterministically) ─────
const FIRST_POOL = [
  "James", "Mary", "Robert", "Patricia", "John", "Jennifer", "Michael",
  "Linda", "David", "Sarah", "Joseph", "Karen", "Daniel", "Lisa",
  "Wâpan", "Kimowan", "Pîsim", "Tânsi", "Miyo",
  "Amina", "Zahra", "Omar", "Yusuf", "Halima", "Ismail",
  "Olena", "Dmytro", "Kateryna", "Petro",
  "Thanh", "Huong", "Duc",
  "Emily", "Brandon", "Ashley", "Tyler", "Amanda", "Cody", "Brittany",
];
const LAST_POOL = [
  // Weighted toward Alberta Indigenous/Métis surnames
  "Cardinal", "Cardinal", "Gladue", "Gladue", "Auger", "Morin",
  "Desjarlais", "Belcourt", "Whitford", "Yellowbird", "Makokis", "Bull",
  "Crane", "Steinhauer", "Littlechild", "Whiskeyjack", "Bird", "Loyer",
  "Callihoo", "Dumont", "Delorme", "Beaulieu", "Lafleur", "Bruneau",
  "Thunderchild", "Crowchild", "Potts", "Saddleback", "Rain", "Omeasoo",
  // Anglo
  "Smith", "Johnson", "Miller", "Brown", "Wilson", "Taylor", "White",
  "Martin", "Anderson", "Campbell",
  // Other Edmonton communities
  "Hassan", "Warsame", "Abdi", "Omar", "Nguyễn", "Melnyk", "Shevchenko",
  "Kowalczyk", "MacDonald", "O'Brien",
];
const ALIAS_POOL = ["Smiley", "Doc", "Slim", "Bear", "Red", "Junior", "Auntie", "Chief"];

const BASE_DATE_MS = Date.parse("2024-06-01T12:00:00-06:00");

function buildDoc(firstName, lastName, aliases, i) {
  // Deterministic spread: dob across ~50 years, createdAt across ~2 years.
  const dobYear = 1955 + ((i * 13) % 50);
  const dobMonth = String(1 + ((i * 7) % 12)).padStart(2, "0");
  const dobDay = String(1 + ((i * 11) % 28)).padStart(2, "0");
  const createdAt = new Date(BASE_DATE_MS + i * 7 * 60 * 60 * 1000);
  const banned = i % 23 === 5;
  return {
    firstName,
    secondName: lastName,
    photoThumb: null,
    genderIdentity: null,
    aliases: aliases ?? [],
    dateOfBirth: `${dobYear}-${dobMonth}-${dobDay}`,
    arcCardNumber: "",
    address: "10527 96 St NW",
    postalCode: "T5H 2H6",
    passesIssued: [],
    banned,
    banReason: banned ? "Program terms violation (fixture)" : "",
    notes: "Name-explosion fixture (scripts/seed-name-explosion.mjs --delete)",
    status: i % 13 === 3 ? "Inactive" : "Active",
    email: `${PREFIX}${String(i).padStart(4, "0")}@fixtures.local`,
    phone: null,
    createdAt,
    createdBy: CREATED_BY,
    updatedAt: createdAt,
  };
}

const { db } = getAdmin();

if (DELETE) {
  const snap = await db
    .collection("users")
    .where("createdBy", "==", CREATED_BY)
    .select()
    .get();
  for (let start = 0; start < snap.docs.length; start += 400) {
    const batch = db.batch();
    for (const doc of snap.docs.slice(start, start + 400)) batch.delete(doc.ref);
    await batch.commit();
  }
  console.log(`Deleted ${snap.size} explosion fixtures.`);
  console.log("Run scripts/rebuild-search-index.mjs to drop their index entries.");
  process.exit(0);
}

const docs = [];
let i = 0;
for (const [firstName, lastName, aliases] of CURATED) {
  docs.push({ id: `${PREFIX}c${String(i).padStart(3, "0")}`, data: buildDoc(firstName, lastName, aliases, i) });
  i++;
}
while (docs.length < TARGET_TOTAL) {
  const firstName = FIRST_POOL[(i * 7) % FIRST_POOL.length];
  const lastName = LAST_POOL[(i * 11) % LAST_POOL.length];
  const aliases = i % 12 === 4 ? [ALIAS_POOL[i % ALIAS_POOL.length]] : [];
  docs.push({ id: `${PREFIX}g${String(i).padStart(3, "0")}`, data: buildDoc(firstName, lastName, aliases, i) });
  i++;
}

console.log(`Seeding ${docs.length} recipients (${CURATED.length} curated hard cases + ${docs.length - CURATED.length} generated)...`);
for (let start = 0; start < docs.length; start += 400) {
  const batch = db.batch();
  for (const { id, data } of docs.slice(start, start + 400)) {
    batch.set(db.collection("users").doc(id), data);
  }
  await batch.commit();
  console.log(`  committed ${Math.min(start + 400, docs.length)}/${docs.length}`);
}

console.log("\nDone. Now run: node scripts/rebuild-search-index.mjs");
