import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import StaffLoginPage from "../app/staff/login/page";

// Mock Next.js router
const mockPush = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: jest.fn(() => ({
    push: mockPush,
  })),
}));

// Mock auth services
jest.mock("../app/services/auth", () => ({
  verifyPassword: jest.fn(),
  setStaffUser: jest.fn(),
  setRememberMe: jest.fn(),
  getRememberedEmail: jest.fn(),
  hashPassword: jest.fn(),
}));

// Mock Firebase
jest.mock("firebase/firestore", () => ({
  collection: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
  getDocs: jest.fn(),
}));

jest.mock("../app/services/firebase", () => ({
  db: {},
}));

// Import mocked functions
import {
  verifyPassword,
  setStaffUser,
  setRememberMe,
  getRememberedEmail,
} from "../app/services/auth";
import { getDocs } from "firebase/firestore";

const mockVerifyPassword = verifyPassword as jest.MockedFunction<
  typeof verifyPassword
>;
const mockSetStaffUser = setStaffUser as jest.MockedFunction<
  typeof setStaffUser
>;
const mockSetRememberMe = setRememberMe as jest.MockedFunction<
  typeof setRememberMe
>;
const mockGetRememberedEmail = getRememberedEmail as jest.MockedFunction<
  typeof getRememberedEmail
>;
const mockGetDocs = getDocs as jest.MockedFunction<typeof getDocs>;

describe("StaffLoginPage", () => {
  const mockStaffData = {
    email: "sunny@gmail.com",
    firstName: "Sunny",
    secondName: "Rain",
    hashedPassword: "123456",
    createdBy: "self-registration",
  };

  const mockStaffDoc = {
    id: "staff123",
    data: () => mockStaffData,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetRememberedEmail.mockReturnValue(null);
    window.alert = jest.fn();
  });

  test("renders login form correctly", () => {
    render(<StaffLoginPage />);

    expect(
      screen.getByRole("heading", { name: "Sign In" })
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Email Address")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
    expect(screen.getByText("Remember me")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign In" })).toBeInTheDocument();
  });

  test("successful login redirects to dashboard", async () => {
    mockGetDocs.mockResolvedValue({
      empty: false,
      docs: [mockStaffDoc],
    } as any);
    mockVerifyPassword.mockResolvedValue(true);

    render(<StaffLoginPage />);

    fireEvent.change(screen.getByLabelText("Email Address"), {
      target: { value: "sunny@gmail.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "123456" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Sign In" }));

    await waitFor(() => {
      expect(mockSetStaffUser).toHaveBeenCalledWith({
        id: "staff123",
        email: "sunny@gmail.com",
        firstName: "Sunny",
        secondName: "Rain",
        createdBy: "self-registration",
      });
      expect(mockPush).toHaveBeenCalledWith("/staff/dashboard");
    });
  });

  test("shows error for invalid credentials", async () => {
    mockGetDocs.mockResolvedValue({
      empty: true,
      docs: [],
    } as any);

    render(<StaffLoginPage />);

    fireEvent.change(screen.getByLabelText("Email Address"), {
      target: { value: "invalid@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "wrongpassword" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Sign In" }));

    await waitFor(() => {
      expect(screen.getByText(/Invalid email or password/)).toBeInTheDocument();
    });
  });

  test("shows error for wrong password", async () => {
    mockGetDocs.mockResolvedValue({
      empty: false,
      docs: [mockStaffDoc],
    } as any);
    mockVerifyPassword.mockResolvedValue(false);

    render(<StaffLoginPage />);

    fireEvent.change(screen.getByLabelText("Email Address"), {
      target: { value: "sunny@gmail.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "wrongpassword" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Sign In" }));

    await waitFor(() => {
      expect(screen.getByText(/Invalid email or password/)).toBeInTheDocument();
    });
  });

  test("remember me functionality works", async () => {
    mockGetDocs.mockResolvedValue({
      empty: false,
      docs: [mockStaffDoc],
    } as any);
    mockVerifyPassword.mockResolvedValue(true);

    render(<StaffLoginPage />);

    fireEvent.change(screen.getByLabelText("Email Address"), {
      target: { value: "sunny@gmail.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "123456" },
    });
    fireEvent.click(screen.getByLabelText("Remember me"));
    fireEvent.click(screen.getByRole("button", { name: "Sign In" }));

    await waitFor(() => {
      expect(mockSetRememberMe).toHaveBeenCalledWith("sunny@gmail.com", true);
    });
  });

  test("pre-fills remembered email", () => {
    mockGetRememberedEmail.mockReturnValue("remembered@example.com");

    render(<StaffLoginPage />);

    const emailInput = screen.getByLabelText(
      "Email Address"
    ) as HTMLInputElement;
    expect(emailInput.value).toBe("remembered@example.com");
  });

  test("forgot password shows alert", () => {
    render(<StaffLoginPage />);

    fireEvent.click(screen.getByText("Forgot Password?"));

    expect(window.alert).toHaveBeenCalledWith(
      "Please contact your IT Administrator for password reset assistance."
    );
  });
});
