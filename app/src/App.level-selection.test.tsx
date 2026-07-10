import { act } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

import App from "./App";
import type { ServerMessage } from "./types";

const sendMock = vi.fn();

vi.mock("./useGameSocket", () => ({
  useGameSocket: (_userId: string, _username: string, onMessage: (data: ServerMessage) => void) => {
    void onMessage;
    return { send: sendMock, connected: true };
  },
}));

vi.mock("./AssetLoader", () => ({
  loadAssetsForLevel: vi.fn().mockResolvedValue({}),
  preloadAssetsForLevel: vi.fn(),
}));

vi.mock("./hooks/useProfile", () => ({
  useProfile: () => ({
    profile: null,
    setProfile: vi.fn(),
    refresh: vi.fn().mockResolvedValue(undefined),
  }),
}));

vi.mock("./SoundManager", () => ({
  soundManager: {
    unlock: vi.fn(),
    perk: vi.fn(),
    hit: vi.fn(),
    miss: vi.fn(),
    gameEnd: vi.fn(),
    gameStart: vi.fn(),
  },
}));

vi.mock("./hooks/useViewportInfo", () => ({
  useViewportInfo: () => ({
    width: 1440,
    height: 900,
    layoutMode: "desktop",
    isCompact: false,
    isTouch: false,
    isPhone: false,
    isTablet: false,
    isDesktop: true,
    isPortrait: false,
    isLandscape: true,
    renderDprCap: 2,
    syncIntervalMs: 1000 / 30,
  }),
}));

vi.mock("./GameCanvas", () => ({
  default: () => <div data-testid="game-canvas" />,
}));

vi.mock("./components/home/HomeScreen", () => ({
  default: () => <div data-testid="home-screen" />,
}));

vi.mock("./components/lobby/LobbyScene", () => ({
  default: ({
    selectedLevel,
    onSelectLevel,
  }: {
    selectedLevel: string;
    onSelectLevel: (level: "forest" | "deepDark") => void;
  }) => (
    <div>
      <div data-testid="selected-level">{selectedLevel}</div>
      <button type="button" onClick={() => onSelectLevel("forest")}>
        forest
      </button>
      <button type="button" onClick={() => onSelectLevel("deepDark")}>
        deep dark
      </button>
    </div>
  ),
}));

describe("App lobby level selection", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    sendMock.mockClear();
    sessionStorage.clear();
    localStorage.clear();
    sessionStorage.setItem("hs_sessionId", "session-1");
    localStorage.setItem("hs_username", "Tester");

    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it("renders the lobby without waiting on asset preload and switches levels immediately", async () => {
    await act(async () => {
      root.render(<App />);
    });

    expect(container.querySelector('[data-testid="selected-level"]')?.textContent).toBe("forest");

    const buttons = Array.from(container.querySelectorAll("button"));
    const deepDarkButton = buttons.find((button) => button.textContent === "deep dark");
    const forestButton = buttons.find((button) => button.textContent === "forest");

    expect(deepDarkButton).toBeTruthy();
    expect(forestButton).toBeTruthy();

    await act(async () => {
      deepDarkButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(container.querySelector('[data-testid="selected-level"]')?.textContent).toBe("deepDark");
    expect(sendMock).toHaveBeenCalledWith({
      type: "SELECT_LEVEL",
      payload: { levelId: "deepDark" },
    });

    await act(async () => {
      forestButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(container.querySelector('[data-testid="selected-level"]')?.textContent).toBe("forest");
    expect(sendMock).toHaveBeenCalledWith({
      type: "SELECT_LEVEL",
      payload: { levelId: "forest" },
    });
  });
});
