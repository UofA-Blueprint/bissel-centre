/* eslint-disable  @typescript-eslint/no-explicit-any */

// --- Top-level firebase-admin mock (self-contained to avoid hoisting issues) ---
jest.mock("firebase-admin", () => {
  const mockSet = jest.fn();
  const mockDoc = jest.fn(() => ({ set: mockSet }));
  const mockCollection = jest.fn(() => ({ doc: mockDoc }));
  const firestoreFn: any = jest.fn(() => ({ collection: mockCollection }));
  firestoreFn.FieldValue = { serverTimestamp: jest.fn(() => "mock-ts") };

  // expose mocks for test assertions
  (global as any)._mockSet = mockSet;
  (global as any)._mockDoc = mockDoc;
  (global as any)._mockCollection = mockCollection;
  (global as any)._firestoreFn = firestoreFn;

  return {
    __esModule: true,
    default: {
      firestore: firestoreFn,
    },
  };
});

jest.mock("@/app/services/firebaseAdmin", () => ({
  initAdmin: jest.fn(async () => ({})),
}));

// Simple NextResponse mock
jest.mock("next/server", () => ({
  NextRequest: jest.fn(),
  NextResponse: {
    json: (data: unknown, init?: ResponseInit) => ({
      json: async () => data,
      status: init?.status || 200,
    }),
  },
}));

// mock the admin actions module (auto-mocked; we'll assert on the mocked functions)
jest.mock("@/app/admin/actions");

// Now import the module under test after mocks are in place
import { POST } from "@/app/admin/api/create-admin/route";
import * as adminActions from "@/app/admin/actions";
import { NextRequest } from "next/server";

// mock NextRequest helper
const mockNextRequest = <T = unknown,>(body: T): NextRequest => {
  return {
    json: async () => body,
  } as unknown as NextRequest;
};

// type assertion for mocked functions
const mockCreateAdmin = adminActions.createAdmin as jest.MockedFunction<
  typeof adminActions.createAdmin
>;
const mockCheckAdmin = adminActions.checkAdmin as jest.MockedFunction<
  typeof adminActions.checkAdmin
>;

// read mock helpers exposed by the firebase-admin mock
const mockSet = (global as any)._mockSet as jest.Mock;
const mockDoc = (global as any)._mockDoc as jest.Mock;
const mockCollection = (global as any)._mockCollection as jest.Mock;

describe("POST /admin/api/create-admin", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  test("returns 400 when required fields missing", async () => {
    const req = mockNextRequest({ email: "a@b.com" }); // missing firstName/lastName/identificationNumber
    const res = await POST(req);
    const json = await (res as Response).json();
    expect(json.error).toMatch(/Missing required fields/i);
    expect((res as Response).status).toBe(400);
  });

  test("returns 403 when requester not authorized", async () => {
    mockCheckAdmin.mockResolvedValue(false);
    const req = mockNextRequest({
      email: "a@b.com",
      firstName: "A",
      lastName: "B",
      identificationNumber: "ID123",
    });
    const res = await POST(req);
    const json = await (res as Response).json();
    expect(json.error).toBe("Not authorized");
    expect((res as Response).status).toBe(403);
    expect(mockCheckAdmin).toHaveBeenCalledWith("ID123");
  });

  // This is the test that was timing out
  test("returns uid and rawId on success", async () => {
    mockCheckAdmin.mockResolvedValue(true);
    mockCreateAdmin.mockResolvedValue({
      user: { uid: "uid123" },
      rawId: "RAWID12345",
    });

    const req = mockNextRequest({
      email: "new@b.com",
      firstName: "First",
      lastName: "Last",
      identificationNumber: "ID123",
    });

    const res = await POST(req);
    const json = await (res as Response).json();

    expect(json.success).toBe(true);
    expect(json.uid).toBe("uid123");
    expect(json.rawId).toBe("RAWID12345");
    expect((res as Response).status).toBe(200);
    expect(mockCheckAdmin).toHaveBeenCalledWith("ID123");
    expect(mockCreateAdmin).toHaveBeenCalledWith("new@b.com", "First Last");

    // Assert that the firestore 'set' method was called correctly
    expect(mockCollection).toHaveBeenCalledWith("it_admins");
    expect(mockDoc).toHaveBeenCalledWith("uid123");
    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({
        uid: "uid123",
        firstName: "First",
        lastName: "Last",
        email: "new@b.com",
      }),
    );
  });

  test("propagates Firebase email-already-exists error with 409", async () => {
    mockCheckAdmin.mockResolvedValue(true);
    const err = new Error(
      "The email address is already in use by another account.",
    ) as Error & { code?: string };
    err.code = "auth/email-already-exists";
    mockCreateAdmin.mockRejectedValue(err);

    const req = mockNextRequest({
      email: "exists@b.com",
      firstName: "First",
      lastName: "Last",
      identificationNumber: "ID123",
    });

    const res = await POST(req);
    const json = await (res as Response).json();
    expect(json.error).toMatch(/already in use/i);
    expect((res as Response).status).toBe(409);
  });
});
