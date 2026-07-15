import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import SoloSetup from "./SoloSetup";

describe("SoloSetup", () => {
  let host: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    localStorage.clear();
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
  });

  afterEach(() => {
    act(() => root.unmount());
    host.remove();
  });

  it("offers Beginner as the recommended fair first match", async () => {
    await act(async () => root.render(<SoloSetup onStart={vi.fn()} onBack={vi.fn()} />));

    const beginner = [...host.querySelectorAll("button")].find((button) => button.textContent?.includes("Beginner"));
    expect(beginner).toBeTruthy();
    expect(beginner?.getAttribute("aria-pressed")).toBe("true");
    expect(host.textContent).toContain("head start");
    expect(host.textContent).toContain("intentional misses");
  });

  it("persists the field plan and requires a readable launch confirmation", async () => {
    const onStart = vi.fn();
    await act(async () => root.render(<SoloSetup onStart={onStart} onBack={vi.fn()} />));

    const savannah = [...host.querySelectorAll("button")].find((button) => button.textContent?.includes("Savannah at Dusk"));
    await act(async () => savannah?.click());
    const launch = [...host.querySelectorAll("button")].find((button) => button.textContent?.includes("Review expedition"));
    await act(async () => launch?.click());

    expect(onStart).not.toHaveBeenCalled();
    expect(host.querySelector('[role="dialog"]')?.textContent).toContain("Savannah at Dusk");
    const confirm = [...host.querySelectorAll("button")].find((button) => button.textContent?.includes("Start expedition"));
    await act(async () => confirm?.click());

    expect(onStart).toHaveBeenCalledWith(expect.objectContaining({ level: "savannah", difficulty: "beginner" }));
    expect(JSON.parse(localStorage.getItem("hs_solo_plan") ?? "{}"))
      .toMatchObject({ level: "savannah", difficulty: "beginner" });
  });
});
