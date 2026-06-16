import { POST } from "@/app/admin/api/get-custom-token/route";
import * as adminActions from "@/app/admin/actions";

// Simple NextResponse mock (matches other tests)
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

// helper to create a mock Request-like object with json()
const mockNextRequest = (body: any): Request => {
  return {
    json: async () => body,
  } as unknown as Request;
};

// typed mocked function
const mockHandleITAdminLogin =
  adminActions.handleITAdminLogin as jest.MockedFunction<
    typeof adminActions.handleITAdminLogin
  >;

describe("POST /admin/api/get-custom-token", () => {
  afterEach(() => {
    jest.resetAllMocks();
  });

  test("returns 400 when identificationNumber missing", async () => {
    const req = mockNextRequest({});
    const res = await POST(req);
    const json = await (res as Response).json();
    expect(json.error).toMatch(/Missing identificationNumber/i);
    expect((res as Response).status).toBe(400);
  });

  test("returns 401 when credentials invalid (null token)", async () => {
    mockHandleITAdminLogin.mockResolvedValue(null);
    const req = mockNextRequest({ identificationNumber: "ID123" });
    const res = await POST(req);
    const json = await (res as Response).json();
    expect(json.error).toBe("Invalid credentials");
    expect((res as Response).status).toBe(401);
    expect(mockHandleITAdminLogin).toHaveBeenCalledWith("ID123");
  });

  test("returns customToken on success and trims input", async () => {
    mockHandleITAdminLogin.mockResolvedValue("CUSTOM_TOKEN_ABC");
    const req = mockNextRequest({ identificationNumber: "  ID_TRIM  " });
    const res = await POST(req);
    const json = await (res as Response).json();
    expect(json.customToken).toBe("CUSTOM_TOKEN_ABC");
    expect((res as Response).status).toBe(200);
    expect(mockHandleITAdminLogin).toHaveBeenCalledWith("ID_TRIM");
  });

  test("returns 500 on internal error", async () => {
    mockHandleITAdminLogin.mockRejectedValue(new Error("boom"));
    const req = mockNextRequest({ identificationNumber: "ID500" });
    const res = await POST(req);
    const json = await (res as Response).json();
    expect(json.error).toMatch(/Internal server error/i);
    expect((res as Response).status).toBe(500);
    expect(mockHandleITAdminLogin).toHaveBeenCalledWith("ID500");
  });
});
