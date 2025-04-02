import ITAdminRegistration from "@/app/it_admin_registration/page";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

jest.mock("firebase/auth", () => ({
  getAuth: jest.fn(() => ({})),
  createUserWithEmailAndPassword: jest.fn(),
}));

jest.mock("firebase/firestore", () => ({
  collection: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
  getDocs: jest.fn(),
  addDoc: jest.fn(),
  getFirestore: jest.fn(() => ({})),
}));

jest.mock("firebase/storage", () => ({
  getStorage: jest.fn(() => ({})),
}));

import { createUserWithEmailAndPassword } from "firebase/auth";
import { getDocs, addDoc } from "firebase/firestore";

describe("IT Admin Registration Page", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders without crashing", () => {
    render(<ITAdminRegistration />);
    const heading = screen.getByRole("heading", {
      level: 1,
      name: /Register/i,
    });
    expect(heading).toBeInTheDocument();
  });

  it("displays all form fields", () => {
    render(<ITAdminRegistration />);
    expect(screen.getByLabelText(/First Name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Last Name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Identification Number/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Email Address/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Create Password/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Confirm Password/i)).toBeInTheDocument();
  });

  it("displays the submit button", () => {
    render(<ITAdminRegistration />);
    const button = screen.getByRole("button", { name: /Register/i });
    expect(button).toBeInTheDocument();
  });

  it("shows error messages for empty fields", async () => {
    render(<ITAdminRegistration />);
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
    render(<ITAdminRegistration />);
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

  it("shows error message for invalid email format", async () => {
    render(<ITAdminRegistration />);
    fireEvent.change(screen.getByLabelText(/Email Address/i), {
      target: { value: "invalid-email" },
    });

    fireEvent.click(screen.getByRole("button", { name: /Register/i }));
    await waitFor(() => {
      expect(screen.getByText(/Invalid email address/i)).toBeInTheDocument();
    });
  });

  it("handles form submission with valid data", async () => {
    // mock successful firebase response
    (createUserWithEmailAndPassword as jest.Mock).mockResolvedValueOnce({
      user: {
        uid: "test-uid",
      },
    });
    (getDocs as jest.Mock)
      .mockResolvedValueOnce({ empty: true }) // email not in use
      .mockResolvedValueOnce({ empty: false }); // identification number exists
    (addDoc as jest.Mock).mockResolvedValueOnce({});

    render(<ITAdminRegistration />);

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
  });
});
