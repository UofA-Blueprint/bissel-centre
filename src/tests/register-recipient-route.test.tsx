import { POST } from "@/app/api/register-recipient/route";
import { NextRequest } from "next/server";
import { initAdmin } from "@/app/services/firebaseAdmin";
import { getFirestore } from "firebase-admin/firestore";
import { cookies } from "next/headers";

jest.mock("next/server", () => ({
  NextRequest: jest.fn(),
  NextResponse: {
    json: (data: unknown, init?: ResponseInit) => ({
      json: async () => data,
      status: init?.status || 200,
    }),
  },
}));

jest.mock("next/headers", () => ({
  cookies: jest.fn(),
}));

jest.mock("@/app/services/firebaseAdmin", () => ({
  initAdmin: jest.fn(),
}));

jest.mock("firebase-admin/firestore", () => ({
  getFirestore: jest.fn(),
  Timestamp: {
    now: jest.fn(() => ({
      toDate: () => new Date("2026-01-01T00:00:00.000Z"),
    })),
    fromDate: jest.fn((date: Date) => ({ date })),
  },
}));

jest.mock("@/utils/phoneEncryption", () => ({
  encryptPhone: jest.fn((phone: string | null) => {
    return phone ? `encrypted_${phone}` : null;
  }),
}));

const mockUserSet = jest.fn();
const mockTxGet = jest.fn();
const mockTxSet = jest.fn();
const mockTxUpdate = jest.fn();

const mockCardQueryGet = jest.fn();
const mockArcCardsQuery = {
  where: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  get: mockCardQueryGet,
};

const mockUserRef = {
  id: "test-user-id",
  set: mockUserSet,
};

const mockIssueRef = {
  id: "test-issue-id",
};

const mockCardRef = {
  id: "test-card-doc-id",
};

const mockCardSnapshot = {
  empty: false,
  docs: [
    {
      id: mockCardRef.id,
      ref: mockCardRef,
      data: () => ({
        arcCardNumber: "1234567",
        currentUserId: null,
        status: "Unattributed",
      }),
    },
  ],
};

const mockUsersCollection = {
  doc: jest.fn(() => mockUserRef),
};

const mockIssuesCollection = {
  doc: jest.fn(() => mockIssueRef),
};

const mockArcCardsCollection = jest.fn(() => mockArcCardsQuery);
const mockCollection = jest.fn((name: string) => {
  if (name === "users") return mockUsersCollection;
  if (name === "issues") return mockIssuesCollection;
  if (name === "arc_cards") return mockArcCardsCollection();
  return {};
});

const mockRunTransaction = jest.fn(async (callback: (tx: unknown) => Promise<void>) => {
  const tx = {
    get: mockTxGet,
    set: mockTxSet,
    update: mockTxUpdate,
  };
  await callback(tx);
});

const mockVerifySessionCookie = jest.fn();
const mockAuth = jest.fn(() => ({
  verifySessionCookie: mockVerifySessionCookie,
}));

