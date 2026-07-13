import { act } from "react";
import { createRoot } from "react-dom/client";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import RoomBrowser from "./RoomBrowser";
import { createRoom, joinRoom, listPublicRooms } from "../services/roomDirectory";

vi.mock("../services/roomDirectory", () => ({
  createRoom: vi.fn(),
  joinRoom: vi.fn(),
  listPublicRooms: vi.fn(),
  roomDirectoryErrorMessage: (error: unknown) => error instanceof Error ? error.message : "Something went wrong.",
}));

const publicRoom = {
  roomId: "RIVER-123",
  name: "River Run",
  visibility: "public" as const,
  playerCount: 2,
  maxPlayers: 8,
  phase: "LOBBY" as const,
  joinable: true,
  createdAt: 1,
  updatedAt: 2,
};

beforeAll(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

function mount(props: Partial<React.ComponentProps<typeof RoomBrowser>> = {}) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  const callbacks = {
    onCreate: vi.fn(),
    onJoin: vi.fn(),
    onBack: vi.fn(),
    ...props,
  };
  act(() => root.render(<RoomBrowser {...callbacks} />));
  return { container, root, callbacks };
}

function input(container: HTMLElement, label: string): HTMLInputElement {
  const match = Array.from(container.querySelectorAll("label")).find((node) => node.textContent?.includes(label));
  const control = match?.querySelector("input");
  if (!control) throw new Error(`Missing input: ${label}`);
  return control;
}

function button(container: HTMLElement, label: string): HTMLButtonElement {
  const match = Array.from(container.querySelectorAll("button")).find((node) => node.textContent?.includes(label));
  if (!match) throw new Error(`Missing button: ${label}`);
  return match;
}

