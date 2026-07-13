import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

async function authenticate(page: Page, name = "TrailTester") {
  await page.goto("/");
  await page.getByLabel(/Player name/i).fill(name);
  await page.getByRole("button", { name: /^PLAY$/i }).click();
  await expect(page.getByRole("button", { name: /Multiplayer/i })).toBeVisible();
}

async function enterLobby(page: Page) {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await authenticate(page, `Trail-${Date.now()}`);
  await page.getByRole("button", { name: /Multiplayer/i }).click();
  await page.getByRole("button", { name: /Create a Room/i }).click();
  await expect(page.getByRole("button", { name: /Copy room code/i })).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('[data-scene="preview"] canvas')).toHaveCount(1, { timeout: 15_000 });
  await expect(page.locator('[data-scene="preview"]')).toHaveAttribute("data-engine-ready", "LobbyPreviewScene", { timeout: 15_000 });
  await expect(page.locator(".lobby-v2")).toHaveAttribute("data-connection", "connected", { timeout: 15_000 });
}

test.describe("core navigation surfaces", () => {
  test("captures the home screen", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    await expect(page.getByRole("button", { name: /^PLAY$/i })).toBeVisible();
    await expect(page).toHaveScreenshot("home.png", { animations: "disabled", maxDiffPixelRatio: 0.01 });
  });

  test("captures the authored mode desk", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await authenticate(page, "ModeTester");
    await expect(page.getByRole("heading", { name: /Where will your trail begin/i })).toBeVisible();
    await expect(page).toHaveScreenshot("mode-select.png", { animations: "disabled", maxDiffPixelRatio: 0.01 });
  });

  test("captures solo field planning", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await authenticate(page, "SoloPlanner");
    await page.getByRole("button", { name: /Solo vs AI/i }).click();
    await expect(page.getByRole("heading", { name: /Solo field plan/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Back$/i })).toBeInViewport();
    await expect(page.getByRole("button", { name: /Start solo expedition/i })).toBeInViewport();
    await expect(page).toHaveScreenshot("solo-setup.png", { animations: "disabled", maxDiffPixelRatio: 0.01 });
  });

  test("keeps primary mode controls available at browser zoom levels", async ({ page }) => {
    await authenticate(page, "ZoomTester");
    for (const zoom of [1.25, 1.5, 2]) {
      await page.evaluate((value) => { document.documentElement.style.zoom = String(value); }, zoom);
      await expect(page.getByRole("button", { name: /Multiplayer/i })).toBeVisible();
      await expect(page.getByRole("button", { name: /Solo vs AI/i })).toBeVisible();
      await expect(page.getByRole("button", { name: /Open World/i })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(2);
    }
  });
});

test.describe("responsive lobby", () => {
  test.beforeEach(async ({ page }) => enterLobby(page));

  test("shows authored map, animal, perk, roster, and dominant ready regions", async ({ page }) => {
    if (!(await page.getByRole("heading", { name: /Choose the terrain/i }).isVisible())) await page.getByRole("button", { name: /^Map$/i }).click();
    await expect(page.getByRole("heading", { name: /Choose the terrain/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Forest/i })).toBeVisible();
    if (!(await page.getByRole("heading", { name: /Choose one advantage/i }).isVisible())) await page.getByRole("button", { name: /^Perk$/i }).click();
    await expect(page.getByRole("heading", { name: /Choose one advantage/i })).toBeVisible();
    if (!(await page.getByRole("button", { name: /Rabbit/i }).isVisible())) await page.getByRole("button", { name: /^Animal$/i }).click();
    await expect(page.getByRole("button", { name: /Ready for the trail/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Admin$/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Rabbit/i })).toBeVisible();
  });

  test("has no horizontal overflow and keeps visible buttons at least 44px", async ({ page }) => {
    const metrics = await page.evaluate(() => ({ overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      shortButtons: [...document.querySelectorAll("button")].filter((button) => {
        const rect = button.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0 && (rect.width < 44 || rect.height < 44);
      }).map((button) => ({ text: button.textContent?.trim(), width: button.getBoundingClientRect().width, height: button.getBoundingClientRect().height })),
    }));
    expect(metrics.overflow).toBeLessThanOrEqual(2);
    expect(metrics.shortButtons).toEqual([]);
  });

  test("captures the reviewed lobby", async ({ page }) => {
    await page.getByRole("button", { name: /^Rabbit$/i }).click();
    await expect(page.locator(".lobby-v2")).toHaveAttribute("data-player-animal", "rabbit");
    await expect(page).toHaveScreenshot("multiplayer-lobby-admin.png", { animations: "disabled", maxDiffPixelRatio: 0.01 });
  });
});

test("React UI has no serious or critical axe violations", async ({ page }) => {
  await authenticate(page, "A11yTester");
  const results = await new AxeBuilder({ page }).exclude("canvas").analyze();
  expect(results.violations.filter((violation) => violation.impact === "serious" || violation.impact === "critical")).toEqual([]);
});
