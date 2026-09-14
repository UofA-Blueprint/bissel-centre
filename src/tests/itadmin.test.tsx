import React from "react";
import { render, fireEvent, screen } from "@testing-library/react";
import Home from "../app/page";

// Home renders navigation as next/link anchors, which need the app router
// context mocked out to render under jsdom.
jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: jest.fn(),
  }),
}));

describe("Home component", () => {
  const switchToAdmin = () => {
    fireEvent.click(screen.getByRole("button", { name: /Switch to Admin/i }));
  };

  test("toggles to admin view when admin toggle is clicked", () => {
    render(React.createElement(Home));
    switchToAdmin();
    expect(screen.getByText("Welcome Admin!")).toBeInTheDocument();
  });

  test("links to /register as non-admin", () => {
    render(React.createElement(Home));
    expect(screen.getByRole("link", { name: /Register/i })).toHaveAttribute(
      "href",
      "/register"
    );
  });

  test("links to /login as non-admin", () => {
    render(React.createElement(Home));
    expect(screen.getByRole("link", { name: /Login/i })).toHaveAttribute(
      "href",
      "/login"
    );
  });

  test("links to /admin/register as admin", () => {
    render(React.createElement(Home));
    switchToAdmin();
    expect(screen.getByRole("link", { name: /Register/i })).toHaveAttribute(
      "href",
      "/admin/register"
    );
  });

  test("links to /admin/login as admin", () => {
    render(React.createElement(Home));
    switchToAdmin();
    expect(screen.getByRole("link", { name: /Login/i })).toHaveAttribute(
      "href",
      "/admin/login"
    );
  });
});
