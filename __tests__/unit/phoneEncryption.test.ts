import {
  encryptPhone,
  decryptPhone,
  decryptPhones,
} from "@/utils/phoneEncryption";

describe("Phone Encryption Utilities", () => {
  const originalEnvKey = process.env.PHONE_ENCRYPTION_KEY;
  const mockKey = "test-secret-key-that-is-32-bytes-long-for-safety";

  beforeEach(() => {
    // Set up a valid environment variable for general test runs
    process.env.PHONE_ENCRYPTION_KEY = mockKey;
  });

  afterAll(() => {
    // Restore original state
    process.env.PHONE_ENCRYPTION_KEY = originalEnvKey;
  });

  describe("Base input handling (null / empty cases)", () => {
    it("should return null if input to encryptPhone is null, undefined, or empty", () => {
      expect(encryptPhone(null)).toBeNull();
      expect(encryptPhone("")).toBeNull();
      expect(encryptPhone("   ")).toBeNull();
    });

    it("should return null if input to decryptPhone is null, undefined, or empty", () => {
      expect(decryptPhone(null)).toBeNull();
      expect(decryptPhone("")).toBeNull();
      expect(decryptPhone("   ")).toBeNull();
    });
  });

  describe("Missing configuration validation", () => {
    it("should throw an error in encryptPhone if PHONE_ENCRYPTION_KEY is not defined", () => {
      delete process.env.PHONE_ENCRYPTION_KEY;

      expect(() => encryptPhone("+15551234567")).toThrow(
        "Phone encryption key is not configured. Set the PHONE_ENCRYPTION_KEY environment variable."
      );
    });

    it("should throw an error in decryptPhone if PHONE_ENCRYPTION_KEY is not defined", () => {
      delete process.env.PHONE_ENCRYPTION_KEY;

      expect(() => decryptPhone("someEncryptedBase64String")).toThrow(
        "Phone encryption key is not configured. Set the PHONE_ENCRYPTION_KEY environment variable."
      );
    });
  });

  describe("Successful Roundtrip (Encrypt & Decrypt)", () => {
    it("should successfully encrypt and then decrypt a valid phone number", () => {
      const rawPhone = "+1 (555) 019-2834";
      const encrypted = encryptPhone(rawPhone);

      // Verify encryption returned a base64-like string different from the raw number
      expect(encrypted).not.toBeNull();
      expect(typeof encrypted).toBe("string");
      expect(encrypted).not.toBe(rawPhone);

      // Decrypt and assert match
      const decrypted = decryptPhone(encrypted);
      expect(decrypted).toBe(rawPhone);
    });

    it("should trim whitespace from the phone number prior to encrypting", () => {
      const untrimmedPhone = "  +15559876543  ";
      const encrypted = encryptPhone(untrimmedPhone);
      const decrypted = decryptPhone(encrypted);

      expect(decrypted).toBe("+15559876543");
    });
  });

  describe("Tampering and Decryption Errors", () => {
    let consoleErrorSpy: jest.SpyInstance;

    beforeEach(() => {
      // Intercept console.error to keep the test outputs clean
      consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    });

    afterEach(() => {
      consoleErrorSpy.mockRestore();
    });

    it("should return null and log an error if GCM auth tag verification fails (tampered payload)", () => {
      const originalPhone = "+15551234567";
      const encrypted = encryptPhone(originalPhone);
      expect(encrypted).not.toBeNull();

      // Convert the valid base64 payload to a buffer
      const buffer = Buffer.from(encrypted!, "base64");
      
      // Tamper with a byte inside the encrypted data region (between index 16 and length-16)
      buffer[20] = buffer[20] ^ 1;

      const tamperedPayload = buffer.toString("base64");

      // Attempt to decrypt the corrupted payload
      const result = decryptPhone(tamperedPayload);

      // The decryption should fail, catch the error, log to console, and return null
      expect(result).toBeNull();
      expect(consoleErrorSpy).toHaveBeenCalled();
    });
  });

  describe("decryptPhones (Batch Decryption)", () => {
    it("should batch decrypt user objects while preserving other properties", () => {
      const phone1 = "+15551112222";
      const phone2 = "+15553334444";

      const enc1 = encryptPhone(phone1);
      const enc2 = encryptPhone(phone2);

      const mockUsers = [
        { id: "user-1", name: "Alice", phone: enc1 },
        { id: "user-2", name: "Bob", phone: null },
        { id: "user-3", name: "Charlie", phone: enc2 },
        { id: "user-4", name: "Dave" }, // phone property undefined
      ];

      const decryptedUsers = decryptPhones(mockUsers);

      // Verify the list returned matches expectations
      expect(decryptedUsers[0].phone).toBe(phone1);
      expect(decryptedUsers[0].name).toBe("Alice"); // Ensures properties are intact

      expect(decryptedUsers[1].phone).toBeNull();
      
      expect(decryptedUsers[2].phone).toBe(phone2);

      expect(decryptedUsers[3].phone).toBeNull(); // Map treats undefined as null
    });
  });
});