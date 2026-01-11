import { POST } from "@/app/api/register-recipient/route";
import { NextRequest } from "next/server";
import { initAdmin } from "@/app/services/firebaseAdmin";
import { getFirestore } from "firebase-admin/firestore";
import { cookies } from "next/headers";

// Mock Next.js modules
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
}));

// Mock Firestore
const mockAdd = jest.fn();
const mockCollection = jest.fn(() => ({
  add: mockAdd,
}));

// Mock Firebase Admin Auth
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

    // Mock cookies
    (cookies as jest.Mock).mockResolvedValue(mockCookieStore);

    // Mock admin initialization
    (initAdmin as jest.Mock).mockResolvedValue({
      auth: mockAuth,
    });

    // Mock Firestore
    (getFirestore as jest.Mock).mockReturnValue({
      collection: mockCollection,
    });

    // Mock session cookie verification
    mockCookieStore.get.mockReturnValue({
      value: "valid-session-cookie",
    });
    mockVerifySessionCookie.mockResolvedValue({
      uid: "test-admin-uid",
    });

    // Mock Firestore add
    mockAdd.mockResolvedValue({
      id: "test-user-id",
    });
  });

  it("successfully creates a new recipient with valid data", async () => {
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
        notes: "Test notes",
      },
    };

    const req = createMockRequest(requestBody);
    const response = await POST(req);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.success).toBe(true);
    expect(data.userId).toBe("test-user-id");
    expect(mockCollection).toHaveBeenCalledWith("users");
    expect(mockAdd).toHaveBeenCalledWith(
      expect.objectContaining({
        firstName: "John",
        secondName: "Doe",
        genderIdentity: "Male",
        aliases: ["Johnny"],
        dateOfBirth: "1990-01-01",
        arcCardNumber: "1234567",
        address: "123 Main St",
        postalCode: "12345",
        passesIssued: [],
        banned: false,
        banReason: null,
        notes: "Test notes",
        createdBy: "test-admin-uid",
        phone: "555-1234",
        email: "john@example.com",
        journey: "Applied for the Ride Transit/LAP programs",
        mostCommonReason: "Health and Wellness",
        secondMostCommonReason: "Food Security",
        housingOption: "Emergency Sheltered",
      })
    );
  });

  it("returns 401 when no session cookie is present", async () => {
    mockCookieStore.get.mockReturnValue(undefined);

    const requestBody = {
      personalDetails: {
        firstName: "John",
        lastName: "Doe",
      },
    };

    const req = createMockRequest(requestBody);
    const response = await POST(req);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe("Unauthorized - No session found");
    expect(mockAdd).not.toHaveBeenCalled();
  });

  it("returns 401 when session verification fails", async () => {
    mockVerifySessionCookie.mockRejectedValue(new Error("Invalid session"));

    const requestBody = {
      personalDetails: {
        firstName: "John",
        lastName: "Doe",
      },
    };

    const req = createMockRequest(requestBody);
    const response = await POST(req);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBeTruthy();
    expect(mockAdd).not.toHaveBeenCalled();
  });

  it("returns 400 when personalDetails is missing", async () => {
    const requestBody = {
      additionalInfo: {
        journey: "Test journey",
      },
    };

    const req = createMockRequest(requestBody);
    const response = await POST(req);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("Personal details are required");
    expect(mockAdd).not.toHaveBeenCalled();
  });

  it("returns 400 when firstName is missing", async () => {
    const requestBody = {
      personalDetails: {
        lastName: "Doe",
      },
    };

    const req = createMockRequest(requestBody);
    const response = await POST(req);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("firstName is required");
    expect(mockAdd).not.toHaveBeenCalled();
  });

  it("returns 400 when lastName is missing", async () => {
    const requestBody = {
      personalDetails: {
        firstName: "John",
      },
    };

    const req = createMockRequest(requestBody);
    const response = await POST(req);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("lastName is required");
    expect(mockAdd).not.toHaveBeenCalled();
  });

  it("handles optional fields correctly", async () => {
    const requestBody = {
      personalDetails: {
        firstName: "Jane",
        lastName: "Smith",
      },
    };

    const req = createMockRequest(requestBody);
    const response = await POST(req);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(mockAdd).toHaveBeenCalledWith(
      expect.objectContaining({
        firstName: "Jane",
        secondName: "Smith",
        aliases: [],
        genderIdentity: null,
        phone: null,
        email: null,
        dateOfBirth: null,
        address: null,
        postalCode: null,
        arcCardNumber: null,
        notes: null,
        journey: null,
        mostCommonReason: null,
        secondMostCommonReason: null,
        housingOption: null,
      })
    );
  });

  it("converts single alias to array format", async () => {
    const requestBody = {
      personalDetails: {
        firstName: "John",
        lastName: "Doe",
        alias: "Johnny",
      },
    };

    const req = createMockRequest(requestBody);
    const response = await POST(req);

    expect(response.status).toBe(201);
    expect(mockAdd).toHaveBeenCalledWith(
      expect.objectContaining({
        aliases: ["Johnny"],
      })
    );
  });

  it("sets empty array for aliases when no alias provided", async () => {
    const requestBody = {
      personalDetails: {
        firstName: "John",
        lastName: "Doe",
      },
    };

    const req = createMockRequest(requestBody);
    const response = await POST(req);

    expect(response.status).toBe(201);
    expect(mockAdd).toHaveBeenCalledWith(
      expect.objectContaining({
        aliases: [],
      })
    );
  });

  it("sets correct default values for required schema fields", async () => {
    const requestBody = {
      personalDetails: {
        firstName: "John",
        lastName: "Doe",
      },
    };

    const req = createMockRequest(requestBody);
    const response = await POST(req);

    expect(response.status).toBe(201);
    expect(mockAdd).toHaveBeenCalledWith(
      expect.objectContaining({
        picture: null,
        passesIssued: [],
        banned: false,
        banReason: null,
        createdBy: "test-admin-uid",
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      })
    );
  });

  it("handles Firestore errors gracefully", async () => {
    mockAdd.mockRejectedValue(new Error("Firestore error"));

    const requestBody = {
      personalDetails: {
        firstName: "John",
        lastName: "Doe",
      },
    };

    const req = createMockRequest(requestBody);
    const response = await POST(req);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe("Firestore error");
  });
});
