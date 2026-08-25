import "server-only";

import sharp from "sharp";

const MAX_PICTURE_FIELD_BYTES = 1_000_000;
const MAX_THUMBNAIL_FIELD_BYTES = 20_000;
const THUMB_MAX_DIMENSION = 96;
const THUMB_QUALITY = 75;

export type ProcessedRecipientPhoto = {
  picture: string;
  photoThumb: string;
};

function sniffImageMime(buffer: Buffer): string | null {
  if (buffer.length < 12) return null;
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    return "image/png";
  }
  if (
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP"
  ) {
    return "image/webp";
  }
  if (buffer.toString("ascii", 0, 4) === "GIF8") return "image/gif";
  if (buffer.toString("ascii", 4, 8) === "ftyp") {
    const ftypSize = buffer.readUInt32BE(0);
    const boxEnd = Math.min(
      buffer.length,
      Math.max(12, Math.min(ftypSize, 64)),
    );
    const brands = buffer.toString("ascii", 8, boxEnd);
    if (brands.includes("avif") || brands.includes("avis")) return "image/avif";
  }
  return null;
}

export async function processRecipientPhoto(
  dataUrl: string,
): Promise<ProcessedRecipientPhoto> {
  if (Buffer.byteLength(dataUrl, "utf8") > MAX_PICTURE_FIELD_BYTES) {
    throw new Error(
      "Recipient photo is too large. Please upload a smaller image.",
    );
  }

  const match = dataUrl.match(
    /^data:image\/(jpeg|png|webp|avif|gif);base64,([A-Za-z0-9+/=]+)$/,
  );
  if (!match) {
    throw new Error(
      "Recipient photo must be a valid JPEG, PNG, WebP, AVIF, or GIF image.",
    );
  }

  const mime = `image/${match[1]}`;
  const buffer = Buffer.from(match[2], "base64");
  if (sniffImageMime(buffer) !== mime) {
    throw new Error("Recipient photo content does not match its image format.");
  }

  let thumbBuffer: Buffer;
  try {
    thumbBuffer = await sharp(buffer)
      .resize(THUMB_MAX_DIMENSION, THUMB_MAX_DIMENSION, { fit: "inside" })
      .flatten({ background: "#ffffff" })
      .jpeg({ quality: THUMB_QUALITY })
      .toBuffer();
  } catch {
    throw new Error(
      "Recipient photo could not be processed. Please upload a different image.",
    );
  }

  const photoThumb = `data:image/jpeg;base64,${thumbBuffer.toString("base64")}`;
  if (Buffer.byteLength(photoThumb, "utf8") > MAX_THUMBNAIL_FIELD_BYTES) {
    throw new Error(
      "Recipient photo thumbnail could not be made small enough.",
    );
  }

  return {
    picture: `data:${mime};base64,${buffer.toString("base64")}`,
    photoThumb,
  };
}
