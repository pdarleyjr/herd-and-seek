import { useState } from "react";
import type { PlayerProfile } from "../../economy";
import { SHOP_ITEMS } from "../../economy";
import { purchaseCosmetic, selectCosmetic } from "../../profileService";

interface ShopModalProps {
  userId: string;
  username: string;
  profile: PlayerProfile | null;
  onProfileChange: (p: PlayerProfile) => void;
  onClose: () => void;
}

const ERROR_LABELS: Record<string, string> = {
  insufficient_funds: "Not enough currency.",
  already_owned: "You already own this.",
  unknown_item: "Item unavailable.",
  network_error: "Network error — try again.",
};

// Cosmetics shop. Purchases and equips are server-authoritative (profile DO);
// this modal only issues requests and reflects the returned profile.
export default function ShopModal({
  userId,
  username,
  profile,
  onProfileChange,
  onClose,
}: ShopModalProps) {
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const owned = new Set(profile?.ownedCosmetics ?? []);
  const selected = profile?.selectedCosmetic ?? null;

  const handleBuy = async (id: string) => {
    setBusy(id);
    setMessage(null);
    const res = await purchaseCosmetic(userId, username, id);
    if (res.profile) onProfileChange(res.profile);
    if (!res.ok) setMessage(ERROR_LABELS[res.error ?? "network_error"] ?? "Purchase failed.");
    setBusy(null);
  };

  const handleEquip = async (id: string | null) => {
    setBusy(id ?? "none");
    const next = await selectCosmetic(userId, username, id);
    if (next) onProfileChange(next);
    setBusy(null);
  };

  return (
    <div
      className="absolute inset-0 z-40 flex items-center justify-center bg-black/70 px-4"
      style={{ touchAction: "manipulation" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg max-h-[85dvh] overflow-y-auto rounded-2xl border-2 border-[#8b5c1e] p-4 sm:p-5"
        style={{ background: "linear-gradient(135deg, #2c1a0b 0%, #140b04 100%)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[#f5d07a] font-extrabold text-lg sm:text-xl">Cosmetics Shop</h2>
          <div className="flex items-center gap-3 text-sm font-bold">
            <span className="text-[#f5d07a]">🪙 {(profile?.coins ?? 0).toLocaleString()}</span>
            <span className="text-[#ffd86a]">🎖 {(profile?.badges ?? 0).toLocaleString()}</span>
            <button
              onClick={onClose}
              className="px-2.5 py-1 rounded-lg bg-[#5a3a1a] text-[#f5d07a] active:scale-95"
              style={{ touchAction: "manipulation" }}
            >
              ✕
            </button>
          </div>
        </div>

        {message && (
          <p className="mb-2 text-xs text-[#ff9a5a] font-semibold">{message}</p>
        )}

        <div className="grid grid-cols-2 gap-2.5">
          {SHOP_ITEMS.map((item) => {
            const isOwned = owned.has(item.id);
            const isSelected = selected === item.id;
            return (
              <div
                key={item.id}
                className="rounded-xl border-2 p-2.5 flex flex-col gap-1.5"
                style={{
                  borderColor: isSelected ? "#7fff00" : "#5a3a1a",
                  background: "rgba(42,24,8,0.7)",
                }}
              >
                <div className="flex items-center gap-2">
                  <span style={{ fontSize: 22 }}>{item.emoji}</span>
                  <div className="min-w-0">
                    <p className="text-[#f5d07a] font-bold text-xs leading-tight truncate">{item.name}</p>
                    <p className="text-[#9a7a4a] text-[10px] leading-tight">{item.kind}</p>
                  </div>
                </div>
                <p className="text-[#cdb88a] text-[10px] leading-snug min-h-[28px]">{item.description}</p>
                <div className="flex items-center justify-between mt-auto">
                  <span className="text-[#f5d07a] text-xs font-bold">
                    {item.currency === "coins" ? "🪙" : "🎖"} {item.price}
                  </span>
                  {isOwned ? (
                    <button
                      disabled={busy !== null}
                      onClick={() => handleEquip(isSelected ? null : item.id)}
                      className="px-2 py-1 rounded-lg text-[11px] font-bold active:scale-95 select-none"
                      style={{
                        background: isSelected ? "#7fff00" : "#3a5a1a",
                        color: isSelected ? "#000" : "#cfe8b0",
                        touchAction: "manipulation",
                      }}
                    >
                      {isSelected ? "Equipped" : "Equip"}
                    </button>
                  ) : (
                    <button
                      disabled={busy !== null}
                      onClick={() => handleBuy(item.id)}
                      className="px-2 py-1 rounded-lg text-[11px] font-bold bg-[#d4a010] text-black active:scale-95 disabled:opacity-50 select-none"
                      style={{ touchAction: "manipulation" }}
                    >
                      {busy === item.id ? "..." : "Buy"}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <p className="text-[#6b4a2a] text-[10px] mt-3 text-center">
          Earn coins & badges by playing matches. Balances are saved to your account.
        </p>
      </div>
    </div>
  );
}
