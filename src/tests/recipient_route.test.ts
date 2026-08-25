jest.mock("next/server", () => ({
  NextResponse: {
    json: (data: unknown, init?: ResponseInit) => ({
      json: async () => data,
      status: init?.status || 200,
    }),
  },
}));

jest.mock("firebase-admin/firestore", () => ({
  FieldValue: {
    serverTimestamp: jest.fn(() => "server-timestamp"),
  },
}));

jest.mock("@/app/api/_lib/staffAccess", () => ({
  getStaffAccess: jest.fn(),
}));

jest.mock("@/utils/phoneEncryption", () => ({
  encryptPhone: jest.fn((value: string | null) =>
    value ? `encrypted:${value}` : null,
  ),
  decryptPhone: jest.fn((value: string | null) =>
    value?.startsWith("encrypted:") ? value.slice("encrypted:".length) : null,
  ),
}));

import { GET, PATCH } from "@/app/api/recipients/[id]/route";
import { getStaffAccess } from "@/app/api/_lib/staffAccess";

const mockGetStaffAccess = getStaffAccess as jest.MockedFunction<
  typeof getStaffAccess
>;

function request(body?: unknown): Request {
  return {
    json: async () => body,
  } as Request;
}

function params(id = "recipient-1") {
  return { params: Promise.resolve({ id }) };
}

describe("recipient profile API", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  test("rejects requests without staff access", async () => {
    mockGetStaffAccess.mockResolvedValue({
      error: "Unauthorized",
      status: 401,
    });

    const response = await GET(request() as any, params());

    expect(response.status).toBe(401);
  });

  test("returns a staff recipient with decrypted phone", async () => {
    const userGet = jest.fn().mockResolvedValue({
      exists: true,
      id: "recipient-1",
      data: () => ({
        firstName: "Alex",
        secondName: "Doe",
        aliases: ["A"],
        phone: "encrypted:7805551234",
        email: "alex@example.com",
        postalCode: "T5Z1H3",
        picture: "data:image/jpeg;base64,photo",
      }),
    });
    const db = {
      collection: jest.fn((name: string) => {
        if (name === "users") return { doc: jest.fn(() => ({ get: userGet })) };
        const get = jest.fn().mockResolvedValue({ docs: [], empty: true });
        return {
          where: jest.fn(() => ({
            get,
            limit: jest.fn(() => ({ get })),
          })),
        };
      }),
    };
    mockGetStaffAccess.mockResolvedValue({ db, uid: "staff-1" } as any);

    const response = await GET(request() as any, params());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.personalDetails.phone).toBe("7805551234");
    expect(body.personalDetails.firstName).toBe("Alex");
    expect(body.photoUpload.imageUrl).toContain("data:image/jpeg");
  });

  test("updates the profile and writes an audit record", async () => {
    const update = jest.fn();
    const create = jest.fn();
    const commit = jest.fn().mockResolvedValue(undefined);
    const recipientRef = {
      get: jest.fn().mockResolvedValue({
        exists: true,
        data: () => ({
          firstName: "Alex",
          secondName: "Doe",
          phone: "encrypted:7805551234",
        }),
      }),
    };
    const db = {
      collection: jest.fn((name: string) => {
        if (name === "users") return { doc: jest.fn(() => recipientRef) };
        return { doc: jest.fn(), add: jest.fn() };
      }),
      batch: jest.fn(() => ({ update, create, commit })),
    };
    mockGetStaffAccess.mockResolvedValue({ db, uid: "staff-1" } as any);

    const response = await PATCH(
      request({
        personalDetails: {
          firstName: "Alexandra",
          lastName: "Doe",
          email: "alex@example.com",
          phone: "7805559999",
          postalCode: "T5Z 1H3",
        },
        additionalInfo: {},
        photoUpload: { imageUrl: "data:image/jpeg;base64,photo" },
      }) as any,
      params(),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(update).toHaveBeenCalledWith(
      recipientRef,
      expect.objectContaining({
        firstName: "Alexandra",
        phone: "encrypted:7805559999",
      }),
    );
    expect(create).toHaveBeenCalledTimes(1);
    expect(create.mock.calls[0][1]).toEqual(
      expect.objectContaining({
        userId: "recipient-1",
        modifiedBy: "staff-1",
        event: "Profile Update",
      }),
    );
    expect(commit).toHaveBeenCalled();
  });
});