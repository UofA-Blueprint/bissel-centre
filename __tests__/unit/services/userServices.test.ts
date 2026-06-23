import {
  getUserById,
  getUserByEmail,
  banUser,
  deleteUser,
  issueNewArcCard,
  User,
} from "@/app/services/userService";
import {
  doc,
  getDoc,
  getDocs,
  updateDoc,
  addDoc,
  deleteDoc,
  Timestamp,
} from "firebase/firestore";

// 1. Mock the Firestore SDK functions
const mockDoc = jest.fn();
const mockGetDoc = jest.fn();
const mockCollection = jest.fn();
const mockQuery = jest.fn();
const mockWhere = jest.fn();
const mockGetDocs = jest.fn();
const mockUpdateDoc = jest.fn();
const mockDeleteDoc = jest.fn();
const mockAddDoc = jest.fn();

jest.mock("firebase/firestore", () => ({
  doc: (...args: any[]) => mockDoc(...args),
  getDoc: (...args: any[]) => mockGetDoc(...args),
  collection: (...args: any[]) => mockCollection(...args),
  query: (...args: any[]) => mockQuery(...args),
  where: (...args: any[]) => mockWhere(...args),
  getDocs: (...args: any[]) => mockGetDocs(...args),
  updateDoc: (...args: any[]) => mockUpdateDoc(...args),
  deleteDoc: (...args: any[]) => mockDeleteDoc(...args),
  addDoc: (...args: any[]) => mockAddDoc(...args),
  Timestamp: {
    now: jest.fn(() => "mock-timestamp"),
  },
}));

// Mock the db export from services/firebase to keep configuration decoupled
jest.mock("@/app/services/firebase", () => ({
  db: {},
}));

describe("UserService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCollection.mockReturnValue({ type: "collection-reference" });
    mockDoc.mockReturnValue({ type: "doc-reference" });
    mockQuery.mockReturnValue({ type: "query-reference" });
    mockWhere.mockReturnValue({ type: "where-clause" });
  });

  describe("getUserById", () => {
    it("should return parsed user if document exists", async () => {
      const mockBirthDate = new Date("2023-01-01T00:00:00Z");
      
      // Mock getDoc to return an existing document snapshot
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        id: "user-1",
        data: () => ({
          firstName: "John",
          secondName: "Doe",
          createdAt: { toDate: () => mockBirthDate },
        }),
      });

      const result = await getUserById("user-1");

      expect(mockDoc).toHaveBeenCalledWith(expect.anything(), "users", "user-1");
      expect(mockGetDoc).toHaveBeenCalled();
      expect(result).toEqual({
        id: "user-1",
        firstName: "John",
        secondName: "Doe",
        createdAt: mockBirthDate,
      });
    });

    it("should return null if document does not exist", async () => {
      mockGetDoc.mockResolvedValueOnce({
        exists: () => false,
      });

      const result = await getUserById("non-existent-user");

      expect(result).toBeNull();
    });
  });

  describe("getUserByEmail", () => {
    it("should normalize email address and return user document if found", async () => {
      const mockCreatedDate = new Date("2023-01-01T00:00:00Z");

      // Mock query snapshot with 1 document
      mockGetDocs.mockResolvedValueOnce({
        empty: false,
        docs: [
          {
            id: "user-2",
            data: () => ({
              email: "test@example.com",
              createdAt: { toDate: () => mockCreatedDate },
            }),
          },
        ],
      });

      const result = await getUserByEmail("   TEST@example.com   "); // test trimming & case normalization

      expect(mockWhere).toHaveBeenCalledWith("email", "==", "test@example.com");
      expect(result).toEqual({
        id: "user-2",
        email: "test@example.com",
        createdAt: mockCreatedDate,
      });
    });

    it("should return null if no matching user document is found", async () => {
      mockGetDocs.mockResolvedValueOnce({
        empty: true,
      });

      const result = await getUserByEmail("notfound@example.com");

      expect(result).toBeNull();
    });
  });

  describe("banUser (Multi-collection Orchestration)", () => {
    it("should update user status, create a banned_users record, and log history", async () => {
      const userId = "user-to-ban";
      const reason = "Code of conduct violation";
      const admin = "Admin-Bob";
      const notes = "Repeated warnings ignored.";

      mockUpdateDoc.mockResolvedValueOnce(undefined);
      mockAddDoc.mockResolvedValue(undefined); // returns successfully for banned_users and history insertions

      await banUser(userId, reason, admin, notes);

      // 1. Verify user's profile gets updated with banned state
      expect(mockUpdateDoc).toHaveBeenCalledWith(
        expect.anything(), // docRef
        expect.objectContaining({
          banned: true,
          banReason: reason,
        })
      );

      // 2. Verify record created in "banned_users" collection
      expect(mockCollection).toHaveBeenCalledWith(expect.anything(), "banned_users");
      expect(mockAddDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          userId,
          banReason: reason,
          bannedBy: admin,
          notes,
          bannedAt: "mock-timestamp",
        })
      );

      // 3. Verify security event was logged to history
      expect(mockCollection).toHaveBeenCalledWith(expect.anything(), "history");
      expect(mockAddDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          userId,
          modifiedBy: admin,
          event: "Ban",
          notes: `User banned: ${reason}`,
          date: "mock-timestamp",
        })
      );
    });
  });

  describe("issueNewArcCard", () => {
    it("should register the card, update user metadata, and add audit logging", async () => {
      const userId = "user-3";
      const cardNum = "ARC-777-888";
      const dept = "Social Services";
      const admin = "Staff-Alice";

      mockAddDoc.mockResolvedValue(undefined);
      mockUpdateDoc.mockResolvedValue(undefined);

      await issueNewArcCard(userId, cardNum, dept, admin);

      // Verify card was stored with active status and security code
      expect(mockCollection).toHaveBeenCalledWith(expect.anything(), "arc_cards");
      expect(mockAddDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          userId,
          department: dept,
          arcCardNumber: cardNum,
          status: "Active",
          monthsRemaining: 3,
        })
      );

      // Verify user document was updated to hold new card number
      expect(mockUpdateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          arcCardNumber: cardNum,
        })
      );
    });
  });

  describe("deleteUser (Cascading Deletes)", () => {
    it("should delete the user document and wipe related documents in other collections", async () => {
      const userId = "user-to-delete";

      // Mock query returns for matching child documents (returns 1 child per collection)
      const mockDocRef = (id: string) => ({ id, ref: { id } });
      mockGetDocs.mockResolvedValue({
        docs: [mockDocRef("child-id-1")],
      });
      mockDeleteDoc.mockResolvedValue(undefined);

      await deleteUser(userId);

      // Verify master user record is deleted
      expect(mockDeleteDoc).toHaveBeenCalledWith(expect.anything());

      // Verify child cleanup searches were executed via query
      expect(mockCollection).toHaveBeenCalledWith(expect.anything(), "arc_cards");
      expect(mockCollection).toHaveBeenCalledWith(expect.anything(), "banned_users");
      expect(mockCollection).toHaveBeenCalledWith(expect.anything(), "history");
      expect(mockCollection).toHaveBeenCalledWith(expect.anything(), "questions");

      // Verify related child documents were deleted
      expect(mockDeleteDoc).toHaveBeenCalledTimes(5); // 1 main user doc + 4 related collection matches
    });
  });
});