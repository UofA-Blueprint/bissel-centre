import { authService } from "@/app/services/authService";
import { signInWithEmailAndPassword, signOut } from "firebase/auth";
import { getDoc } from "firebase/firestore";

// 1. Mock firebase configuration to avoid live SDK interactions
jest.mock("@/app/services/firebase", () => ({
  auth: { currentUser: { uid: "mock-uid" } },
  db: {},
}));

// Mock firebase auth methods
jest.mock("firebase/auth", () => ({
  signInWithEmailAndPassword: jest.fn(),
  signOut: jest.fn(),
  onAuthStateChanged: jest.fn((_auth, callback) => {
    // Save callback so tests can simulate auth state changes
    (global as any).authCallback = callback;
    return jest.fn(); // Return mock unsubscribe
  }),
}));

// Mock firestore methods
jest.mock("firebase/firestore", () => ({
  doc: jest.fn().mockReturnValue({ id: "mock-doc-ref" }),
  getDoc: jest.fn(),
}));

describe("AuthService Singleton", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    
    // Reset private state of authService singleton between tests using a safe reset helper
    const service = authService as any;
    service.authState = { user: null, loading: false, error: null };
    service.listeners = [];
  });

  describe("Auth Listener & Subscription State", () => {
    it("should allow components to subscribe to auth state changes and trigger notifications", async () => {
      const listenerSpy = jest.fn();
      authService.subscribe(listenerSpy);

      // Setup simulated administrative_staff document from firestore
      (getDoc as jest.Mock).mockResolvedValueOnce({
        exists: () => true,
        id: "mock-uid",
        data: () => ({
          email: "admin@test.com",
          firstName: "John",
          lastName: "Doe",
          createdBy: "system",
          role: "admin",
        }),
      });

      // Simulate Firebase Auth state changing to authenticated
      const simulatedFirebaseUser = { uid: "mock-uid" };
      await (global as any).authCallback(simulatedFirebaseUser);

      // Verify that subscriber listener got triggered with mapped profile details
      expect(listenerSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          loading: false,
          user: {
            id: "mock-uid",
            email: "admin@test.com",
            firstName: "John",
            secondName: "Doe", // Verify lastName fallback to secondName
            createdBy: "system",
            role: "admin",
            isAuthenticated: true,
          },
        })
      );
    });

    it("should update authState to error if the user document is missing from administrative_staff", async () => {
      const listenerSpy = jest.fn();
      authService.subscribe(listenerSpy);

      // Simulate a Firebase authenticated user, but they do NOT have a profile in administrative_staff
      (getDoc as jest.Mock).mockResolvedValueOnce({
        exists: () => false,
      });

      const simulatedFirebaseUser = { uid: "mock-uid" };
      await (global as any).authCallback(simulatedFirebaseUser);

      expect(listenerSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          user: null,
          error: "Failed to fetch user profile",
        })
      );
    });
  });

  describe("signIn Process and Custom Error Mapping", () => {
    it("should sign in cleanly if credentials and Firestore profile match", async () => {
      (signInWithEmailAndPassword as jest.Mock).mockResolvedValueOnce({
        user: { uid: "alice-123" },
      });

      (getDoc as jest.Mock).mockResolvedValueOnce({
        exists: () => true,
        id: "alice-123",
        data: () => ({
          email: "alice@test.com",
          firstName: "Alice",
          secondName: "Smith",
          createdBy: "admin",
        }),
      });

      const user = await authService.signIn("alice@test.com", "password");

      expect(user.firstName).toBe("Alice");
      expect(authService.isAuthenticated()).toBe(true);
    });

    it("should map auth/invalid-credential into a descriptive error message", async () => {
      const mockError = { code: "auth/invalid-credential" };
      (signInWithEmailAndPassword as jest.Mock).mockRejectedValueOnce(mockError);

      await expect(authService.signIn("invalid@test.com", "wrong")).rejects.toThrow(
        "Invalid email or password. Please contact IT Admin if you need assistance."
      );

      expect(authService.getAuthState().error).toBe(
        "Invalid email or password. Please contact IT Admin if you need assistance."
      );
    });

    it("should deny access and throw error if user is missing in administrative_staff collection", async () => {
      (signInWithEmailAndPassword as jest.Mock).mockResolvedValueOnce({
        user: { uid: "unknown-uid" },
      });

      // Firebase authenticated, but firestore doc is missing
      (getDoc as jest.Mock).mockResolvedValueOnce({
        exists: () => false,
      });

      await expect(authService.signIn("unauthorized@test.com", "password")).rejects.toThrow(
        "Access denied. This login is for administrative staff only."
      );
    });
  });

  describe("signOut Lifecycle", () => {
    it("should sign out from Firebase and clear related user traces from localStorage", async () => {
      localStorage.setItem("rememberedEmail", "saved@test.com");
      (signOut as jest.Mock).mockResolvedValueOnce(undefined);

      await authService.signOut();

      expect(signOut).toHaveBeenCalled();
      expect(localStorage.getItem("rememberedEmail")).toBeNull();
    });
  });
});