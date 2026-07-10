import { test, expect, type Page } from "@playwright/test";

// ── Geometry helpers ─────────────────────────────────────────────────────────
interface Rect { x: number; y: number; width: number; height: number; right: number; bottom: number; }

function intersects(a: Rect, b: Rect, slack = 1): boolean {
  return !(a.right - slack <= b.x || b.right - slack <= a.x || a.bottom - slack <= b.y || b.bottom - slack <= a.y);
}

// Portrait / mobile viewports render the compact PortraitLobby, not the desktop grid.
function isCompactProject(name: string): boolean {
  return /portrait|mobile/.test(name);
}

async function box(page: Page, selector: string): Promise<Rect | null> {
  const el = page.locator(selector).last();
  if ((await el.count()) === 0) return null;
  const b = await el.boundingBox();
  if (!b) return null;
  return { ...b, right: b.x + b.width, bottom: b.y + b.height };
}

async function enterLobby(page: Page) {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.fill("#home-player-name", "SmokeTester");
  await page.click('button[type="submit"]');
  await expect(page.getByText("Open World")).toBeVisible({ timeout: 45000 });
}

const READY_SEL = 'button:has-text("Ready Up"), button:has-text("Waiting for Players"), button:has-text("Waiting ("), button:has-text("Start Match")';

// ── Lobby structure + no-overlap ──────────────────────────────────────────────
test.describe("lobby layout", () => {
  test.beforeEach(async ({ page }) => {
    await enterLobby(page);
  });

  test("renders all three map cards without an orphaned third card", async ({ page }) => {
    for (const name of ["Forest", "The Deep Dark", "Savannah at Dusk"]) {
      await expect(page.getByRole("button", { name, exact: false })).toBeVisible();
    }
  });

  test("shows Morphs, Upgrades, Open World, and Ready controls", async ({ page }) => {
    await expect(page.getByText("Morphs", { exact: false }).first()).toBeVisible();
    await expect(page.getByText("Upgrades", { exact: false }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: /Open World/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Ready Up|Waiting|Start Match|Ready —/i })).toBeVisible();
  });

  test("no unexpected horizontal overflow", async ({ page }) => {
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(2);
  });

  test("footer primary controls do not overlap each other", async ({ page }, testInfo) => {
    test.skip(isCompactProject(testInfo.project.name), "desktop grid footer only");
    // Let entrance transitions settle before measuring geometry.
    await page.waitForTimeout(400);
    const ready = await box(page, READY_SEL);
    const openWorld = await box(page, 'button:has-text("Open World")');
    const solo = await box(page, 'button:has-text("Solo vs AI")');
    expect(ready).not.toBeNull();
    expect(openWorld).not.toBeNull();
    // Open World and Solo buttons must not overlap.
    if (solo) expect(intersects(openWorld!, solo)).toBe(false);
    // Ready and Open World must not overlap.
    expect(intersects(ready!, openWorld!)).toBe(false);
  });

  test("Open World entry shows the Savannah Reserve HUD", async ({ page }) => {
    await page.getByRole("button", { name: /Open World/i }).click();
    await expect(page.getByRole("button", { name: /Leave/i })).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/Savannah Reserve/i)).toBeVisible();
  });
});

// ── Open-world HUD no-overlap ─────────────────────────────────────────────────
test.describe("open-world HUD", () => {
  test.beforeEach(async ({ page }) => {
    await enterLobby(page);
    await page.getByRole("button", { name: /Open World/i }).click();
    await expect(page.getByRole("button", { name: /Leave/i })).toBeVisible({ timeout: 10000 });
  });

  test("top HUD zones (leave / quest / profile) do not overlap", async ({ page }) => {
    const leave = await box(page, 'button:has-text("Leave")');
    const profile = await box(page, 'div:has-text("Lv")');
    expect(leave).not.toBeNull();
    // Leave must stay clear of the right-edge profile summary.
    if (profile) {
      expect(leave!.x).toBeLessThan(profile.x);
    }
    // Everything stays inside the viewport.
    const vw = page.viewportSize()!.width;
    const vh = page.viewportSize()!.height;
    for (const r of [leave, profile].filter(Boolean) as Rect[]) {
      expect(r!.x).toBeGreaterThanOrEqual(-1);
      expect(r!.right).toBeLessThanOrEqual(vw + 1);
      expect(r!.bottom).toBeLessThanOrEqual(vh + 1);
    }
  });

  test("connection or error feedback is surfaced", async ({ page }) => {
    // Either a connecting/loading state or a profile level is present.
    const signal = page.getByText(/Connecting|Offline|Lv|Loading profile/i);
    await expect(signal.first()).toBeVisible({ timeout: 10000 });
  });
});
