#!/usr/bin/env node
/**
 * Photo split migration — keeps images as base64.
 *
 * For every user doc that still carries a full `picture`:
 *   1. Copy the full-res base64 to user_photos/{userId}  (verified read-back)
 *   2. Generate a small photoThumb (96px JPEG) onto the user doc
 *   3. Leave `picture` in place (non-destructive) unless --prune is passed
 *
 * Idempotent: re-running skips users that already have both.
 *
 * Usage:
 *   node scripts/migrate-photos.mjs             # dry summary + migrate
 *   node scripts/migrate-photos.mjs --dry-run   # report only, no writes
 *   node scripts/migrate-photos.mjs --prune     # ALSO delete users.picture
 *                                               # (run only after the new code
 *                                               #  is deployed everywhere)
 */

import { getAdmin } from "../tests/stress/lib.mjs";
import { FieldValue } from "firebase-admin/firestore";
import sharp from "sharp";

const DRY_RUN = process.argv.includes("--dry-run");
const PRUNE = process.argv.includes("--prune");

const THUMB_MAX_DIMENSION = 96;
const THUMB_QUALITY = 75;

async function makeThumb(pictureDataUrl) {
  const match = pictureDataUrl.match(/^data:image\/[a-z+.-]+;base64,(.+)$/s);
  if (!match) return null; // not a base64 data URI (e.g. a plain URL)
  const buffer = Buffer.from(match[1], "base64");
  const out = await sharp(buffer)
    .resize(THUMB_MAX_DIMENSION, THUMB_MAX_DIMENSION, { fit: "inside" })
    // JPEG has no alpha — flatten transparent PNGs onto white, not black.
    .flatten({ background: "#ffffff" })
    .jpeg({ quality: THUMB_QUALITY })
    .toBuffer();
  return `data:image/jpeg;base64,${out.toString("base64")}`;
}

async function main() {
  const { db } = getAdmin();

  console.log(`Photo split migration ${DRY_RUN ? "(DRY RUN)" : ""}${PRUNE ? "(PRUNE)" : ""}\n`);

  const usersSnap = await db.collection("users").get();
  let migrated = 0;
  let skipped = 0;
  let pruned = 0;
  let urlPassThrough = 0;

  for (const doc of usersSnap.docs) {
    const data = doc.data();
    const picture = typeof data.picture === "string" ? data.picture : "";
    const hasThumb = typeof data.photoThumb === "string" && data.photoThumb.length > 0;

    if (!picture) {
      if (hasThumb) skipped++;
      continue;
    }

    const photoRef = db.collection("user_photos").doc(doc.id);
    const photoDoc = await photoRef.get();
    const photoCopied =
      photoDoc.exists && photoDoc.data()?.picture === picture;

    if (photoCopied && hasThumb && !PRUNE) {
      skipped++;
      continue;
    }

    let thumb = null;
    if (!hasThumb) {
      if (picture.startsWith("data:")) {
        thumb = await makeThumb(picture);
      } else {
        // Seed-style URL pictures: reuse the URL as the thumbnail.
        thumb = picture;
        urlPassThrough++;
      }
    }

    if (DRY_RUN) {
      console.log(
        `  would migrate ${doc.id}: picture ${picture.length} chars` +
          `${photoCopied ? " (already copied)" : ""}` +
          `${hasThumb ? " (thumb exists)" : thumb ? ` -> thumb ${thumb.length} chars` : " (no thumb derivable)"}`,
      );
      migrated++;
      continue;
    }

    // 1. Copy full-res photo, then verify by read-back before any pruning.
    if (!photoCopied) {
      await photoRef.set({
        picture,
        migratedAt: FieldValue.serverTimestamp(),
      });
      const verify = await photoRef.get();
      if (verify.data()?.picture !== picture) {
        throw new Error(`Copy verification failed for ${doc.id} — aborting.`);
      }
    }

    // 2. Thumbnail on the user doc.
    if (!hasThumb && thumb) {
      await doc.ref.update({ photoThumb: thumb });
    }

    // 3. Optional prune of the legacy field (post-deploy only).
    if (PRUNE) {
      await doc.ref.update({ picture: FieldValue.delete() });
      pruned++;
    }

    migrated++;
    console.log(
      `  migrated ${doc.id}: photo ${photoCopied ? "already copied" : "copied"}` +
        `${!hasThumb && thumb ? `, thumb ${thumb.length} chars` : ""}` +
        `${PRUNE ? ", picture pruned" : ""}`,
    );
  }

  console.log(
    `\nDone. migrated=${migrated} skipped=${skipped} pruned=${pruned} url-passthrough=${urlPassThrough} of ${usersSnap.size} users.`,
  );
}

main().catch((e) => { console.error("Migration failed:", e); process.exit(1); });
