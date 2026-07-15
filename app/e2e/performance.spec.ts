import { expect, test } from "@playwright/test";

test("Forest gameplay maintains the bounded performance tier", async ({ page }, testInfo) => {
  await page.goto("/");
  await page.getByLabel(/Player name/i).fill(`Perf-${Date.now()}`);
  await page.getByRole("button", { name: /^PLAY$/i }).click();
  await page.getByRole("button", { name: /Solo vs AI/i }).click();
  await page.getByRole("button", { name: /^Animal Blend/i }).click();
  await page.getByLabel(/Solo round length/i).selectOption("30");
  await page.getByRole("button", { name: /Review expedition/i }).click();
  await page.getByRole("button", { name: /Start expedition/i }).click();
  const world = page.locator('[data-renderer="phaser"][data-scene="match"]');
  await expect(world).toHaveAttribute("data-phase", "PLAYING", { timeout: 20_000 });
  await expect(world).toHaveAttribute("data-fps", /\d/, { timeout: 10_000 });

  const report = await page.evaluate(async () => {
    const deltas: number[] = [];
    let previous = performance.now();
    await new Promise<void>((resolve) => {
      const sample = (now: number) => {
        deltas.push(now - previous);
        previous = now;
        if (deltas.length >= 180) resolve();
        else requestAnimationFrame(sample);
      };
      requestAnimationFrame(sample);
    });
    const usable = deltas.slice(5);
    const fpsSamples = usable.map((delta) => 1000 / Math.max(delta, 0.1)).sort((a, b) => a - b);
    const memory = (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory;
    return {
      averageFps: fpsSamples.reduce((sum, value) => sum + value, 0) / fpsSamples.length,
      onePercentLowFps: fpsSamples[Math.max(0, Math.floor(fpsSamples.length * 0.01))],
      maxFrameMs: Math.max(...usable),
      canvasCount: document.querySelectorAll('[data-scene="match"] canvas').length,
      usedJsHeapBytes: memory?.usedJSHeapSize ?? null,
    };
  });

  await testInfo.attach("performance-report.json", { body: JSON.stringify(report, null, 2), contentType: "application/json" });
  console.info(`PERF_REPORT ${JSON.stringify(report)}`);
  expect(report.canvasCount).toBe(1);
  const strict = process.env.PERF_STRICT === "1";
  expect(report.averageFps).toBeGreaterThanOrEqual(strict ? 30 : 20);
  // Chromium's headless timer reports a 50.1 ms frame as 19.96 FPS. Allow
  // that quantization at the 20 FPS boundary without relaxing the tier.
  expect(report.onePercentLowFps).toBeGreaterThanOrEqual(strict ? 19.5 : 9);
  expect(report.maxFrameMs).toBeLessThan(250);
});
