import crypto from "crypto";
import { hashITIDNumber } from "@/utils/hashITIDNumber";

describe("hashITIDNumber Utility", () => {
  const originalPepper = process.env.IT_ID_HASH_PEPPER;
  const mockPepper = "test-pepper-value-123456";

  beforeEach(() => {
    // Assign mock pepper for test execution
    process.env.IT_ID_HASH_PEPPER = mockPepper;
  });

  afterAll(() => {
    // Restore the original environment configuration
    process.env.IT_ID_HASH_PEPPER = originalPepper;
  });

  describe("Successful Hashing & Normalization", () => {
    it("should generate a valid SHA-256 hash in hex format", () => {
      const id = "ABC-12345";
      const hash = hashITIDNumber(id);

      // Verify the output is a 64-character hex string
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });

    it("should produce deterministic outputs matching a manual SHA-256 generation", () => {
      const id = "XYZ-98765";
      const expectedInput = "XYZ-98765" + mockPepper;
      const expectedHash = crypto
        .createHash("sha256")
        .update(expectedInput)
        .digest("hex");

      const result = hashITIDNumber(id);
      expect(result).toBe(expectedHash);
    });

    it("should normalize lowercase input and trim whitespace before hashing", () => {
      const rawIdWithSpaces = "   abc-12345   ";
      const normalizedId = "ABC-12345";

      const hashFromRaw = hashITIDNumber(rawIdWithSpaces);
      const hashFromNormalized = hashITIDNumber(normalizedId);

      // Both must yield the exact same hash
      expect(hashFromRaw).toBe(hashFromNormalized);
    });
  });

  describe("Validation and Error Handling", () => {
    it("should throw an error if the pepper environment variable is missing", () => {
      delete process.env.IT_ID_HASH_PEPPER;

      expect(() => hashITIDNumber("ABC-12345")).toThrow(
        "Hashing pepper is not configured. Modify the environment variable IT_ID_HASH_PEPPER."
      );
    });

    it("should throw an error for empty or whitespace-only inputs", () => {
      expect(() => hashITIDNumber("")).toThrow(
        "Invalid ID number provided for hashing."
      );
      expect(() => hashITIDNumber("    ")).toThrow(
        "Invalid ID number provided for hashing."
      );
    });

    it("should throw an error if a non-string value is passed at runtime", () => {
      // Cast as 'any' to simulate JavaScript callers bypassing TypeScript compiler checks
      expect(() => hashITIDNumber(null as any)).toThrow(
        "Invalid ID number provided for hashing."
      );
      expect(() => hashITIDNumber(123456 as any)).toThrow(
        "Invalid ID number provided for hashing."
      );
      expect(() => hashITIDNumber({} as any)).toThrow(
        "Invalid ID number provided for hashing."
      );
    });
  });
});