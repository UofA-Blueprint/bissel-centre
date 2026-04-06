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
  encryptPhone: jest.fn((phone) => {
    return phone ? `encrypted_${phone}` : null;
  }),
}));

const mockBatchSet = jest.fn();
const mockBatchUpdate = jest.fn();
const mockBatchCommit = jest.fn();
const mockBatch = jest.fn(() => ({
  set: mockBatchSet,
  update: mockBatchUpdate,
  commit: mockBatchCommit,
}));

const mockCardQueryGet = jest.fn();
const mockArcCardsQuery = {
  where: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  get: mockCardQueryGet,
};

const mockUsersCollection = {
  doc: jest.fn(),
};

const mockIssuesCollection = {
  doc: jest.fn(),
};

const mockArcCardsCollection = jest.fn(() => mockArcCardsQuery);
const mockCollection = jest.fn((name: string) => {
  if (name === "users") {
    return mockUsersCollection;
  }

  if (name === "issues") {
    return mockIssuesCollection;
  }

  if (name === "arc_cards") {
    return mockArcCardsCollection();
  }

  return {};
});

const mockVerifySessionCookie = jest.fn();
const mockAuth = jest.fn(() => ({
  verifySessionCookie: mockVerifySessionCookie,
}));

describe("POST /api/register-recipient", () => {
  const mockCookieStore = {
    get: jest.fn(),
  };

  const mockUserRef = {
    id: "test-user-id",
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
        }),
      },
    ],
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
      batch: mockBatch,
    });

    mockCookieStore.get.mockReturnValue({
      value: "valid-session-cookie",
    });
    mockVerifySessionCookie.mockResolvedValue({
      uid: "test-admin-uid",
    });

    mockUsersCollection.doc.mockReturnValue(mockUserRef);
    mockIssuesCollection.doc.mockReturnValue(mockIssueRef);
    mockCardQueryGet.mockResolvedValue(mockCardSnapshot);
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
    expect(mockCollection).toHaveBeenCalledWith("users");
    expect(mockCollection).toHaveBeenCalledWith("arc_cards");
    expect(mockCollection).toHaveBeenCalledWith("issues");
    expect(mockArcCardsQuery.where).toHaveBeenCalledWith(
      "arcCardNumber",
      "==",
      "1234567",
    );
    expect(mockArcCardsQuery.where).toHaveBeenCalledWith(
      "currentUserId",
      "==",
      null,
    );
    expect(mockBatchSet).toHaveBeenCalledWith(
      mockUserRef,
      expect.objectContaining({
        firstName: "John",
        secondName: "Doe",
        picture: "data:image/jpeg;base64,test-image-data",
        genderIdentity: "Male",
        aliases: ["Johnny"],
        dateOfBirth: "1990-01-01",
        address: "123 Main St",
        postalCode: "12345",
        passesIssued: [],
        banned: false,
        banReason: null,
        notes: "Test notes",
        createdBy: "test-admin-uid",
        phone: "encrypted_555-1234",
        email: "john@example.com",
        journey: "Applied for the Ride Transit/LAP programs",
        mostCommonReason: "Health and Wellness",
        secondMostCommonReason: "Food Security",
        housingOption: "Emergency Sheltered",
      }),
    );
    expect(mockBatchUpdate).toHaveBeenCalledWith(mockCardRef, {
      currentUserId: "test-user-id",
    });
    expect(mockBatchSet).toHaveBeenCalledWith(
      mockIssueRef,
      expect.objectContaining({
        cardId: mockCardRef.id,
        userId: "test-user-id",
        issuedBy: "test-admin-uid",
        notes: "",
        returnedAt: null,
        createdAt: expect.any(Object),
        issueDate: expect.any(Object),
        expiresAt: expect.objectContaining({
          date: expect.any(Date),
        }),
      }),
    );
    expect(mockBatchCommit).toHaveBeenCalledTimes(1);
  });

  it("returns 401 when no session cookie is present", async () => {
    mockCookieStore.get.mockReturnValue(undefined);

    const requestBody = {
      personalDetails: {
        firstName: "John",
        lastName: "Doe",
      },
      photoUpload: {
        imageUrl: "data:image/jpeg;base64,test-image-data",
      },
    };

    const req = createMockRequest(requestBody);
    const response = await POST(req);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe("Unauthorized - No session found");
    expect(mockBatchCommit).not.toHaveBeenCalled();
  });

  it("returns 500 when session verification fails", async () => {
    mockVerifySessionCookie.mockRejectedValue(new Error("Invalid session"));

    const requestBody = {
      personalDetails: {
        firstName: "John",
        lastName: "Doe",
      },
      photoUpload: {
        imageUrl: "data:image/jpeg;base64,test-image-data",
      },
    };

    const req = createMockRequest(requestBody);
    const response = await POST(req);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBeTruthy();
    expect(mockBatchCommit).not.toHaveBeenCalled();
  });

  it("returns 400 when personalDetails is missing", async () => {
    const requestBody = {
      additionalInfo: {
        journey: "Test journey",
      },
      photoUpload: {
        imageUrl: "data:image/jpeg;base64,test-image-data",
      },
    };

    const req = createMockRequest(requestBody);
    const response = await POST(req);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("Personal details are required");
    expect(mockBatchCommit).not.toHaveBeenCalled();
  });

  it("returns 400 when photoUpload is missing", async () => {
    const requestBody = {
      personalDetails: {
        firstName: "John",
        lastName: "Doe",
      },
    };

    const req = createMockRequest(requestBody);
    const response = await POST(req);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("Recipient photo is required");
    expect(mockBatchCommit).not.toHaveBeenCalled();
  });

  it("returns 400 when firstName is missing", async () => {
    const requestBody = {
      personalDetails: {
        lastName: "Doe",
      },
      photoUpload: {
        imageUrl: "data:image/jpeg;base64,test-image-data",
      },
    };

    const req = createMockRequest(requestBody);
    const response = await POST(req);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("firstName is required");
    expect(mockBatchCommit).not.toHaveBeenCalled();
  });

  it("returns 400 when lastName is missing", async () => {
    const requestBody = {
      personalDetails: {
        firstName: "John",
      },
      photoUpload: {
        imageUrl: "data:image/jpeg;base64,test-image-data",
      },
    };

    const req = createMockRequest(requestBody);
    const response = await POST(req);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("lastName is required");
    expect(mockBatchCommit).not.toHaveBeenCalled();
  });

  it("creates only the user record when no ARC card is selected", async () => {
    const requestBody = {
      personalDetails: {
        firstName: "Jane",
        lastName: "Smith",
      },
      photoUpload: {
        imageUrl: "data:image/jpeg;base64,test-image-data",
      },
    };

    const req = createMockRequest(requestBody);
    const response = await POST(req);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.userId).toBe("test-user-id");
    expect(mockBatchSet).toHaveBeenCalledWith(
      mockUserRef,
      expect.objectContaining({
        firstName: "Jane",
        secondName: "Smith",
        picture: "data:image/jpeg;base64,test-image-data",
        aliases: [],
        genderIdentity: null,
        phone: null,
        email: null,
        dateOfBirth: null,
        address: null,
        postalCode: null,
        notes: null,
        journey: null,
        mostCommonReason: null,
        secondMostCommonReason: null,
        housingOption: null,
      }),
    );
    expect(mockBatchUpdate).not.toHaveBeenCalled();
    expect(mockBatchCommit).toHaveBeenCalledTimes(1);
  });

  it("returns 400 when an ARC card is selected without an issue duration", async () => {
    const requestBody = {
      personalDetails: {
        firstName: "Jane",
        lastName: "Smith",
      },
      additionalInfo: {
        arcCardDigits: "1234567",
      },
      photoUpload: {
        imageUrl: "data:image/jpeg;base64,test-image-data",
      },
    };

    const req = createMockRequest(requestBody);
    const response = await POST(req);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("ARC card issue duration is required");
    expect(mockBatchCommit).not.toHaveBeenCalled();
  });

  it("returns 400 when the selected ARC card is not available", async () => {
    mockCardQueryGet.mockResolvedValueOnce({
      empty: true,
      docs: [],
    });

    const requestBody = {
      personalDetails: {
        firstName: "Jane",
        lastName: "Smith",
      },
      additionalInfo: {
        arcCardDigits: "1234567",
        arcCardDurationMonths: "2",
      },
      photoUpload: {
        imageUrl: "data:image/jpeg;base64,test-image-data",
      },
    };

    const req = createMockRequest(requestBody);
    const response = await POST(req);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("Selected ARC card is not available");
    expect(mockBatchCommit).not.toHaveBeenCalled();
  });

  it("handles Firestore errors gracefully", async () => {
    mockBatchCommit.mockRejectedValue(new Error("Firestore error"));

    const requestBody = {
      personalDetails: {
        firstName: "John",
        lastName: "Doe",
      },
      photoUpload: {
        imageUrl: "data:image/jpeg;base64,test-image-data",
      },
    };

    const req = createMockRequest(requestBody);
    const response = await POST(req);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe("Firestore error");
  });
});
