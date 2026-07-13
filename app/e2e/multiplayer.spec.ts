import { expect, test, type Browser, type Page } from "@playwright/test";

type DebugState = {
  phase: "LOBBY" | "COUNTDOWN" | "PLAYING" | "ENDED";
  players: Array<{ id: string; username: string; x: number; y: number; isHunter: boolean; perk: string }>;
  ammo: number;
  levelId: string;
};

async function signIn(page: Page, name: string) {
  await page.goto("/?debug");
  await page.getByLabel(/Player name/i).fill(name);
  await page.getByRole("button", { name: /^PLAY$/i }).click();
  await expect(page.getByRole("button", { name: /Multiplayer/i })).toBeVisible();
}

async function createRoom(page: Page, name: string) {
  await signIn(page, name);
  await page.getByRole("button", { name: /Multiplayer/i }).click();
  await page.getByRole("button", { name: /Create a Room/i }).click();
  const roomButton = page.getByRole("button", { name: /Copy room code/i });
  await expect(roomButton).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText(/Live link/i)).toBeVisible({ timeout: 15_000 });
  return (await roomButton.locator("strong").textContent())!.trim();
}

async function joinRoom(page: Page, name: string, roomCode: string) {
  await signIn(page, name);
  await page.getByRole("button", { name: /Multiplayer/i }).click();
  await page.getByPlaceholder("ABCD-EFGH").fill(roomCode);
  await page.getByRole("button", { name: /Join Room/i }).click();
  await expect(page.getByText(/Live link/i)).toBeVisible({ timeout: 15_000 });
}

async function debugState(page: Page): Promise<DebugState | undefined> {
  return page.evaluate(() => (window as typeof window & { __hsState?: DebugState }).__hsState);
}

async function userId(page: Page): Promise<string> {
  return page.evaluate(() => sessionStorage.getItem("hs_sessionId") ?? "");
}

