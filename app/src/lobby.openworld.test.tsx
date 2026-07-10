import { describe, it, expect, vi } from "vitest";
import { createRoot } from "react-dom/client";
import { act } from "react";
import LobbyScene from "./components/lobby/LobbyScene";
import type { AnimalType, PerkType, LevelId } from "./types";

// jsdom lacks matchMedia, which useViewportInfo relies on.
if (typeof window !== "undefined" && !window.matchMedia) {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

function renderLobby(onOpenWorld: () => void) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(
      <LobbyScene
        username="Tester"
        userId="u1"
        gameState={null}
        connected
        selectedAnimal={"rabbit" as AnimalType}
        selectedPerk={"none" as PerkType}
        selectedLevel={"forest" as LevelId}
        onSelectAnimal={() => {}}
        onSelectPerk={() => {}}
        onSelectLevel={() => {}}
        onSetDuration={() => {}}
        onReady={() => {}}
        onOpenWorld={onOpenWorld}
      />,
    );
  });
  return { container, root };
}

describe("lobby open-world entry", () => {
  it("renders the Open World button and opens open-world on click", () => {
    const onOpenWorld = vi.fn();
    const { container, root } = renderLobby(onOpenWorld);

    const button = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.includes("Open World"),
    );
    expect(button).toBeTruthy();

    act(() => {
      button!.click();
    });
    expect(onOpenWorld).toHaveBeenCalledTimes(1);

    act(() => root.unmount());
    container.remove();
  });
});
