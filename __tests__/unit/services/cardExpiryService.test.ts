import { expireOverdueArcCards } from "@/app/services/cardExpiryService";

// Mock server-only
jest.mock("server-only", () => ({}));

// Mock firebase-admin and its Firestore FieldValue helper
jest.mock("firebase-admin", () => ({
  firestore: {
    FieldValue: {
      serverTimestamp: jest.fn(() => "mock-server-timestamp"),
    },
  },
}));

describe("Card Expiry Service", () => {
  // Define mock structures for Firestore
  const mockWhere = jest.fn().mockReturnThis();
  const mockGet = jest.fn();
  const mockDoc = jest.fn();

  const mockBatchUpdate = jest.fn();
  const mockBatchCommit = jest.fn().mockResolvedValue(undefined);
  const mockBatch = jest.fn().mockImplementation(() => ({
    update: mockBatchUpdate,
    commit: mockBatchCommit,
  }));

  const mockDb = {
    collection: jest.fn().mockImplementation(() => ({
      where: mockWhere,
      get: mockGet,
      doc: mockDoc,
    })),
    getAll: jest.fn(),
    batch: mockBatch,
  } as any;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should return early with zeros if no overdue issues are found", async () => {
    mockGet.mockResolvedValueOnce({ empty: true });

    const result = await expireOverdueArcCards(mockDb);

    expect(result).toEqual({
      overdueIssueCount: 0,
      uniqueCardCount: 0,
      updatedCardCount: 0,
    });
    expect(mockDb.getAll).not.toHaveBeenCalled();
    expect(mockBatch).not.toHaveBeenCalled();
  });

  it("should safely handle duplicate card IDs, filter out empty inputs, and only expire 'Active' cards", async () => {
    // 1. Mock overdue issues (Alice & Bob share a card ID, Charlie has an empty card ID)
    const mockIssueDocs = [
      { data: () => ({ cardId: "card-active-1  " }) }, // Duplicate with spaces
      { data: () => ({ cardId: "card-active-1" }) },    // Duplicate
      { data: () => ({ cardId: "card-cancelled-2" }) }, // Unique, but cancelled
      { data: () => ({ cardId: "   " }) },               // Empty ID should be filtered out
    ];

    mockGet.mockResolvedValueOnce({
      empty: false,
      size: mockIssueDocs.length,
      docs: mockIssueDocs,
    });

    // Mock doc refs returning unique string IDs
    mockDoc.mockImplementation((id) => ({ id }));

    // 2. Mock getAll for card snapshots matching those IDs
    const mockCardSnapshots = [
      {
        exists: true,
        ref: { id: "card-active-1" },
        data: () => ({ status: "Active" }), // Should be updated
      },
      {
        exists: true,
        ref: { id: "card-cancelled-2" },
        data: () => ({ status: "Cancelled" }), // Should NOT be updated
      },
    ];

    mockDb.getAll.mockResolvedValueOnce(mockCardSnapshots);

    const result = await expireOverdueArcCards(mockDb);

    // Expecting 2 unique cards (empty string filtered, duplicates merged)
    expect(result).toEqual({
      overdueIssueCount: 4,
      uniqueCardCount: 2,
      updatedCardCount: 1, // Only active one gets updated
    });

    // Assert batch update was called once for the active card
    expect(mockBatchUpdate).toHaveBeenCalledTimes(1);
    expect(mockBatchUpdate).toHaveBeenCalledWith(
      { id: "card-active-1" },
      {
        status: "Expired",
        updatedAt: "mock-server-timestamp",
      }
    );

    expect(mockBatchCommit).toHaveBeenCalled();
  });

  it("should chunk batches and execute multiple commits when updating more than 400 cards", async () => {
    // 1. Mock 405 issues with unique card IDs
    const totalIssuesCount = 405;
    const mockIssueDocs = Array.from({ length: totalIssuesCount }, (_, index) => ({
      data: () => ({ cardId: `card-${index}` }),
    }));

    mockGet.mockResolvedValueOnce({
      empty: false,
      size: totalIssuesCount,
      docs: mockIssueDocs,
    });

    mockDoc.mockImplementation((id) => ({ id }));

    // 2. Mock 405 card snapshots returned by getAll (all Active)
    const mockCardSnapshots = Array.from({ length: totalIssuesCount }, (_, index) => ({
      exists: true,
      ref: { id: `card-${index}` },
      data: () => ({ status: "Active" }),
    }));

    mockDb.getAll.mockResolvedValueOnce(mockCardSnapshots);

    const result = await expireOverdueArcCards(mockDb);

    expect(result).toEqual({
      overdueIssueCount: totalIssuesCount,
      uniqueCardCount: totalIssuesCount,
      updatedCardCount: totalIssuesCount,
    });

    // Assert update was called for all 405 cards
    expect(mockBatchUpdate).toHaveBeenCalledTimes(totalIssuesCount);

    // Assert that batch commits occurred twice (at 400 count, and at the end for the remaining 5)
    expect(mockBatchCommit).toHaveBeenCalledTimes(2);
  });
});