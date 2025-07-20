import AdminRegistration from "@/app/register/page";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

jest.mock("firebase/auth", () => ({
  getAuth: jest.fn(() => ({})),
  createUserWithEmailAndPassword: jest.fn(),
  signInWithEmailAndPassword: jest.fn(),
}));

jest.mock("firebase/firestore", () => ({
  collection: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
  getDocs: jest.fn(),
  addDoc: jest.fn(),
  getFirestore: jest.fn(() => ({})),
  Timestamp: {
    now: jest.fn(() => ({})),
  },
}));

global.fetch = jest.fn();

jest.mock("firebase/storage", () => ({
  getStorage: jest.fn(() => ({})),
}));

import { createUserWithEmailAndPassword } from "firebase/auth";
import { addDoc } from "firebase/firestore";

describe("IT Admin Registration Page", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders without crashing", () => {
    render(<AdminRegistration />);
    const heading = screen.getByRole("heading", {
      level: 1,
      name: /Register/i,
    });
    expect(heading).toBeInTheDocument();
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

  it("handles form submission with valid data", async () => {
    // Mock the API call to verify-admin
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        hashedID: "mock-hashed-id",
      }),
    });

    // Mock successful firebase response
    (createUserWithEmailAndPassword as jest.Mock).mockResolvedValueOnce({
      user: {
        uid: "test-uid",
        delete: jest.fn(), // Mock the delete method in case of error
      },
    });
    (addDoc as jest.Mock).mockResolvedValueOnce({});

    render(<AdminRegistration />);

    // Fill in the form fields
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

    // Submit the form
    fireEvent.click(screen.getByRole("button", { name: /Register/i }));

    await waitFor(() => {
      expect(screen.getByText(/Registration successful/i)).toBeInTheDocument();
    });

    // Verify the API was called with correct data
    expect(global.fetch).toHaveBeenCalledWith("/api/verify-admin", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        identificationNumber: "12345",
      }),
    });
  });

  it("handles invalid identification number", async () => {
    // Mock the API call to return an error
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      json: async () => ({
        error: "Identification number not found",
      }),
    });

    render(<AdminRegistration />);

    // Fill in the form fields
    fireEvent.change(screen.getByLabelText(/First Name/i), {
      target: { value: "John" },
    });
    fireEvent.change(screen.getByLabelText(/Last Name/i), {
      target: { value: "Doe" },
    });
    fireEvent.change(screen.getByLabelText(/Identification Number/i), {
      target: { value: "invalid-id" },
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

    // Submit the form
    fireEvent.click(screen.getByRole("button", { name: /Register/i }));

    await waitFor(() => {
      expect(
        screen.getByText(/Identification number not found/i)
      ).toBeInTheDocument();
    });

    // Verify createUserWithEmailAndPassword was NOT called
    expect(createUserWithEmailAndPassword).not.toHaveBeenCalled();
  });
});