test("two clients complete a Forest round, stay isolated, and start a second round", async ({ browser }) => {
  test.setTimeout(150_000);
  const contexts = await createContexts(browser, 3);
  const [pageA, pageB, pageC] = await Promise.all(contexts.map((context) => context.newPage()));
  const browserErrors: string[] = [];
  const sentFrames = new Map<Page, string[]>([[pageA, []], [pageB, []], [pageC, []]]);
  const receivedFrames = new Map<Page, string[]>([[pageA, []], [pageB, []], [pageC, []]]);
  const socketUrls = new Map<Page, string[]>([[pageA, []], [pageB, []], [pageC, []]]);
  for (const page of [pageA, pageB, pageC]) {
    page.on("pageerror", (error) => browserErrors.push(error.message));
    page.on("console", (message) => { if (message.type() === "error") browserErrors.push(message.text()); });
    page.on("websocket", (socket) => {
      socketUrls.get(page)!.push(socket.url());
      socket.on("framesent", (event) => sentFrames.get(page)!.push(String(event.payload)));
      socket.on("framereceived", (event) => receivedFrames.get(page)!.push(String(event.payload)));
    });
  }
  try {
    const roomAB = await createRoom(pageA, "Ranger-A");
    await joinRoom(pageB, "Ranger-B", roomAB);
    const roomC = await createRoom(pageC, "Ranger-C");
    expect(roomC).not.toBe(roomAB);

    await expect(pageA.getByText("Ranger-B")).toBeVisible({ timeout: 15_000 });
    await expect(pageB.getByText("Ranger-A")).toBeVisible({ timeout: 15_000 });
    await expect(pageC.getByText("Ranger-A")).toHaveCount(0);
    const expectedSocketHost = process.env.E2E_BASE_URL
      ? "herd-and-seek-backend.pdarleyjr.workers.dev"
      : "127.0.0.1:8787";
    expect(socketUrls.get(pageA)?.some((url) => url.includes(expectedSocketHost))).toBe(true);
    expect((await debugState(pageA))?.phase).toBe("LOBBY");
    expect((await debugState(pageB))?.phase).toBe("LOBBY");

    await pageA.bringToFront();
    await pageA.getByRole("button", { name: /The Deep Dark/i }).click();
    await expect.poll(() => sentFrames.get(pageA)!.some((frame) => frame.includes('"type":"SELECT_LEVEL"') && frame.includes('"deepDark"'))).toBe(true);
    await expect.poll(async () => (await debugState(pageB))?.levelId, { timeout: 10_000 }).toBe("deepDark");
    await expect(pageB.getByRole("button", { name: /The Deep Dark/i })).toHaveAttribute("aria-pressed", "true", { timeout: 10_000 });
    await pageA.getByRole("button", { name: /^Forest/i }).click();
    await expect(pageB.getByRole("button", { name: /^Forest/i })).toHaveAttribute("aria-pressed", "true");
    await pageA.getByRole("button", { name: /^Bear$/i }).click();
    await pageA.getByRole("button", { name: /Sprinting Dash/i }).click();
    await expect.poll(async () => (await debugState(pageB))?.players.find((player) => player.username === "Ranger-A")?.perk).toBe("sprint");
    await pageA.getByLabel(/Round length/i).selectOption("30");

    await pageA.getByRole("button", { name: /Ready for the trail/i }).click();
    await pageB.getByRole("button", { name: /Ready for the trail/i }).click();
    const worldA = pageA.locator('[data-scene="match"]');
    const worldB = pageB.locator('[data-scene="match"]');
    await expect(worldA).toHaveAttribute("data-phase", "PLAYING", { timeout: 15_000 });
    await expect(worldB).toHaveAttribute("data-phase", "PLAYING", { timeout: 15_000 });
    await expect(worldA.locator("canvas")).toHaveCount(1);
    await expect(worldB.locator("canvas")).toHaveCount(1);
    expect(browserErrors).toEqual([]);

    const stateA = (await debugState(pageA))!;
    expect(stateA.players.filter((player) => player.isHunter)).toHaveLength(1);
    const idA = await userId(pageA);
    const idB = await userId(pageB);
    const playerA = stateA.players.find((player) => player.id === idA)!;
    const moverPage = playerA.isHunter ? pageB : pageA;
    const observerPage = playerA.isHunter ? pageA : pageB;
    const moverId = playerA.isHunter ? idB : idA;
    const before = (await debugState(observerPage))!.players.find((player) => player.id === moverId)!;
    await moverPage.bringToFront();
    await moverPage.locator('[data-scene="match"] canvas').click({ position: { x: 420, y: 360 } });
    await moverPage.keyboard.down("KeyD");
    await moverPage.waitForTimeout(700);
    await moverPage.keyboard.up("KeyD");
    await moverPage.keyboard.down("KeyS");
    await moverPage.waitForTimeout(350);
    await moverPage.keyboard.up("KeyS");
    await expect(moverPage.locator('[data-scene="match"]')).toHaveAttribute("data-local-sequence", /\d+/, { timeout: 5_000 });
    const moverFrames = sentFrames.get(moverPage)!;
    expect(moverFrames.some((frame) => frame.includes('"type":"SYNC"')), `recent frames: ${moverFrames.slice(-12).join(" | ")}`).toBe(true);
    await expect.poll(async () => {
      const current = (await debugState(observerPage))!.players.find((player) => player.id === moverId)!;
      return Math.hypot(current.x - before.x, current.y - before.y);
    }).toBeGreaterThan(5);

    const hunterPage = stateA.players.find((player) => player.id === idA)?.isHunter ? pageA : pageB;
    const ammoBefore = (await debugState(hunterPage))!.ammo;
    await hunterPage.bringToFront();
    await hunterPage.getByRole("button", { name: /Fire at reticle/i }).click();
    await expect.poll(() => sentFrames.get(hunterPage)!.some((frame) => frame.includes('"type":"SHOOT"'))).toBe(true);
    await expect.poll(async () => (await debugState(hunterPage))!.ammo, { timeout: 15_000 }).toBeLessThan(ammoBefore);

    await expect.poll(() => receivedFrames.get(pageA)!.some((frame) => frame.includes('"type":"GAME_OVER"')), { timeout: 45_000 }).toBe(true);
    await expect.poll(() => receivedFrames.get(pageB)!.some((frame) => frame.includes('"type":"GAME_OVER"')), { timeout: 45_000 }).toBe(true);
    if ((await debugState(pageA))?.phase === "ENDED") {
      await expect(pageA.getByText(/Returning to lobby/i)).toBeVisible();
    }
    try {
      await pageA.getByRole("button", { name: /Return to Lobby Now/i }).click({ timeout: 3_000 });
    } catch {
      expect((await debugState(pageA))?.phase).toBe("LOBBY");
    }
    await expect.poll(async () => (await debugState(pageA))?.phase, { timeout: 12_000 }).toBe("LOBBY");
    await expect.poll(async () => (await debugState(pageB))?.phase, { timeout: 12_000 }).toBe("LOBBY");
    await expect(pageA.getByRole("button", { name: /Ready for the trail/i })).toBeVisible({ timeout: 12_000 });
    await pageB.bringToFront();
    await expect(pageB.getByRole("button", { name: /Ready for the trail/i })).toBeVisible({ timeout: 12_000 });

    await pageA.bringToFront();
    const aReadyFrames = sentFrames.get(pageA)!.filter((frame) => frame.includes('"type":"READY"')).length;
    await pageA.getByRole("button", { name: /Ready for the trail/i }).dispatchEvent("click");
    await expect.poll(() => sentFrames.get(pageA)!.filter((frame) => frame.includes('"type":"READY"')).length).toBeGreaterThan(aReadyFrames);
    await pageB.bringToFront();
    const bReadyFrames = sentFrames.get(pageB)!.filter((frame) => frame.includes('"type":"READY"')).length;
    await pageB.getByRole("button", { name: /Ready for the trail/i }).dispatchEvent("click");
    await expect.poll(() => sentFrames.get(pageB)!.filter((frame) => frame.includes('"type":"READY"')).length).toBeGreaterThan(bReadyFrames);
    await expect(pageA.locator('[data-scene="match"]')).toHaveAttribute("data-phase", "PLAYING", { timeout: 30_000 });
    await expect(pageB.locator('[data-scene="match"]')).toHaveAttribute("data-phase", "PLAYING", { timeout: 30_000 });
  } finally {
    await Promise.race([
      Promise.allSettled(contexts.map((context) => context.close())),
      new Promise((resolve) => setTimeout(resolve, 3_000)),
    ]);
  }
});

async function createContexts(browser: Browser, count: number) {
  return Promise.all(Array.from({ length: count }, () => browser.newContext({ viewport: { width: 1280, height: 720 } })));
}
