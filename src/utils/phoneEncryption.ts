import crypto from "crypto";

/**
 * Encrypts a phone number using AES-256-GCM encryption.
 * Returns the encrypted data as a base64 string with the IV prepended.
 * Format: [16-byte IV][encrypted data][16-byte auth tag]
 */
export function encryptPhone(phoneNumber: string | null): string | null {
  if (!phoneNumber || phoneNumber.trim() === "") {
    return null;
  }

  const encryptionKey = process.env.PHONE_ENCRYPTION_KEY;

  if (!encryptionKey) {
    throw new Error(
      "Phone encryption key is not configured. Set the PHONE_ENCRYPTION_KEY environment variable."
    );
  }

  const key = crypto
    .createHash("sha256")
    .update(encryptionKey)
    .digest();

  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);

  let encrypted = cipher.update(phoneNumber.trim(), "utf8", "base64");
  encrypted += cipher.final("base64");

  const authTag = cipher.getAuthTag();

  const combined = Buffer.concat([
    iv,
    Buffer.from(encrypted, "base64"),
    authTag,
  ]);

  return combined.toString("base64");
}

/**
 * Decrypts an encrypted phone number.
 * Expects the format: [16-byte IV][encrypted data][16-byte auth tag]
 */
export function decryptPhone(encryptedPhone: string | null): string | null {
  if (!encryptedPhone || encryptedPhone.trim() === "") {
    return null;
  }

  const encryptionKey = process.env.PHONE_ENCRYPTION_KEY;

  if (!encryptionKey) {
    throw new Error(
      "Phone encryption key is not configured. Set the PHONE_ENCRYPTION_KEY environment variable."
    );
  }

  try {
    const key = crypto
      .createHash("sha256")
      .update(encryptionKey)
      .digest();

    const combined = Buffer.from(encryptedPhone, "base64");
    const iv = combined.subarray(0, 16);
    const authTag = combined.subarray(combined.length - 16);
    const encrypted = combined.subarray(16, combined.length - 16);

    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted, undefined, "utf8");
    decrypted += decipher.final("utf8");

    return decrypted;
  } catch (error) {
    console.error("Error decrypting phone number:", error);
    return null;
  }
}

/**
 * Utility to decrypt phone numbers in batch (for displaying multiple users)
 */
export function decryptPhones(
  users: Array<{ phone?: string | null; [key: string]: unknown }>
): Array<{ phone?: string | null; [key: string]: unknown }> {
  return users.map((user) => ({
    ...user,
    phone: user.phone ? decryptPhone(user.phone) : null,
  }));
}
