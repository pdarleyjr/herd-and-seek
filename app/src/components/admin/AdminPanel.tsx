import { useEffect, useState } from "react";
import type {
  AdminAuditEntry,
  AdminCommand,
  LevelId,
  SerializedState,
} from "../../types";
import { LEVEL_ORDER, LEVELS } from "../../types";

interface AdminPanelProps {
  authed: boolean;
  denied: boolean;
  auditLog: AdminAuditEntry[];
  gameState: SerializedState | null;
  onAuth: (key: string) => void;
  onCommand: (
    command: AdminCommand,
    extra?: { levelId?: LevelId; duration?: number; targetId?: string },
  ) => void;
  onClearDenied: () => void;
  onLogout: () => void;
  revealSignal?: number;
}

// Hidden admin control plane. Access is a two-stage reveal (gesture surfaces the
// passphrase prompt; the server verifies the passphrase). The gesture itself
// never grants access — authorization is enforced server-side in the Worker.
export default function AdminPanel({
  authed,
  denied,
  auditLog,
  gameState,
  onAuth,
  onCommand,
  onClearDenied,
  onLogout,
  revealSignal = 0,
}: AdminPanelProps) {
  const [promptOpen, setPromptOpen] = useState(revealSignal > 0 && !authed);
  const [dismissedRevealSignal, setDismissedRevealSignal] = useState(0);
  const [drawerHidden, setDrawerHidden] = useState(false);
  const [keyInput, setKeyInput] = useState("");

  // Desktop reveal: Ctrl+Shift+A.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && (e.key === "A" || e.key === "a")) {
        e.preventDefault();
        setPromptOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // The passphrase prompt is only rendered while unauthenticated; the drawer is
  // shown whenever authenticated and not manually hidden (no effect needed).
  const drawerOpen = authed && !drawerHidden;
  const promptVisible = !authed && (promptOpen || revealSignal > dismissedRevealSignal);
  const closePrompt = () => {
    setPromptOpen(false);
    setDismissedRevealSignal(revealSignal);
    setKeyInput("");
    onClearDenied();
  };

  const submitAuth = () => {
    if (keyInput.trim()) {
      onClearDenied();
      onAuth(keyInput.trim());
      setKeyInput("");
    }
  };

  return (
    <>
      {/* Passphrase prompt */}
      {promptVisible && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4"
          role="presentation"
          onClick={closePrompt}
        >
          <div
            className="w-full max-w-xs rounded-2xl border-2 border-[#8b5c1e] p-4"
            style={{ background: "linear-gradient(135deg,#2c1a0b,#140b04)" }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-access-title"
          >
            <h3 id="admin-access-title" className="text-[#f5d07a] font-bold text-lg mb-2">Admin Access</h3>
            <input
              type="password"
              value={keyInput}
              autoFocus
              onChange={(e) => setKeyInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submitAuth()}
              placeholder="Passphrase"
              className="w-full px-3 py-2 rounded-lg bg-[#1a0f05] border border-[#8b5c1e] text-[#f5d07a] text-sm focus:outline-none focus:border-[#7fff00]"
              style={{ touchAction: "manipulation" }}
            />
            {denied && (
              <p className="text-[#ff8a79] text-sm mt-2" role="alert">Access denied. Check the passphrase or ask the host to confirm the server admin secret.</p>
            )}
            <div className="flex gap-2 mt-3">
              <button
                onClick={submitAuth}
                className="flex-1 py-2 rounded-lg bg-[#7fff00] text-black text-sm font-bold active:scale-95"
                style={{ touchAction: "manipulation" }}
              >
                Unlock
              </button>
              <button
                onClick={closePrompt}
                className="px-3 py-2 rounded-lg bg-[#5a3a1a] text-[#f5d07a] text-sm active:scale-95"
                style={{ touchAction: "manipulation" }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Admin drawer */}
      {authed && drawerOpen && (
        <aside className="fixed inset-0 z-50 w-full flex flex-col border-l-2 border-[#8b5c1e] shadow-2xl md:inset-y-0 md:left-auto md:right-0 md:w-[360px] md:max-w-[42vw]"
          style={{ background: "linear-gradient(135deg,#241608,#0f0803)", touchAction: "manipulation" }}
          aria-label="Admin Panel"
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#5a3a1a]">
            <div><small className="text-[#c8a05a] uppercase tracking-widest">Authorized session</small><h3 className="text-[#f5d07a] font-extrabold text-lg">Admin Panel</h3></div>
            <div className="flex gap-2"><button onClick={onLogout} className="min-h-11 px-3 py-2 rounded bg-[#7a2a1a] text-[#ffd0c0] text-xs font-bold active:scale-95">Log out</button><button onClick={() => setDrawerHidden(true)} className="min-h-11 px-3 py-2 rounded bg-[#5a3a1a] text-[#f5d07a] text-xs font-bold active:scale-95">Hide</button></div>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-4">
            {/* Live match control */}
            <section>
              <p className="text-[#c8a05a] text-[10px] uppercase tracking-wide mb-1.5">Match Control</p>
              <div className="grid grid-cols-2 gap-1.5">
                <AdminButton label="Force Start" onClick={() => onCommand("force_start")} />
                <AdminButton label="End Match" onClick={() => onCommand("end_match")} />
                <AdminButton label="Reset Room" onClick={() => onCommand("reset_room")} />
                <AdminButton label="Clear Bots" onClick={() => onCommand("clear_bots")} />
              </div>
            </section>

            {/* Level + duration */}
            <section>
              <p className="text-[#c8a05a] text-[10px] uppercase tracking-wide mb-1.5">Level</p>
              <div className="grid grid-cols-3 gap-1.5">
                {LEVEL_ORDER.map((id) => (
                  <AdminButton
                    key={id}
                    label={LEVELS[id].displayName}
                    active={gameState?.levelId === id}
                    onClick={() => onCommand("set_level", { levelId: id })}
                  />
                ))}
              </div>
              <p className="text-[#c8a05a] text-[10px] uppercase tracking-wide mt-2 mb-1.5">Duration</p>
              <div className="grid grid-cols-4 gap-1.5">
                {[30, 60, 120, 300].map((d) => (
                  <AdminButton
                    key={d}
                    label={d < 60 ? `${d}s` : `${d / 60}m`}
                    onClick={() => onCommand("set_duration", { duration: d })}
                  />
                ))}
              </div>
            </section>

            {/* Player management */}
            <section>
              <p className="text-[#c8a05a] text-[10px] uppercase tracking-wide mb-1.5">
                Players ({gameState?.players.length ?? 0})
              </p>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {(gameState?.players ?? []).map((p) => (
                  <div key={p.id} className="flex items-center gap-2 text-xs">
                    <span className="truncate flex-1 text-[#e8c87a]">
                      {p.isHunter ? "🎯" : "🐾"} {p.username}{p.isBot ? " 🤖" : ""}
                    </span>
                    {!p.isBot && (
                      <button
                        onClick={() => onCommand("kick", { targetId: p.id })}
                        className="px-2 py-0.5 rounded bg-[#7a2a1a] text-[#ffd0c0] text-[10px] active:scale-95"
                      >
                        Kick
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </section>

            {/* Audit log */}
            <section>
              <p className="text-[#c8a05a] text-[10px] uppercase tracking-wide mb-1.5">Audit Log</p>
              <div className="space-y-1 max-h-48 overflow-y-auto text-[10px] text-[#bda67a]">
                {auditLog.length === 0 && <p className="text-[#6b4a2a]">No actions yet.</p>}
                {auditLog.map((e, i) => (
                  <div key={i} className="border-b border-[#3a2612] pb-1">
                    <span className="text-[#f5d07a] font-semibold">{e.action}</span> — {e.detail}
                    <span className="block text-[#6b4a2a]">
                      {new Date(e.ts).toLocaleTimeString()}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </aside>
      )}

      {/* Collapsed re-open tab once authed */}
      {authed && !drawerOpen && (
        <button
          onClick={() => setDrawerHidden(false)}
          className="fixed bottom-3 right-3 z-50 px-3 py-2 rounded-full bg-[#8b5c1e] text-[#f5d07a] text-xs font-bold shadow-lg active:scale-95"
          style={{ touchAction: "manipulation" }}
        >
          Admin
        </button>
      )}
    </>
  );
}

function AdminButton({
  label,
  onClick,
  active,
}: {
  label: string;
  onClick: () => void;
  active?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className="min-h-11 px-2 py-2 rounded-lg text-[11px] font-bold border active:scale-95 select-none"
      style={{
        borderColor: active ? "#7fff00" : "#5a3a1a",
        background: active ? "rgba(127,255,0,0.15)" : "rgba(42,24,8,0.8)",
        color: active ? "#7fff00" : "#e8c87a",
        touchAction: "manipulation",
      }}
    >
      {label}
    </button>
  );
}
