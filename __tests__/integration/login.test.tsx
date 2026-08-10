import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import LoginPage from "@/app/login/page";
import { signInWithEmailAndPassword, sendPasswordResetEmail } from "firebase/auth";

// 1. Mock next/navigation router
const mockPush = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

// 2. Mock Firebase Services
jest.mock("firebase/auth", () => ({
  getAuth: jest.fn(() => ({})),
  signInWithEmailAndPassword: jest.fn(),
  sendPasswordResetEmail: jest.fn(),
}));

jest.mock("@/app/services/firebase", () => ({
  auth: { currentUser: { getIdToken: jest.fn() } },
}));

// 3. Mock BackNavigation component to isolate page logic
jest.mock("@/app/components/BackNavigation", () => {
  return function DummyBackNavigation({ href, label }: { href: string; label: string }) {
    return <div data-testid="back-nav">{label} ({href})</div>;
  };
});

// 4. Mock global fetch
global.fetch = jest.fn();

describe("LoginPage Component", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
  });

  describe("Initial Render and LocalStorage", () => {
    it("should render the login form elements correctly", () => {
      render(<LoginPage />);

      expect(screen.getByRole("heading", { name: /Sign In/i })).toBeInTheDocument();
      expect(screen.getByLabelText(/Email Address/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/^Password$/i)).toBeInTheDocument();
      expect(screen.getByRole("checkbox", { name: /Remember me/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Forgot Password/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /^Sign In$/i })).toBeInTheDocument();
    });

    it("should pre-populate the email input if a rememberedEmail exists in localStorage", () => {
      localStorage.setItem("rememberedEmail", "saved.user@example.com");

      render(<LoginPage />);

      const emailInput = screen.getByLabelText(/Email Address/i) as HTMLInputElement;
      const rememberCheckbox = screen.getByRole("checkbox", { name: /Remember me/i }) as HTMLInputElement;

      expect(emailInput.value).toBe("saved.user@example.com");
      expect(rememberCheckbox.checked).toBe(true);
    });
  });

  describe("Login Action Flow", () => {
    it("should successfully log in, store email to localStorage if rememberMe is true, and redirect to dashboard", async () => {
      // Setup mock firebase auth success
      const mockGetIdToken = jest.fn().mockResolvedValue("mock-firebase-token");
      (signInWithEmailAndPassword as jest.Mock).mockResolvedValueOnce({
        user: { getIdToken: mockGetIdToken },
      });

      // Setup mock fetch success responses
      (global.fetch as jest.Mock).mockImplementation((url) => {
        if (url === "/api/authorise-staff") {
          return Promise.resolve({
            ok: true,
            json: async () => ({ success: true }),
          });
        }
        if (url === "/api/session-login") {
          return Promise.resolve({
            ok: true,
            json: async () => ({ success: true }),
          });
        }
        return Promise.reject(new Error("Unknown fetch endpoint"));
      });

      render(<LoginPage />);

      // Fill in fields
      fireEvent.change(screen.getByLabelText(/Email Address/i), {
        target: { value: "Test.User@example.com" }, // check casing normalization
      });
      fireEvent.change(screen.getByLabelText(/^Password$/i), {
        target: { value: "password123" },
      });

      // Check remember me box
      const rememberCheckbox = screen.getByRole("checkbox", { name: /Remember me/i });
      fireEvent.click(rememberCheckbox);

      // Submit Form
      fireEvent.click(screen.getByRole("button", { name: /^Sign In$/i }));

      // Wait for process to complete
      await waitFor(() => {
        expect(signInWithEmailAndPassword).toHaveBeenCalledWith(
          expect.anything(),
          "test.user@example.com", // normalized (lowercased) email
          "password123"
        );
      });

      await waitFor(() => {
        // Assert authorization & session API endpoints were hit correctly
        expect(global.fetch).toHaveBeenCalledWith("/api/authorise-staff", expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            Authorization: "Bearer mock-firebase-token",
          }),
        }));

        expect(global.fetch).toHaveBeenCalledWith("/api/session-login", expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ idToken: "mock-firebase-token" }),
        }));
      });

      await waitFor(() => {
        // Assert email is saved to localStorage (normalized)
        expect(localStorage.getItem("rememberedEmail")).toBe("test.user@example.com");
        // Assert redirect occurred
        expect(mockPush).toHaveBeenCalledWith("/dashboard");
      });
    });

    it("should display an error if Firebase authentication fails due to invalid credentials", async () => {
      // Mock failure inside firebase auth
      const firebaseError = new Error("auth/invalid-credential");
      (signInWithEmailAndPassword as jest.Mock).mockRejectedValueOnce(firebaseError);

      render(<LoginPage />);

      fireEvent.change(screen.getByLabelText(/Email Address/i), {
        target: { value: "user@example.com" },
      });
      fireEvent.change(screen.getByLabelText(/^Password$/i), {
        target: { value: "wrongpassword" },
      });

      fireEvent.click(screen.getByRole("button", { name: /^Sign In$/i }));

      await waitFor(() => {
        expect(screen.getByText(/Invalid email or password. Please try again./i)).toBeInTheDocument();
      });
    });

    it("should display an error if Staff authorization fails (Access Denied)", async () => {
      // Mock successful firebase login
      const mockGetIdToken = jest.fn().mockResolvedValue("mock-firebase-token");
      (signInWithEmailAndPassword as jest.Mock).mockResolvedValueOnce({
        user: { getIdToken: mockGetIdToken },
      });

      // Mock /api/authorise-staff returning non-OK status
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: async () => ({ error: "Staff authorization failed" }),
      });

      render(<LoginPage />);

      fireEvent.change(screen.getByLabelText(/Email Address/i), {
        target: { value: "user@example.com" },
      });
      fireEvent.change(screen.getByLabelText(/^Password$/i), {
        target: { value: "password" },
      });

      fireEvent.click(screen.getByRole("button", { name: /^Sign In$/i }));

      await waitFor(() => {
        expect(
          screen.getByText(/Access denied. Please contact IT Admin if you need assistance./i)
        ).toBeInTheDocument();
      });
    });
  });

  describe("Forgot Password Flow", () => {
    it("should open the modal, submit a password reset request, and show success status", async () => {
      (sendPasswordResetEmail as jest.Mock).mockResolvedValueOnce(undefined);

      render(<LoginPage />);

      // Open Modal
      const forgotBtn = screen.getByRole("button", { name: /Forgot Password/i });
      fireEvent.click(forgotBtn);

      // Verify modal elements are visible
      expect(screen.getByRole("heading", { name: /Reset Password/i })).toBeInTheDocument();
      expect(screen.getByLabelText(/Enter your email address/i)).toBeInTheDocument();

      // Enter email in modal
      const modalEmailInput = screen.getByLabelText(/Enter your email address/i);
      fireEvent.change(modalEmailInput, {
        target: { value: "Forgot.User@example.com" },
      });

      // Submit modal form
      const submitResetBtn = screen.getByRole("button", { name: /Send Reset Email/i });
      fireEvent.click(submitResetBtn);

      await waitFor(() => {
        expect(sendPasswordResetEmail).toHaveBeenCalledWith(
          expect.anything(),
          "forgot.user@example.com" // normalized email
        );
      });

      await waitFor(() => {
        expect(
          screen.getByText(/A password reset email has been sent if the address exists/i)
        ).toBeInTheDocument();
      });

      // Close the modal
      const closeBtn = screen.getByRole("button", { name: /Close/i });
      fireEvent.click(closeBtn);

      // Modal heading should no longer be on screen
      expect(screen.queryByRole("heading", { name: /Reset Password/i })).not.toBeInTheDocument();
    });

    it("should handle error states for forgot password actions", async () => {
      const authError = { code: "auth/user-not-found" };
      (sendPasswordResetEmail as jest.Mock).mockRejectedValueOnce(authError);

      render(<LoginPage />);

      // Open Modal
      fireEvent.click(screen.getByRole("button", { name: /Forgot Password/i }));

      // Input email and submit
      fireEvent.change(screen.getByLabelText(/Enter your email address/i), {
        target: { value: "notfound@example.com" },
      });
      fireEvent.click(screen.getByRole("button", { name: /Send Reset Email/i }));

      await waitFor(() => {
        expect(screen.getByText(/No account found with that email address./i)).toBeInTheDocument();
      });
    });
  });
});