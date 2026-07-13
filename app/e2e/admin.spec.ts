import { expect, test } from "@playwright/test";

test("lobby Admin button opens the server-authorized control panel", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel(/Player name/i).fill(`Admin-${Date.now()}`);
  await page.getByRole("button", { name: /^PLAY$/i }).click();
  await page.getByRole("button", { name: /Multiplayer/i }).click();
  await page.getByRole("button", { name: /Create a Room/i }).click();
  await expect(page.getByRole("button", { name: /^Admin$/i })).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: /^Admin$/i }).click();
  await expect(page.getByRole("heading", { name: /Admin Access/i })).toBeVisible();
  await page.getByPlaceholder(/Passphrase/i).fill("local-e2e-admin");
  await page.getByRole("button", { name: /Unlock/i }).click();
  await expect(page.getByRole("heading", { name: /Admin Panel/i })).toBeVisible({ timeout: 10_000 });
  await expect(page.getByRole("button", { name: /Force Start/i })).toBeVisible();
});
