import AdminRegistration from "@/app/register/page";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { signInWithEmailAndPassword } from "firebase/auth";

jest.mock("firebase/auth", () => ({
  getAuth: jest.fn(() => ({})),
  signInWithEmailAndPassword: jest.fn(() =>
    Promise.resolve({
      user: {
        getIdToken: jest.fn(() => Promise.resolve("mock-id-token")),
      },
    })
  ),
}));

global.fetch = jest.fn();

jest.mock("firebase/storage", () => ({
  getStorage: jest.fn(() => ({})),
}));

describe("AdminRegistration Component", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders without crashing", () => {
    render(<AdminRegistration />);
    expect(
      screen.getByRole("heading", { name: /Register/i })
    ).toBeInTheDocument();
  });

  it("displays all form fields", () => {
    render(<AdminRegistration />);
    expect(screen.getByLabelText(/First Name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Last Name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Identification Number/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Email Address/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Create Password/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Confirm Password/i)).toBeInTheDocument();
  });

  it("displays the submit button", () => {
    render(<AdminRegistration />);
    const button = screen.getByRole("button", { name: /Register/i });
    expect(button).toBeInTheDocument();
  });

  it("shows error messages for empty fields", async () => {
    render(<AdminRegistration />);
    fireEvent.click(screen.getByRole("button", { name: /Register/i }));

    await waitFor(() => {
      expect(screen.getByText(/First name is required/i)).toBeInTheDocument();
      expect(screen.getByText(/Last name is required/i)).toBeInTheDocument();
      expect(
        screen.getByText(/Identification number is required/i)
      ).toBeInTheDocument();
      expect(screen.getByText(/Email is required/i)).toBeInTheDocument();
      expect(
        screen.getByText(/Password must be at least 8 characters/i)
      ).toBeInTheDocument();
      expect(
        screen.getByText(/Confirm password is required/i)
      ).toBeInTheDocument();
    });
  });

  it("shows error message for mismatched passwords", async () => {
    render(<AdminRegistration />);
    fireEvent.change(screen.getByLabelText(/Create Password/i), {
      target: { value: "StrongPass123!" },
    });

    fireEvent.change(screen.getByLabelText(/Confirm Password/i), {
      target: { value: "DifferentPass123!" },
    });

    fireEvent.click(screen.getByRole("button", { name: /Register/i }));

    await waitFor(() => {
      expect(screen.getByText(/Passwords do not match/i)).toBeInTheDocument();
    });
  });

  it("handles successful registration and login flow", async () => {
    // Arrange: Mock the two API calls
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      // 1. Mock for /api/register-staff
      ok: true,
      json: async () => ({ success: true, uid: "test-uid" }),
    });

    render(<AdminRegistration />);

    // Act: Fill and submit the form
    fireEvent.change(screen.getByLabelText(/First Name/i), {
      target: { value: "John" },
    });
    fireEvent.change(screen.getByLabelText(/Last Name/i), {
      target: { value: "Doe" },
    });
    fireEvent.change(screen.getByLabelText(/Identification Number/i), {
      target: { value: "12345" },
    });
    fireEvent.change(screen.getByLabelText(/Email Address/i), {
      target: { value: "john.doe@example.com" },
    });
    fireEvent.change(screen.getByLabelText(/Create Password/i), {
      target: { value: "StrongPass123!" },
    });
    fireEvent.change(screen.getByLabelText(/Confirm Password/i), {
      target: { value: "StrongPass123!" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Register/i }));

    // Assert
    await waitFor(() => {
      expect(screen.getByText(/Registration successful/i)).toBeInTheDocument();
    });

    // 1. Verify /api/register-staff was called correctly
    expect(global.fetch).toHaveBeenCalledWith("/api/register-staff", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        firstName: "John",
        lastName: "Doe",
        email: "john.doe@example.com",
        password: "StrongPass123!",
        identificationNumber: "12345",
      }),
    });

    // 2. Verify signInWithEmailAndPassword was called to get the token
    expect(signInWithEmailAndPassword).toHaveBeenCalledWith(
      expect.anything(),
      "john.doe@example.com",
      "StrongPass123!"
    );
  });

  it("handles API failure for invalid identification number", async () => {
    // Arrange
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 403,
      json: async () => ({ error: "Invalid identification number" }),
    });

    render(<AdminRegistration />);

    fireEvent.change(screen.getByLabelText(/First Name/i), {
      target: { value: "Jane" },
    });
    fireEvent.change(screen.getByLabelText(/Last Name/i), {
      target: { value: "Doe" },
    });
    fireEvent.change(screen.getByLabelText(/Identification Number/i), {
      target: { value: "invalid-id" },
    });
    fireEvent.change(screen.getByLabelText(/Email Address/i), {
      target: { value: "jane.doe@example.com" },
    });
    fireEvent.change(screen.getByLabelText(/Create Password/i), {
      target: { value: "StrongPass123!" },
    });
    fireEvent.change(screen.getByLabelText(/Confirm Password/i), {
      target: { value: "StrongPass123!" },
    });

    // Act: Fill and submit form
    fireEvent.click(screen.getByRole("button", { name: /Register/i }));

    // Assert
    await waitFor(() => {
      expect(
        screen.getByText(/Invalid identification number/i)
      ).toBeInTheDocument();
    });
    expect(signInWithEmailAndPassword).not.toHaveBeenCalled();
  });

  it("handles API failure for email already in use", async () => {
    // Arrange
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 409,
      json: async () => ({ error: "Email is already in use" }),
    });

    render(<AdminRegistration />);

    // Act: Fill and submit form
    fireEvent.change(screen.getByLabelText(/Email Address/i), {
      target: { value: "existing@example.com" },
    });
    fireEvent.change(screen.getByLabelText(/First Name/i), {
      target: { value: "Jane" },
    });
    fireEvent.change(screen.getByLabelText(/Last Name/i), {
      target: { value: "Doe" },
    });
    fireEvent.change(screen.getByLabelText(/Identification Number/i), {
      target: { value: "invalid-id" },
    });
    fireEvent.change(screen.getByLabelText(/Create Password/i), {
      target: { value: "StrongPass123!" },
    });
    fireEvent.change(screen.getByLabelText(/Confirm Password/i), {
      target: { value: "StrongPass123!" },
    });

    fireEvent.click(screen.getByRole("button", { name: /Register/i }));

    // Assert
    await waitFor(() => {
      expect(screen.getByText(/Email is already in use/i)).toBeInTheDocument();
    });
    expect(signInWithEmailAndPassword).not.toHaveBeenCalled();
  });
});
