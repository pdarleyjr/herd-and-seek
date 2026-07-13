import { expect, test } from "@playwright/test";

async function enterReserve(page: import("@playwright/test").Page, name: string) {
  await page.goto("/");
  await page.getByLabel(/Player name/i).fill(name);
  await page.getByRole("button", { name: /^PLAY$/i }).click();
  await page.getByRole("button", { name: /Open World/i }).click();
  const world = page.locator('[data-renderer="phaser"][data-scene="openWorld"]');
  await expect(world).toHaveAttribute("data-engine-ready", "OpenWorldScene", { timeout: 20_000 });
  await expect(world).toHaveAttribute("data-zone-ready", "true", { timeout: 20_000 });
  return world;
}

test("Open World completes a quest, persists its reward, and keeps Phaser prediction", async ({ page }, testInfo) => {
  const browserErrors: string[] = [];
  page.on("pageerror", (error) => browserErrors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") browserErrors.push(message.text()); });
  const world = await enterReserve(page, `Reserve-${Date.now()}`);
  await expect(world.locator("canvas")).toHaveCount(1);
  await expect(world).toHaveAttribute("data-action-kind", "accept", { timeout: 10_000 });
  const startingCoins = Number(await world.getAttribute("data-coins"));
  await page.locator(".open-world-phaser__action").click();
  await expect(world).toHaveAttribute("data-active-quests", "1", { timeout: 10_000 });

  for (let index = 0; index < 5; index += 1) {
    await expect(world).toHaveAttribute("data-action-kind", "collect", { timeout: 10_000 });
    const beforeCount = Number(await world.getAttribute("data-collectible-count"));
    await page.locator(".open-world-phaser__action").click();
    await expect.poll(async () => Number(await world.getAttribute("data-collectible-count"))).toBeLessThan(beforeCount);
  }
  await expect(world).toHaveAttribute("data-complete-quests", "1", { timeout: 10_000 });
  await expect(world).toHaveAttribute("data-action-kind", "claim", { timeout: 10_000 });
  await page.locator(".open-world-phaser__action").click();
  await expect(world).toHaveAttribute("data-claimed-quests", "1", { timeout: 10_000 });
  await expect.poll(async () => Number(await world.getAttribute("data-coins"))).toBeGreaterThan(startingCoins + 25);

  const x0 = Number(await world.getAttribute("data-local-x"));
  await page.keyboard.down("d");
  await page.waitForTimeout(650);
  await page.keyboard.up("d");
  await expect.poll(async () => Number(await world.getAttribute("data-local-x"))).toBeGreaterThan(x0 + 40);
  await page.screenshot({ path: testInfo.outputPath("open-world-lodge.png") });

  const rewardedCoins = Number(await world.getAttribute("data-coins"));
  await page.reload();
  await page.getByRole("button", { name: /Open World/i }).click();
  const restored = page.locator('[data-renderer="phaser"][data-scene="openWorld"]');
  await expect(restored).toHaveAttribute("data-zone-ready", "true", { timeout: 20_000 });
  await expect(restored).toHaveAttribute("data-claimed-quests", "1", { timeout: 20_000 });
  await expect(restored).toHaveAttribute("data-coins", String(rewardedCoins));
  expect(browserErrors).toEqual([]);
});
