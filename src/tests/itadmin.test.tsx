import React from "react";
import { render, fireEvent, screen } from "@testing-library/react";
import Home from "../app/page";

// Create a push mock which will be used in our mock of useRouter
const pushMock = jest.fn();

// Mock next/navigation to provide our own useRouter with the push mock
jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock,
  }),
}));

describe("Home component", () => {
  beforeEach(() => {
    pushMock.mockClear();
  });
  test("toggles to admin view when admin toggle is clicked", () => {
    render(React.createElement(Home));
    const adminToggle = screen.getByRole("button", {
      name: /Switch to Admin/i,
    });
    fireEvent.click(adminToggle);
    expect(screen.getByText("Welcome Admin!")).toBeInTheDocument();
  });

  test("navigates to /staff/register when Register button is clicked as non-admin", () => {
    render(React.createElement(Home));
    const registerButton = screen.getByRole("button", { name: /Register/i });
    fireEvent.click(registerButton);
    expect(pushMock).toHaveBeenCalledWith("/staff/register");
  });

  test("navigates to /login when Login button is clicked as non-admin", () => {
    render(React.createElement(Home));
    const loginButton = screen.getByRole("button", { name: /Login/i });
    fireEvent.click(loginButton);
    expect(pushMock).toHaveBeenCalledWith("/staff/login");
  });

  test("navigates to /admin/register when Register button is clicked as admin", () => {
    render(React.createElement(Home));
    // Toggle admin state using updated button text
    const adminToggle = screen.getByRole("button", {
      name: /Switch to Admin/i,
    });
    fireEvent.click(adminToggle);
    const registerButton = screen.getByRole("button", { name: /Register/i });
    fireEvent.click(registerButton);
    expect(pushMock).toHaveBeenCalledWith("/admin/register");
  });

  test("navigates to /admin/login when Login button is clicked as admin", () => {
    render(React.createElement(Home));
    // Toggle admin state using updated button text
    const adminToggle = screen.getByRole("button", {
      name: /Switch to Admin/i,
    });
    fireEvent.click(adminToggle);
    const loginButton = screen.getByRole("button", { name: /Login/i });
    fireEvent.click(loginButton);
    expect(pushMock).toHaveBeenCalledWith("/admin/login");
  });
});