function changeInput(control: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  act(() => {
    setter?.call(control, value);
    control.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

async function flush() {
  await act(async () => {
    await new Promise((resolve) => window.setTimeout(resolve, 0));
    await Promise.resolve();
  });
}

describe("RoomBrowser", () => {
  beforeEach(() => {
    vi.mocked(listPublicRooms).mockResolvedValue([publicRoom]);
    vi.mocked(createRoom).mockResolvedValue({ room: publicRoom });
    vi.mocked(joinRoom).mockResolvedValue({ room: publicRoom });
  });

  it("shows the create controls beside a refreshing public-room list", async () => {
    const { container, root } = mount();
    await flush();

    expect(container.textContent).toContain("Create a room");
    expect(container.textContent).toContain("Public rooms");
    expect(container.textContent).toContain("River Run");
    expect(container.textContent).toContain("2 / 8");
    expect(listPublicRooms).toHaveBeenCalledTimes(1);

    act(() => root.unmount());
    container.remove();
  });

  it("uses regulation 3v3 and 5v5 capacities for soccer rooms", async () => {
    const { container, root } = mount({ activity: "soccer", defaultMaxPlayers: 6 });
    await flush();
    const select = container.querySelector<HTMLSelectElement>(".room-player-count select");
    expect(select?.value).toBe("6");
    expect(Array.from(select?.options ?? []).map((option) => option.value)).toEqual(["6"]);
    expect(listPublicRooms).toHaveBeenCalledWith(expect.any(AbortSignal), "soccer");
    act(() => root.unmount());
    container.remove();
  });

  it("creates a password-protected room and passes only its opaque token onward", async () => {
    vi.mocked(createRoom).mockResolvedValue({ room: { ...publicRoom, roomId: "MOON-456", name: "Moon Camp", visibility: "private" }, accessToken: "private-token" });
    const { container, root, callbacks } = mount();
    await flush();

    changeInput(input(container, "Room name"), "Moon Camp");
    act(() => button(container, "Private").click());
    changeInput(input(container, "Room password"), "moon-pass");
    await act(async () => button(container, "Create room").click());

    expect(createRoom).toHaveBeenCalledWith(expect.objectContaining({ name: "Moon Camp", visibility: "private", password: "moon-pass" }));
    expect(callbacks.onCreate).toHaveBeenCalledWith("MOON-456", "private-token");

    act(() => root.unmount());
    container.remove();
  });

  it("joins a private room by explicit name and password", async () => {
    vi.mocked(joinRoom).mockResolvedValue({ room: { ...publicRoom, roomId: "HIDE-789", name: "Hidden Hollow", visibility: "private" }, accessToken: "join-token" });
    const { container, root, callbacks } = mount();
    await flush();

    changeInput(input(container, "Private room name"), "Hidden Hollow");
    changeInput(input(container, "Private room password"), "hidden-pass");
    await act(async () => button(container, "Join private room").click());

    expect(joinRoom).toHaveBeenCalledWith({ roomName: "Hidden Hollow", password: "hidden-pass", activity: "hunt" });
    expect(callbacks.onJoin).toHaveBeenCalledWith("HIDE-789", "join-token");

    act(() => root.unmount());
    container.remove();
  });

  it("keeps direct room-code joining compatible", async () => {
    const { container, root, callbacks } = mount();
    await flush();
    changeInput(input(container, "Room code"), "abcd-efgh");
    act(() => button(container, "Join by code").click());
    expect(callbacks.onJoin).toHaveBeenCalledWith("ABCD-EFGH", undefined);

    act(() => root.unmount());
    container.remove();
  });

  it("shows inline guidance before sending incomplete create, private, or code requests", async () => {
    const { container, root, callbacks } = mount();
    await flush();

    act(() => button(container, "Create room").click());
    expect(container.textContent).toContain("at least 3 characters");
    changeInput(input(container, "Room name"), "Valid Camp");
    act(() => button(container, "Private").click());
    changeInput(input(container, "Room password"), "short");
    act(() => button(container, "Create room").click());
    expect(container.textContent).toContain("at least 8 characters");

    act(() => button(container, "Join private room").click());
    expect(container.textContent).toContain("Enter the private room name and password");
    changeInput(input(container, "Room code"), "x");
    act(() => button(container, "Join by code").click());
    expect(container.textContent).toContain("Enter a valid room code");
    expect(createRoom).not.toHaveBeenCalled();
    expect(callbacks.onJoin).not.toHaveBeenCalled();

    act(() => root.unmount());
    container.remove();
  });

  it("joins a listed public room and reports a subsequent stale-room failure", async () => {
    const { container, root, callbacks } = mount();
    await flush();
    const joinButton = container.querySelector<HTMLButtonElement>(".room-public-card button");
    expect(joinButton).toBeTruthy();
    await act(async () => joinButton!.click());
    expect(joinRoom).toHaveBeenCalledWith({ roomId: "RIVER-123", activity: "hunt" });
    expect(callbacks.onJoin).toHaveBeenCalledWith("RIVER-123", undefined);

    vi.mocked(joinRoom).mockRejectedValueOnce(new Error("That camp just filled up."));
    await act(async () => joinButton!.click());
    await flush();
    expect(container.textContent).toContain("That camp just filled up.");
    expect(listPublicRooms).toHaveBeenCalledTimes(2);

    act(() => root.unmount());
    container.remove();
  });

  it("renders directory errors and supports retry and back navigation", async () => {
    vi.mocked(listPublicRooms).mockRejectedValueOnce(new Error("Directory is resting."));
    const { container, root, callbacks } = mount();
    await flush();
    expect(container.textContent).toContain("Directory is resting.");

    vi.mocked(listPublicRooms).mockResolvedValueOnce([]);
    act(() => button(container, "Refresh").click());
    await flush();
    expect(container.textContent).toContain("Quiet trail—for now");
    act(() => button(container, "Modes").click());
    expect(callbacks.onBack).toHaveBeenCalledTimes(1);

    act(() => root.unmount());
    container.remove();
  });

  it("surfaces create and private-join service errors without navigating", async () => {
    vi.mocked(createRoom).mockRejectedValueOnce(new Error("Name is already active."));
    vi.mocked(joinRoom).mockRejectedValueOnce(new Error("Room name or password is incorrect."));
    const { container, root, callbacks } = mount();
    await flush();

    changeInput(input(container, "Room name"), "Taken Camp");
    await act(async () => button(container, "Create room").click());
    expect(container.textContent).toContain("Name is already active.");

    changeInput(input(container, "Private room name"), "Hidden Hollow");
    changeInput(input(container, "Private room password"), "wrong-pass");
    await act(async () => button(container, "Join private room").click());
    expect(container.textContent).toContain("Room name or password is incorrect.");
    expect(callbacks.onCreate).not.toHaveBeenCalled();
    expect(callbacks.onJoin).not.toHaveBeenCalled();

    act(() => root.unmount());
    container.remove();
  });
});
