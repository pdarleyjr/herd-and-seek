import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import SoccerSetup from "./SoccerSetup";

describe("SoccerSetup", () => {
  let host: HTMLDivElement | null = null;

  afterEach(() => {
    host?.remove();
    host = null;
  });

  it("starts with Ranger Squad, quick play, and five-a-side selected", async () => {
    host = document.createElement("div");
    document.body.append(host);
    const onStart = vi.fn();
    const root = createRoot(host);

    await act(async () => root.render(<SoccerSetup playerName="Ranger" onStart={onStart} />));
    const start = host.querySelector<HTMLButtonElement>('button[data-testid="soccer-start"]');
    await act(async () => start?.click());

    expect(onStart).toHaveBeenCalledWith({ team: "coral", format: "quick", teamSize: 5 });
    expect(host.textContent).toContain("Ranger Squad");
    expect(host.textContent).toContain("Wild Herd");
    await act(async () => root.unmount());
  });

  it("allows a player to select the Wild Herd multiplayer team and compact format", async () => {
    host = document.createElement("div");
    document.body.append(host);
    const onStart = vi.fn();
    const root = createRoot(host);

    await act(async () => root.render(<SoccerSetup playerName="Ranger" onStart={onStart} />));
    const teal = host.querySelector<HTMLButtonElement>('button[data-team="teal"]');
    const crew = host.querySelector<HTMLButtonElement>('button[data-format="crew"]');
    const three = host.querySelector<HTMLButtonElement>('button[data-team-size="3"]');
    await act(async () => {
      teal?.click();
      crew?.click();
      three?.click();
    });
    await act(async () => host.querySelector<HTMLButtonElement>('button[data-testid="soccer-start"]')?.click());

    expect(onStart).toHaveBeenCalledWith({ team: "teal", format: "crew", teamSize: 3 });
    await act(async () => root.unmount());
  });

  it("offers a semantic back control", async () => {
    host = document.createElement("div");
    document.body.append(host);
    const onBack = vi.fn();
    const root = createRoot(host);

    await act(async () => root.render(<SoccerSetup playerName="Ranger" onStart={vi.fn()} onBack={onBack} />));
    await act(async () => host?.querySelector<HTMLButtonElement>('button[aria-label="Back to game modes"]')?.click());

    expect(onBack).toHaveBeenCalledOnce();
    await act(async () => root.unmount());
  });
});
