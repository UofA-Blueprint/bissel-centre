import React from "react";
import { render, fireEvent, screen } from "@testing-library/react";
import Home from "../src/app/page";

describe("Home component", () => {
  test("toggles to admin view when admin toggle is clicked", () => {
    render(React.createElement(Home));
    const adminToggle = screen.getByRole("button", {
      name: /Switch to Admin/i,
    });
    fireEvent.click(adminToggle);
    expect(screen.getByText("Welcome Admin!")).toBeInTheDocument();
  });

  test("navigates to /register when Register button is clicked as non-admin", () => {
    render(React.createElement(Home));
    const registerButton = screen.getByRole("link", { name: "Register" });
    expect(registerButton).toHaveAttribute("href", "/register");
  });

  test("navigates to /login when Login button is clicked as non-admin", () => {
    render(React.createElement(Home));
    const loginButton = screen.getByRole("link", { name: "Login" });
    expect(loginButton).toHaveAttribute("href", "/login");
  });

  test("navigates to /admin/register when Register button is clicked as admin", () => {
    render(React.createElement(Home));
    // Toggle admin state using updated button text
    const adminToggle = screen.getByRole("button", {
      name: /Switch to Admin/i,
    });
    fireEvent.click(adminToggle);
    const registerButton = screen.getByRole("link", { name: "Register" });
    expect(registerButton).toHaveAttribute("href", "/admin/register");
  });

  test("navigates to /admin/login when Login button is clicked as admin", () => {
    render(React.createElement(Home));
    // Toggle admin state using updated button text
    const adminToggle = screen.getByRole("button", {
      name: /Switch to Admin/i,
    });
    fireEvent.click(adminToggle);
    const loginButton = screen.getByRole("link", { name: "Login" });
    expect(loginButton).toHaveAttribute("href", "/admin/login");
  });
});
