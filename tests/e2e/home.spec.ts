import { test, expect } from "@playwright/test";

test("Home Page has a title", async ({ page }) => {
  await page.goto("http://localhost:3000");
  const title = await page.title();
  expect(title).not.toBeNull();
});


test('loads IT admin dashboard', async ({ page }) => {
  await page.goto('/it-admin-dashboard');

  // Verify all 4 stat cards render
  await expect(page.getByText('Available Cards')).toBeVisible();
  await expect(page.getByText('Active Cards')).toBeVisible();
  await expect(page.getByText('Expired Cards')).toBeVisible();
  await expect(page.getByText('Flagged Users')).toBeVisible();
});
