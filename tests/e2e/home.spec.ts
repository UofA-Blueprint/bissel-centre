import { test, expect } from "@playwright/test";

test("Home Page has a title", async ({ page }) => {
  await page.goto("http://localhost:3000");
  const title = await page.title();
  expect(title).not.toBeNull();
});
