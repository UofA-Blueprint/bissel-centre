import React from "react";
import { render, fireEvent, screen, waitFor } from "@testing-library/react";
import AdminRegisterPage from "@/app/admin/register/page";

// mock fetch globally
const originalFetch = global.fetch;
beforeEach(() => {
  global.fetch = jest.fn() as unknown as jest.MockedFunction<typeof fetch>;
});
afterEach(() => {
  global.fetch = originalFetch;
  jest.resetAllMocks();
});

// mock clipboard
beforeAll(() => {
  Object.defineProperty(navigator, "clipboard", {
    value: {
      writeText: jest.fn().mockResolvedValue(undefined),
    },
    configurable: true,
  });
});

test("renders registration form fields", () => {
  render(<AdminRegisterPage />);

  expect(
    screen.getByPlaceholderText(/Enter your identification number/i)
  ).toBeInTheDocument();
  expect(
    screen.getByPlaceholderText(/Enter the user's first name/i)
  ).toBeInTheDocument();
  expect(
    screen.getByPlaceholderText(/Enter the user's last name/i)
  ).toBeInTheDocument();
  expect(
    screen.getByPlaceholderText(/Enter the user's email/i)
  ).toBeInTheDocument();

  expect(screen.getByRole("button", { name: /Register/i })).toBeInTheDocument();
});

test("successful submit shows generated ID dialog and allows copy", async () => {
  const rawId = "ABCDEFGHIJ";
  (global.fetch as jest.Mock).mockResolvedValueOnce({
    ok: true,
    json: async () => ({ uid: "uid123", rawId }),
  });

  render(<AdminRegisterPage />);

  fireEvent.change(
    screen.getByPlaceholderText(/Enter the user's first name/i),
    {
      target: { value: "Alice" },
    }
  );
  fireEvent.change(screen.getByPlaceholderText(/Enter the user's last name/i), {
    target: { value: "Smith" },
  });
  fireEvent.change(screen.getByPlaceholderText(/Enter the user's email/i), {
    target: { value: "alice@example.com" },
  });
  fireEvent.change(
    screen.getByPlaceholderText(/Enter your identification number/i),
    {
      target: { value: "ADMIN-ID-1" },
    }
  );

  fireEvent.click(screen.getByRole("button", { name: /Register →|Register/i }));

  // wait for dialog and generated id to appear
  await waitFor(() => {
    expect(screen.getByText(rawId)).toBeInTheDocument();
  });

  // click copy button
  const copyButton = screen.getByRole("button", { name: /Copy ID|Copied!/i });
  fireEvent.click(copyButton);

  await waitFor(() => {
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(rawId);
  });
});

test("email conflict surfaces friendly message", async () => {
  (global.fetch as jest.Mock).mockResolvedValueOnce({
    ok: false,
    json: async () => ({
      error: "The email address is already in use by another account.",
    }),
  });

  render(<AdminRegisterPage />);

  fireEvent.change(
    screen.getByPlaceholderText(/Enter the user's first name/i),
    {
      target: { value: "Bob" },
    }
  );
  fireEvent.change(screen.getByPlaceholderText(/Enter the user's last name/i), {
    target: { value: "Jones" },
  });
  fireEvent.change(screen.getByPlaceholderText(/Enter the user's email/i), {
    target: { value: "bob@example.com" },
  });
  fireEvent.change(
    screen.getByPlaceholderText(/Enter your identification number/i),
    {
      target: { value: "ADMIN-ID-2" },
    }
  );

  fireEvent.click(screen.getByRole("button", { name: /Register →|Register/i }));

  await waitFor(() => {
    expect(screen.getByText(/Email already in use/i)).toBeInTheDocument();
  });
});
