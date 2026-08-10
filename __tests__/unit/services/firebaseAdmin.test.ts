import { createFirebaseAdminApp, initAdmin } from "@/app/services/firebaseAdmin";

// Mock the server-only package so it doesn't cause issues in the testing environment
jest.mock("server-only", () => ({}));

// Create controllable mocks for firebase-admin
const mockCert = jest.fn();
const mockInitializeApp = jest.fn();
const mockApp = jest.fn();
let mockAppsList: any[] = [];

jest.mock("firebase-admin", () => ({
  get apps() {
    return mockAppsList;
  },
  app: () => mockApp(),
  initializeApp: (...args: any[]) => mockInitializeApp(...args),
  credential: {
    cert: (...args: any[]) => mockCert(...args),
  },
}));

describe("Firebase Admin Initializer", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    mockAppsList = []; // Reset the list of active apps
    process.env = { ...originalEnv }; // Reset environment variables
  });

  afterAll(() => {
    process.env = originalEnv; // Restore original environment
  });

  describe("createFirebaseAdminApp", () => {
    const defaultParams = {
      projectId: "test-project-123",
      clientEmail: "admin@test-project-123.iam.gserviceaccount.com",
      storageBucket: "test-project-123.appspot.com",
      privateKey: "key-line-1\\nkey-line-2\\nkey-line-3", // Includes escaped newlines
    };

    it("should initialize a new App and format the private key if no app exists", () => {
      mockCert.mockReturnValueOnce({ mockCredential: true });
      mockInitializeApp.mockReturnValueOnce({ mockAppInstance: true });

      const app = createFirebaseAdminApp(defaultParams);

      // Verify private key formatting (converting literal "\\n" to actual "\n")
      expect(mockCert).toHaveBeenCalledWith({
        projectId: defaultParams.projectId,
        clientEmail: defaultParams.clientEmail,
        privateKey: "key-line-1\nkey-line-2\nkey-line-3", // Verified formatting
      });

      // Verify initializeApp parameterization
      expect(mockInitializeApp).toHaveBeenCalledWith({
        credential: { mockCredential: true },
        projectId: defaultParams.projectId,
        storageBucket: defaultParams.storageBucket,
      });

      expect(app).toEqual({ mockAppInstance: true });
    });

    it("should return the existing app instance and bypass initialization if an app is already initialized", () => {
      // Simulate an existing active application in the array
      mockAppsList.push({ name: "[DEFAULT]" });
      mockApp.mockReturnValueOnce({ existingAppInstance: true });

      const app = createFirebaseAdminApp(defaultParams);

      // Verify no new app was initialized
      expect(mockInitializeApp).not.toHaveBeenCalled();
      expect(mockCert).not.toHaveBeenCalled();

      // Verify the existing app was retrieved and returned
      expect(mockApp).toHaveBeenCalled();
      expect(app).toEqual({ existingAppInstance: true });
    });
  });

  describe("initAdmin", () => {
    it("should map process.env variables and invoke createFirebaseAdminApp", async () => {
      process.env.FIREBASE_PROJECT_ID = "env-project";
      process.env.FIREBASE_CLIENT_EMAIL = "env-email@test.com";
      process.env.FIREBASE_STORAGE_BUCKET = "env-bucket.appspot.com";
      process.env.FIREBASE_PRIVATE_KEY = "env-key\\nline-2";

      mockCert.mockReturnValueOnce({});
      mockInitializeApp.mockReturnValueOnce({ envApp: true });

      const app = await initAdmin();

      expect(mockCert).toHaveBeenCalledWith(
        expect.objectContaining({
          projectId: "env-project",
          clientEmail: "env-email@test.com",
          privateKey: "env-key\nline-2",
        })
      );
      expect(app).toEqual({ envApp: true });
    });
  });
});