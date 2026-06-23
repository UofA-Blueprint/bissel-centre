import { getDashboardSummaryForViewer } from "@/app/services/dashboardService";

// Mock server-only
jest.mock("server-only", () => ({}));

// 1. Mock firebaseAdmin to prevent actual database calls
const mockSelect = jest.fn().mockReturnThis();
const mockWhere = jest.fn().mockReturnThis();
const mockCount = jest.fn().mockReturnThis();
const mockGet = jest.fn();

const mockFirestore = {
  collection: jest.fn().mockImplementation(() => ({
    select: mockSelect,
    where: mockWhere,
    count: mockCount,
    get: mockGet,
  })),
};

jest.mock("@/app/services/firebaseAdmin", () => ({
  initAdmin: jest.fn().mockResolvedValue({
    firestore: () => mockFirestore,
  }),
}));

describe("Dashboard Service", () => {
  const mockViewer = {
    uid: "admin-id",
    email: "admin@test.com",
    name: "IT Admin",
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should successfully aggregate card counts and map them to dashboard stats", async () => {
    // Mock the database outputs for collections
    mockGet.mockImplementation(function (this: any) {
      const collectionName = mockFirestore.collection.mock.calls[
        mockFirestore.collection.mock.calls.length - 1
      ]?.[0];

      if (collectionName === "users") {
        return Promise.resolve({ docs: [] }); // No users in this test
      }
      if (collectionName === "issues") {
        return Promise.resolve({ docs: [] }); // No issues in this test
      }
      if (collectionName === "arc_cards") {
        // Distinguish based on count aggregations
        return Promise.resolve({
          data: () => ({ count: 10 }), // Mock count values
        });
      }
      if (collectionName === "banned_users") {
        return Promise.resolve({
          data: () => ({ count: 2 }),
        });
      }
      return Promise.resolve({ docs: [] });
    });

    const summary = await getDashboardSummaryForViewer(mockViewer);

    expect(summary.viewer).toEqual(mockViewer);
    expect(summary.stats).toEqual([
      { icon: "/card.svg", number: 10, label: "Available Cards" },
      { icon: "/checkmark.svg", number: 10, label: "Active Cards" },
      { icon: "/caution.svg", number: 10, label: "Expired Cards" },
      { icon: "/flag.svg", number: 2, label: "Flagged Users" },
    ]);
  });

  it("should parse user issues correctly, mark active cards, and format the last issued date", async () => {
    const mockUserDoc = {
      id: "user-alice",
      data: () => ({
        firstName: "Alice",
        secondName: "Smith",
        createdAt: "2023-10-01T12:00:00.000Z",
      }),
    };

    // Alice has two issues:
    // 1. One old issue that has been returned
    // 2. One current issue that has not been returned (Active)
    const mockIssueDocs = [
      {
        id: "issue-1",
        data: () => ({
          userId: "user-alice",
          createdAt: "2023-01-15T10:00:00.000Z",
          returnedAt: "2023-01-30T10:00:00.000Z",
        }),
      },
      {
        id: "issue-2",
        data: () => ({
          userId: "user-alice",
          createdAt: "2023-05-20T10:00:00.000Z", // Latest date: May 20, 2023
          returnedAt: null, // No return date, meaning active
        }),
      },
    ];

    mockGet.mockImplementation(function (this: any) {
      // Find the most recent collection name queried
      const lastCallIndex = mockFirestore.collection.mock.calls.length - 1;
      const collectionName = mockFirestore.collection.mock.calls[lastCallIndex]?.[0];

      if (collectionName === "users") {
        return Promise.resolve({ docs: [mockUserDoc] });
      }
      if (collectionName === "issues") {
        return Promise.resolve({ docs: mockIssueDocs });
      }
      // Return simple count mock for card aggregates
      return Promise.resolve({
        data: () => ({ count: 0 }),
      });
    });

    const summary = await getDashboardSummaryForViewer(mockViewer);

    expect(summary.users).toHaveLength(1);
    
    const userResult = summary.users[0];
    expect(userResult.id).toBe("user-alice");
    expect(userResult.firstName).toBe("Alice");
    
    // Assert active issue status is correctly mapped to "Active"
    expect(userResult.arcCardStatus).toBe("Active");

    // Assert custom formatting: May 20, 2023 translates to "05/20/23"
    expect(userResult.lastIssued).toBe("05/20/23");
  });

  it("should default lastIssued to 'N/A' and status to undefined if a user has no issues logged", async () => {
    const mockUserDoc = {
      id: "user-bob",
      data: () => ({
        firstName: "Bob",
        secondName: "Jones",
      }),
    };

    mockGet.mockImplementation(function (this: any) {
      const lastCallIndex = mockFirestore.collection.mock.calls.length - 1;
      const collectionName = mockFirestore.collection.mock.calls[lastCallIndex]?.[0];

      if (collectionName === "users") {
        return Promise.resolve({ docs: [mockUserDoc] });
      }
      if (collectionName === "issues") {
        return Promise.resolve({ docs: [] }); // No issues found
      }
      return Promise.resolve({
        data: () => ({ count: 0 }),
      });
    });

    const summary = await getDashboardSummaryForViewer(mockViewer);
    const userResult = summary.users[0];

    expect(userResult.arcCardStatus).toBeUndefined();
    expect(userResult.lastIssued).toBe("N/A");
  });
});