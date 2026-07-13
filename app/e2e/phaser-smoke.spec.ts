import { expect, test } from "@playwright/test";

async function authenticate(page: import("@playwright/test").Page, name: string) {
  await page.goto("/");
  await page.getByLabel(/Player name/i).fill(name);
  await page.getByRole("button", { name: /^PLAY$/i }).click();
  await expect(page.getByRole("button", { name: /Solo vs AI/i })).toBeVisible();
}

test("Solo Forest boots one Phaser instance and reaches playable state", async ({ page }, testInfo) => {
  const browserErrors: string[] = [];
  page.on("pageerror", (error) => browserErrors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") browserErrors.push(message.text()); });

  await authenticate(page, `Solo-${Date.now()}`);
  await page.getByRole("button", { name: /Solo vs AI/i }).click();
  const rangerRole = page.getByRole("button", { name: /^Ranger Track/i });
  await rangerRole.click();
  await expect(rangerRole).toHaveAttribute("aria-pressed", "true");
  const durationSelect = page.getByLabel(/Solo round length/i);
  await durationSelect.selectOption("30");
  await expect(durationSelect).toHaveValue("30");
  await page.getByRole("button", { name: /Start solo expedition/i }).click();

  const world = page.locator('[data-renderer="phaser"][data-scene="match"]');
  await expect(world).toBeVisible({ timeout: 20_000 });
  await expect(world.locator("canvas")).toHaveCount(1);
  await expect(world).toHaveAttribute("data-phase", "PLAYING", { timeout: 20_000 });
  await expect(page.getByRole("button", { name: /Fire at reticle/i })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("forest-hunter.png") });
  expect(browserErrors).toEqual([]);
});

for (const biome of [
  { button: /^The Deep Dark/i, sceneName: "The Deep Dark", file: "deep-dark-animal.png" },
  { button: /^Savannah at Dusk/i, sceneName: "Savannah at Dusk", file: "savannah-animal.png" },
] as const) {
  test(`Solo ${biome.sceneName} reaches a distinct playable Phaser world`, async ({ page }, testInfo) => {
    const browserErrors: string[] = [];
    page.on("pageerror", (error) => browserErrors.push(error.message));
    page.on("console", (message) => { if (message.type() === "error") browserErrors.push(message.text()); });
    await authenticate(page, `Biome-${Date.now()}`);
    await page.getByRole("button", { name: /Solo vs AI/i }).click();
    await page.getByRole("button", { name: /^Animal/i }).click();
    await page.getByRole("button", { name: biome.button }).click();
    await page.getByLabel(/Solo round length/i).selectOption("30");
    await page.getByRole("button", { name: /Start solo expedition/i }).click();
    const world = page.locator('[data-renderer="phaser"][data-scene="match"]');
    await expect(world).toHaveAttribute("data-phase", "PLAYING", { timeout: 20_000 });
    await expect(world.locator("canvas")).toHaveCount(1);
    await page.screenshot({ path: testInfo.outputPath(biome.file) });
    expect(browserErrors).toEqual([]);
  });
}
