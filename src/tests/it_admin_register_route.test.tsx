import { POST } from "@/app/admin/api/create-admin/route";
import * as adminActions from "@/app/admin/actions";
import { NextRequest } from "next/server";

// Simple NextResponse mock
jest.mock("next/server", () => ({
  NextRequest: jest.fn(),
  NextResponse: {
    json: (data: any, init?: ResponseInit) => ({
      json: async () => data,
      status: init?.status || 200,
    }),
  },
}));

// mock the admin actions module
jest.mock("@/app/admin/actions");

// mock NextRequest
const mockNextRequest = (body: any): NextRequest => {
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

describe("POST /admin/api/create-admin", () => {
  afterEach(() => {
    jest.resetAllMocks();
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
  });

  test("propagates Firebase email-already-exists error with 409", async () => {
    mockCheckAdmin.mockResolvedValue(true);
    const err: any = new Error(
      "The email address is already in use by another account."
    );
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
