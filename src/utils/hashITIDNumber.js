import crypto from "crypto";

/**
 * Hashes an IT identification number using SHA-256 with a pepper.
 * The pepper is retrieved from an environment variable.
 */
export const hashITIDNumber = (idNumber) => {
  if (typeof idNumber !== "string" || idNumber.trim() === "") {
    throw new Error("Invalid ID number provided for hashing.");
  }

  const normalized = idNumber.trim().toUpperCase();
  const pepper = process.env.IT_ID_HASH_PEPPER;

  if (!pepper) {
    throw new Error(
      "Hashing pepper is not configured. Modify the environment variable IT_ID_HASH_PEPPER."
    );
  }

  const stringToHash = `${normalized}${pepper}`;

  return crypto.createHash("sha256").update(stringToHash).digest("hex");
};
