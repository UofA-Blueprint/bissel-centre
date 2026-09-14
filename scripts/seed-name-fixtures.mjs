#!/usr/bin/env node
/**
 * Seed recipient fixtures exercising the name-search edge cases alongside
 * average names. Deterministic doc IDs (namefix_*) so re-running overwrites
 * rather than duplicates; remove with --delete.
 *
 * Run scripts/rebuild-search-index.mjs afterwards (or rely on it having been
 * run) so the fixtures are searchable.
 *
 * Usage:
 *   node scripts/seed-name-fixtures.mjs
 *   node scripts/seed-name-fixtures.mjs --delete
 */

import { getAdmin } from "../tests/stress/lib.mjs";

const DELETE = process.argv.includes("--delete");
const CREATED_BY = "name-fixtures";

// Edge cases from the Indigenous-names research + averages + phonetic pairs.
// Unicode written explicitly where it matters so the file survives editors.
const FIXTURES = [
  // Average cases
  { id: "namefix_01", firstName: "Sarah", secondName: "Smith", dob: "1990-04-12" },
  { id: "namefix_02", firstName: "Jared", secondName: "Miller", dob: "1985-09-30" },
  { id: "namefix_03", firstName: "Emily", secondName: "Johnson", dob: "1998-01-22" },
  // Phonetic pair with namefix_01
  { id: "namefix_04", firstName: "Sara", secondName: "Smyth", dob: "1979-06-05" },
  // Common diacritics
  { id: "namefix_05", firstName: "José", secondName: "García", dob: "1988-11-02" },
  { id: "namefix_06", firstName: "Emine", secondName: "Öztürk", dob: "1972-03-17" },
  // Atomic Ø (no NFD decomposition)
  { id: "namefix_07", firstName: "Søren", secondName: "Møller", dob: "1969-08-08" },
  // Métis surname, stored with CURLY apostrophe U+2019 (queries may use ASCII ')
  { id: "namefix_08", firstName: "François", secondName: "L’Hirondelle", dob: "1981-02-14" },
  // Compound translated surname — joined vs spaced variants of each other
  { id: "namefix_09", firstName: "Mary", secondName: "Littlechild", dob: "1994-07-19" },
  { id: "namefix_10", firstName: "Joseph", secondName: "Little Child", dob: "1963-12-01" },
  // Cree translated surname
  { id: "namefix_11", firstName: "Lana", secondName: "Whiskeyjack", dob: "1986-05-23" },
  // High-collision Métis surname — two near-identical people (DOB disambiguates)
  { id: "namefix_12", firstName: "Marie", secondName: "Cardinal", dob: "1985-10-10" },
  { id: "namefix_13", firstName: "Maria", secondName: "Cardinal", dob: "1992-04-04" },
  // Cree SRO circumflex given name
  { id: "namefix_14", firstName: "Wâpanacâhkos", secondName: "Bird", dob: "1991-03-03" },
  // Dene name with ogonek+acute vowels and glottal stop (documented real case
  // pattern): Sahą́ı̨́ʔą Gahdële
  {
    id: "namefix_15",
    firstName: "Sahą́ı̨́ʔą",
    secondName: "Gahdële",
    dob: "2015-06-21",
  },
  // Aliases / street names (first-class in search)
  {
    id: "namefix_16",
    firstName: "Robert",
    secondName: "Thunderchild",
    dob: "1977-09-09",
    aliases: ["Bobby T", "Thunder"],
  },
  // Mononym (Alberta permits single names; reclaimed names often are)
  { id: "namefix_17", firstName: "Piyêsîs", secondName: "", dob: "1959-01-15" },
];

const { db } = getAdmin();

if (DELETE) {
  for (const f of FIXTURES) {
    await db.collection("users").doc(f.id).delete();
  }
  console.log(`Deleted ${FIXTURES.length} fixture recipients.`);
  console.log("Run scripts/rebuild-search-index.mjs to drop their index entries.");
  process.exit(0);
}

for (const f of FIXTURES) {
  await db.collection("users").doc(f.id).set({
    firstName: f.firstName,
    secondName: f.secondName,
    photoThumb: null, // dashboard falls back to initials
    genderIdentity: null,
    aliases: f.aliases ?? [],
    dateOfBirth: f.dob,
    arcCardNumber: "",
    address: "10527 96 St NW",
    postalCode: "T5H 2H6",
    passesIssued: [],
    banned: false,
    banReason: "",
    notes: "Name-search test fixture (safe to delete: scripts/seed-name-fixtures.mjs --delete)",
    status: "Active",
    email: `${f.id}@fixtures.local`,
    phone: null,
    createdAt: new Date(),
    createdBy: CREATED_BY,
    updatedAt: new Date(),
  });
  console.log(`  ${f.id}: ${f.firstName} ${f.secondName}`.trimEnd());
}

console.log(`\nSeeded ${FIXTURES.length} fixture recipients.`);
console.log("Now run: node scripts/rebuild-search-index.mjs");
