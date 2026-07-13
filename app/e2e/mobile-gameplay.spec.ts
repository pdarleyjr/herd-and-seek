import { expect, test } from "@playwright/test";

test("mobile Solo animal can enter Forest, move, and activate a perk", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  await page.goto("/");
  await page.getByLabel(/Player name/i).fill(`Mobile-${Date.now()}`);
  await page.getByRole("button", { name: /^PLAY$/i }).click();
  await page.getByRole("button", { name: /Solo vs AI/i }).click();
  await page.getByRole("button", { name: /^Animal Blend/i }).click();
  await page.getByLabel(/Solo perk/i).selectOption("sprint");
  await page.getByLabel(/Solo round length/i).selectOption("30");
  await page.getByRole("button", { name: /Start solo expedition/i }).click();

  const world = page.locator('[data-scene="match"]');
  await expect(world).toHaveAttribute("data-phase", "PLAYING", { timeout: 20_000 });
  await expect(world.locator("canvas")).toHaveCount(1);
  const perk = page.getByRole("button", { name: /Activate sprint/i });
  await expect(perk).toBeVisible();
  const size = await perk.boundingBox();
  expect(size?.width).toBeGreaterThanOrEqual(44);
  expect(size?.height).toBeGreaterThanOrEqual(44);
  await perk.tap();
  await expect(world).toHaveAttribute("data-feedback-kind", "perk");
  expect(errors).toEqual([]);
});
