import { expect, test } from "@playwright/test";

async function enterSetup(page: import("@playwright/test").Page, name: string) {
  await page.goto("/");
  await page.getByLabel(/Player name/i).fill(name);
  await page.getByRole("button", { name: /^PLAY$/i }).click();
  await page.getByRole("button", { name: /Field League soccer/i }).click();
  await expect(page.getByRole("heading", { name: /Pick your side/i })).toBeVisible();
}

test("Field League quick play starts a balanced 3v3 AI match", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  await enterSetup(page, `Striker-${Date.now()}`);
  await page.getByRole("button", { name: /Teal Tides/i }).click();
  await page.getByRole("button", { name: /3v3/i }).click();
  await page.getByRole("button", { name: /Take the field/i }).click();
  await expect(page.locator(".soccer-game canvas")).toHaveCount(1, { timeout: 20_000 });
  await expect(page.getByRole("button", { name: /Exit field/i })).toBeVisible();
  expect(errors).toEqual([]);
});

test("Field League crew match creates an authorized realtime soccer room", async ({ page }) => {
  const socketFrames: string[] = [];
  page.on("websocket", (socket) => socket.on("framereceived", (event) => socketFrames.push(String(event.payload))));
  await enterSetup(page, `Crew-${Date.now()}`);
  await page.getByRole("button", { name: /Crew Match/i }).click();
  await page.getByRole("button", { name: /3v3/i }).click();
  await page.getByRole("button", { name: /Take the field/i }).click();
  await page.getByRole("textbox", { name: /^Room name$/i }).fill(`Field Test ${Date.now()}`);
  await expect(page.getByLabel(/Match capacity/i)).toHaveValue("6");
  await page.getByRole("button", { name: /^Create room$/i }).click();
  await expect(page.locator(".soccer-game canvas")).toHaveCount(1, { timeout: 20_000 });
  await expect(page.locator(".soccer-game__crew-note")).toContainText(/Crew Match/);
  await expect.poll(() => socketFrames.some((frame) => frame.includes('"type":"SOCCER_SNAPSHOT"')), { timeout: 15_000 }).toBe(true);
});