describe("POST /api/register-recipient", () => {
  const mockCookieStore = {
    get: jest.fn(),
  };

  const createMockRequest = (body: unknown): NextRequest => {
    return {
      json: async () => body,
    } as unknown as NextRequest;
  };

  beforeEach(() => {
    jest.clearAllMocks();

    (cookies as jest.Mock).mockResolvedValue(mockCookieStore);
    (initAdmin as jest.Mock).mockResolvedValue({
      auth: mockAuth,
    });
    (getFirestore as jest.Mock).mockReturnValue({
      collection: mockCollection,
      runTransaction: mockRunTransaction,
    });

    mockCookieStore.get.mockReturnValue({
      value: "valid-session-cookie",
    });
    mockVerifySessionCookie.mockResolvedValue({
      uid: "test-admin-uid",
    });

    mockTxGet.mockResolvedValue(mockCardSnapshot);
    mockUserSet.mockResolvedValue(undefined);
    mockRunTransaction.mockImplementation(
      async (callback: (tx: unknown) => Promise<void>) => {
        const tx = {
          get: mockTxGet,
          set: mockTxSet,
          update: mockTxUpdate,
        };
        await callback(tx);
      }
    );
  });

  it("successfully creates a new recipient, issues a card, and records the issue", async () => {
    const requestBody = {
      personalDetails: {
        firstName: "John",
        lastName: "Doe",
        alias: "Johnny",
        gender: "Male",
        phone: "555-1234",
        email: "john@example.com",
        dob: "1990-01-01",
        address: "123 Main St",
        postalCode: "12345",
      },
      additionalInfo: {
        journey: "Applied for the Ride Transit/LAP programs",
        mostCommonReason: "Health and Wellness",
        secondMostCommonReason: "Food Security",
        housingOption: "Emergency Sheltered",
        arcCardDigits: "1234567",
        arcCardDurationMonths: "3",
        notes: "Test notes",
      },
      photoUpload: {
        imageUrl: "data:image/jpeg;base64,test-image-data",
      },
    };

    const req = createMockRequest(requestBody);
    const response = await POST(req);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.success).toBe(true);
    expect(data.userId).toBe("test-user-id");
    expect(mockRunTransaction).toHaveBeenCalledTimes(1);
    expect(mockArcCardsQuery.where).toHaveBeenCalledWith(
      "arcCardNumber",
      "==",
      "1234567"
    );
    expect(mockTxSet).toHaveBeenCalledWith(
      mockUserRef,
      expect.objectContaining({
        firstName: "John",
        secondName: "Doe",
        arcCardNumber: "1234567",
      })
    );
    expect(mockTxUpdate).toHaveBeenCalledWith(
      mockCardRef,
      expect.objectContaining({
        currentUserId: "test-user-id",
        status: "Active",
      })
    );
    expect(mockTxSet).toHaveBeenCalledWith(
      mockIssueRef,
      expect.objectContaining({
        cardId: mockCardRef.id,
        userId: "test-user-id",
        issuedBy: "test-admin-uid",
        notes: "Test notes",
        returnedAt: null,
      })
    );
  });

  it("returns 401 when no session cookie is present", async () => {
    mockCookieStore.get.mockReturnValue(undefined);

    const requestBody = {
      personalDetails: { firstName: "John", lastName: "Doe" },
      photoUpload: { imageUrl: "data:image/jpeg;base64,test" },
    };

    const response = await POST(createMockRequest(requestBody));
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe("Unauthorized - No session found");
    expect(mockRunTransaction).not.toHaveBeenCalled();
  });

  it("returns 500 when session verification fails", async () => {
    mockVerifySessionCookie.mockRejectedValue(new Error("Invalid session"));

    const requestBody = {
      personalDetails: { firstName: "John", lastName: "Doe" },
      photoUpload: { imageUrl: "data:image/jpeg;base64,test" },
    };

    const response = await POST(createMockRequest(requestBody));
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBeTruthy();
  });

  it("returns 400 when personalDetails is missing", async () => {
    const response = await POST(
      createMockRequest({
        photoUpload: { imageUrl: "data:image/jpeg;base64,test" },
      })
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("Personal details are required");
  });

  it("returns 400 when photoUpload is missing", async () => {
    const response = await POST(
      createMockRequest({
        personalDetails: { firstName: "John", lastName: "Doe" },
      })
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("Recipient photo is required");
  });

  it("returns 400 when firstName is missing", async () => {
    const response = await POST(
      createMockRequest({
        personalDetails: { lastName: "Doe" },
        photoUpload: { imageUrl: "data:image/jpeg;base64,test" },
      })
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("firstName is required");
  });

  it("creates only the user record when no ARC card is selected", async () => {
    const response = await POST(
      createMockRequest({
        personalDetails: { firstName: "Jane", lastName: "Smith" },
        photoUpload: { imageUrl: "data:image/jpeg;base64,test" },
      })
    );
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.userId).toBe("test-user-id");
    expect(mockUserSet).toHaveBeenCalledWith(
      expect.objectContaining({
        firstName: "Jane",
        secondName: "Smith",
      })
    );
    expect(mockRunTransaction).not.toHaveBeenCalled();
  });

  it("returns 400 when an ARC card is selected without an issue duration", async () => {
    const response = await POST(
      createMockRequest({
        personalDetails: { firstName: "Jane", lastName: "Smith" },
        additionalInfo: { arcCardDigits: "1234567" },
        photoUpload: { imageUrl: "data:image/jpeg;base64,test" },
      })
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe(
      "ARC card issue duration must be between 1 and 12 months"
    );
  });

  it("returns 400 when the selected ARC card does not exist", async () => {
    mockTxGet.mockResolvedValueOnce({ empty: true, docs: [] });

    const response = await POST(
      createMockRequest({
        personalDetails: { firstName: "Jane", lastName: "Smith" },
        additionalInfo: {
          arcCardDigits: "1234567",
          arcCardDurationMonths: "2",
        },
        photoUpload: { imageUrl: "data:image/jpeg;base64,test" },
      })
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("Selected ARC Card does not exist");
  });

  it("handles Firestore errors gracefully", async () => {
    mockUserSet.mockRejectedValue(new Error("Firestore error"));

    const response = await POST(
      createMockRequest({
        personalDetails: { firstName: "John", lastName: "Doe" },
        photoUpload: { imageUrl: "data:image/jpeg;base64,test" },
      })
    );
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe("Firestore error");
  });
});
