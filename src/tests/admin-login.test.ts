import React from "react";
import { render, fireEvent, screen } from "@testing-library/react";
import AdminLoginPage from "../app/admin/login/page";

// Create a push mock to track navigation
const pushMock = jest.fn();

// Mock next/navigation to use our pushMock
jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock,
  }),
}));

describe("AdminLoginPage", () => {
  beforeEach(() => {
    pushMock.mockClear();
  });

  test("renders login form and accepts input", () => {
    render(React.createElement(AdminLoginPage));

    const emailInput = screen.getByPlaceholderText("Enter your admin email");
    const passwordInput = screen.getByPlaceholderText("Enter your password");
    const signInButton = screen.getByRole("button", { name: /sign in/i });

    fireEvent.change(emailInput, { target: { value: "richard9@ualberta.ca" } });
    fireEvent.change(passwordInput, { target: { value: "rxDUysAM2RPe" } });

    expect(emailInput).toHaveValue("richard9@ualberta.ca");
    expect(passwordInput).toHaveValue("rxDUysAM2RPe");
    expect(signInButton).toBeInTheDocument();
  });

  test("navigates to admin dashboard on successful login", () => {
    render(React.createElement(AdminLoginPage));

    const emailInput = screen.getByPlaceholderText("Enter your admin email");
    const passwordInput = screen.getByPlaceholderText("Enter your password");
    const signInButton = screen.getByRole("button", { name: /sign in/i });

    fireEvent.change(emailInput, { target: { value: "richard9@ualberta.ca" } });
    fireEvent.change(passwordInput, { target: { value: "rxDUysAM2RPe" } });

    fireEvent.click(signInButton);
  });
});
