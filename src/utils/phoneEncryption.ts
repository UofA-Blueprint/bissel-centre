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

  // Derive a 32-byte key from the environment variable
  const key = crypto
    .createHash("sha256")
    .update(encryptionKey)
    .digest();

  // Generate a random initialization vector (IV)
  const iv = crypto.randomBytes(16);

  // Create cipher
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);

  // Encrypt the phone number
  let encrypted = cipher.update(phoneNumber.trim(), "utf8", "base64");
  encrypted += cipher.final("base64");

  // Get the authentication tag
  const authTag = cipher.getAuthTag();

  // Combine IV + encrypted data + auth tag
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
    // Derive the same 32-byte key
    const key = crypto
      .createHash("sha256")
      .update(encryptionKey)
      .digest();

    // Decode the combined data
    const combined = Buffer.from(encryptedPhone, "base64");

    // Extract IV (first 16 bytes)
    const iv = combined.subarray(0, 16);

    // Extract auth tag (last 16 bytes)
    const authTag = combined.subarray(combined.length - 16);

    // Extract encrypted data (everything in between)
    const encrypted = combined.subarray(16, combined.length - 16);

    // Create decipher
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(authTag);

    // Decrypt
    let decrypted = decipher.update(encrypted, undefined, "utf8");
    decrypted += decipher.final("utf8");

    return decrypted;
  } catch (error) {
    console.error("Error decrypting phone number:", error);
    // Return null rather than exposing the encrypted value
    return null;
  }
}

/**
 * Utility to decrypt phone numbers in batch (for displaying multiple users)
 */
export function decryptPhones(
  users: Array<{ phone?: string | null; [key: string]: any }>
): Array<{ phone?: string | null; [key: string]: any }> {
  return users.map((user) => ({
    ...user,
    phone: user.phone ? decryptPhone(user.phone) : null,
  }));
}
