import { expect, test, type Page } from "@playwright/test";

async function startAnimal(page: Page, perk: string) {
  await page.goto("/");
  await page.getByLabel(/Player name/i).fill(`Perk-${perk}-${Date.now()}`);
  await page.getByRole("button", { name: /^PLAY$/i }).click();
  await page.getByRole("button", { name: /Solo vs AI/i }).click();
  const animalRole = page.getByRole("button", { name: /^Animal Blend/i });
  await animalRole.click();
  await expect(animalRole).toHaveAttribute("aria-pressed", "true");
  const perkSelect = page.getByLabel(/Solo perk/i);
  await perkSelect.selectOption(perk);
  await expect(perkSelect).toHaveValue(perk);
  const durationSelect = page.getByLabel(/Solo round length/i);
  await durationSelect.selectOption("30");
  await expect(durationSelect).toHaveValue("30");
  await page.getByRole("button", { name: /Start solo expedition/i }).click();
  const world = page.locator('[data-renderer="phaser"][data-scene="match"]');
  await expect(world).toHaveAttribute("data-phase", "PLAYING", { timeout: 20_000 });
  if (perk !== "extraLife") await expect(world).toHaveAttribute("data-perk", perk);
  return world;
}

for (const perk of ["sprint", "camouflage"] as const) {
  test(`${perk} activates authoritatively and publishes cooldown state`, async ({ page }) => {
    const world = await startAnimal(page, perk);
    await page.getByRole("button", { name: new RegExp(`Activate ${perk}`, "i") }).click();
    await expect.poll(async () => Number(await world.getAttribute("data-perk-active-until"))).toBeGreaterThan(Date.now());
    await expect.poll(async () => Number(await world.getAttribute("data-perk-cooldown-until"))).toBeGreaterThan(Date.now());
  });
}

test("decoy activation is server-authoritative and becomes network-visible", async ({ page }) => {
  const world = await startAnimal(page, "decoy");
  await page.getByRole("button", { name: /Activate decoy/i }).click();
  await expect.poll(async () => Number(await world.getAttribute("data-perk-active-until"))).toBeGreaterThan(Date.now());
  await expect(world).not.toHaveAttribute("data-decoy-owner", "");
});

for (const perk of ["speedBoost", "extraLife", "none"] as const) {
  test(`${perk} is not advertised as a manual active ability`, async ({ page }) => {
    const world = await startAnimal(page, perk);
    if (perk === "extraLife") {
      const current = await world.getAttribute("data-perk");
      expect(["extraLife", "none"]).toContain(current);
      if (current === "none") await expect(world).toHaveAttribute("data-extra-life-used", "true");
    } else {
      await expect(world).toHaveAttribute("data-perk", perk);
    }
    await expect(world).toHaveAttribute("data-perk-active-until", "0");
    await expect(page.getByRole("button", { name: /^Activate /i })).toHaveCount(0);
  });
}
