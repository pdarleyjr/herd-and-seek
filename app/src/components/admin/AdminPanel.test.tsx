import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import AdminPanel from "./AdminPanel";

describe("AdminPanel", () => {
  let host: HTMLDivElement | null = null;

  afterEach(() => {
    host?.remove();
    host = null;
  });

  it("supports an explicit session logout and never retains the passphrase", async () => {
    host = document.createElement("div");
    document.body.append(host);
    const onLogout = vi.fn();
    const root = createRoot(host);
    await act(async () => root.render(
      <AdminPanel authed denied={false} auditLog={[]} gameState={null} onAuth={vi.fn()} onCommand={vi.fn()} onClearDenied={vi.fn()} onLogout={onLogout} />,
    ));

    const logout = [...host.querySelectorAll("button")].find((button) => button.textContent?.includes("Log out"));
    expect(logout).toBeTruthy();
    await act(async () => logout?.click());
    expect(onLogout).toHaveBeenCalledOnce();
    expect(host.querySelector('input[type="password"]')).toBeNull();
    await act(async () => root.unmount());
  });
});
