import { expect, test, type Locator, type Page } from "@playwright/test";

async function authenticate(page: Page, name: string) {
  await page.goto("/");
  await page.getByLabel(/Player name/i).fill(name);
  await page.getByRole("button", { name: /^PLAY$/i }).click();
  await expect(page.getByRole("button", { name: /Field League soccer/i })).toBeVisible();
}

async function expectInsideViewport(locator: Locator) {
  const bounds = await locator.boundingBox();
  const viewport = locator.page().viewportSize();
  expect(bounds).not.toBeNull();
  expect(viewport).not.toBeNull();
  expect(bounds!.x).toBeGreaterThanOrEqual(-1);
  expect(bounds!.y).toBeGreaterThanOrEqual(-1);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(viewport!.width + 1);
  expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(viewport!.height + 1);
}

async function expectNoHorizontalOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(2);
}

async function expectTouchTargets(page: Page) {
  const shortTargets = await page.locator("button:visible, input:visible, select:visible, summary:visible").evaluateAll((elements) => elements
    .map((element) => {
      const rect = element.getBoundingClientRect();
      return { label: element.getAttribute("aria-label") ?? element.textContent?.trim(), width: rect.width, height: rect.height };
    })
    .filter(({ width, height }) => width < 44 || height < 44));
  expect(shortTargets).toEqual([]);
}

test("mode cards and Field League setup remain reachable without root clipping", async ({ page }, testInfo) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await authenticate(page, `Responsive-${testInfo.project.name}`);

  const modeDesk = page.locator(".mode-camp");
  const deskMetrics = await modeDesk.evaluate((element) => ({
    clientHeight: element.clientHeight,
    scrollHeight: element.scrollHeight,
    viewportHeight: window.innerHeight,
    overflowY: getComputedStyle(element).overflowY,
  }));
  expect(deskMetrics.clientHeight).toBeLessThanOrEqual(deskMetrics.viewportHeight);
  expect(deskMetrics.scrollHeight).toBeGreaterThanOrEqual(deskMetrics.clientHeight);
  expect(["auto", "scroll"]).toContain(deskMetrics.overflowY);
  await expectNoHorizontalOverflow(page);

  const soccerMode = page.getByRole("button", { name: /Field League soccer/i });
  await soccerMode.evaluate((element) => element.scrollIntoView({ block: "center", inline: "nearest" }));
  await expectInsideViewport(soccerMode);
  await soccerMode.click();

  const setup = page.locator(".soccer-setup");
  await expect(page.getByRole("heading", { name: /Choose your side/i })).toBeVisible();
  const setupMetrics = await setup.evaluate((element) => ({
    clientHeight: element.clientHeight,
    scrollHeight: element.scrollHeight,
    scrollTop: element.scrollTop,
    viewportHeight: window.innerHeight,
    overflowY: getComputedStyle(element).overflowY,
  }));
  expect(setupMetrics.clientHeight).toBeLessThanOrEqual(setupMetrics.viewportHeight);
  expect(setupMetrics.scrollTop).toBe(0);
  expect(["auto", "scroll"]).toContain(setupMetrics.overflowY);
  await expectNoHorizontalOverflow(page);

  const viewport = page.viewportSize()!;
  if (viewport.width > 760 && viewport.height >= 650) {
    await expectInsideViewport(page.locator(".soccer-setup__console"));
  } else {
    const start = page.getByRole("button", { name: /Take the field/i });
    await start.scrollIntoViewIfNeeded();
    await expectInsideViewport(start);
    await page.locator(".soccer-setup__back").scrollIntoViewIfNeeded();
    await expectInsideViewport(page.locator(".soccer-setup__back"));
  }
  await expectTouchTargets(page);
});

test("multiplayer lobby cards fit their responsive panels", async ({ page }, testInfo) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await authenticate(page, `Lobby-${testInfo.project.name}`);
  await page.getByRole("button", { name: /Multiplayer/i }).scrollIntoViewIfNeeded();
  await page.getByRole("button", { name: /Multiplayer/i }).click();

  await page.getByRole("textbox", { name: /^Room name$/i }).fill(`Viewport ${Date.now()}`);
  await page.getByRole("button", { name: /Private/i }).click();
  await page.getByRole("textbox", { name: "Room password Shared only with the friends you invite." }).fill("responsive-room-2026");
  await page.getByRole("button", { name: /^Create room$/i }).click();
  await expect(page.getByRole("button", { name: /Copy room code/i })).toBeVisible({ timeout: 15_000 });

  const lobby = page.locator(".lobby-v2");
  await expectInsideViewport(lobby);
  await expectNoHorizontalOverflow(page);

  if (page.viewportSize()!.width <= 1199) {
    await expect(page.locator(".lobby-mobile-tabs")).toBeVisible();
    await expect(page.locator(".lobby-panel:visible")).toHaveCount(1);
  }

  const visibleCards = page.locator(".map-card:visible, .perk-stack button:visible, .animal-strip button:visible");
  expect(await visibleCards.count()).toBeGreaterThan(0);
  for (let index = 0; index < await visibleCards.count(); index += 1) {
    const card = visibleCards.nth(index);
    await card.scrollIntoViewIfNeeded();
    await expectInsideViewport(card);
  }
  await expectInsideViewport(page.getByRole("button", { name: /Ready for the trail/i }));
  await expectTouchTargets(page);
});
