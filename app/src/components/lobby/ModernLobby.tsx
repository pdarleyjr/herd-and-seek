import { lazy, Suspense, useRef, useState } from "react";
import type { SerializedState, AnimalType, PerkType, LevelId, MatchMode, ClientMessage } from "../../types";
import { LEVELS, LEVEL_ORDER, ANIMAL_DEFS, PERK_OPTIONS, animalsForLevel } from "../../types";
import type { ConnectionStatus } from "../../types";
import "./modernLobby.css";
import "./modernLobbyOverrides.css";

const PhaserGame = lazy(() => import("../../game-engine/PhaserGame"));

interface ModernLobbyProps {
  username: string;
  userId: string;
  gameState: SerializedState | null;
  connectionStatus: ConnectionStatus;
  roomCode: string;
  isHost: boolean;
  level: number;
  coins: number;
  mode: MatchMode;
  selectedAnimal: AnimalType;
  selectedPerk: PerkType;
  selectedLevel: LevelId;
  onSelectAnimal: (a: AnimalType) => void;
  onSelectPerk: (p: PerkType) => void;
  onSelectLevel: (l: LevelId) => void;
  onSetDuration: (seconds: number) => void;
  onReady: (isReady: boolean) => void;
  onCopyCode: () => void;
  onLeave: () => void;
  onCloseRoom: () => void;
  onOpenWorld: () => void;
  onOpenShop: () => void;
  onOpenAdmin: () => void;
}

type MobileTab = "maps" | "animal" | "perk";

const PERK_MARKS: Record<PerkType, string> = { none: "—", sprint: "S", camouflage: "C", extraLife: "+", decoy: "D", speedBoost: "»" };

export default function ModernLobby(props: ModernLobbyProps) {
  const {
    username, userId, gameState, connectionStatus, roomCode, isHost, level, coins,
    selectedAnimal, selectedPerk, selectedLevel, onSelectAnimal, onSelectPerk,
    onSelectLevel, onSetDuration, onReady, onCopyCode, onLeave, onCloseRoom, onOpenShop, onOpenAdmin,
  } = props;
  const [copied, setCopied] = useState(false);
  const [tab, setTab] = useState<MobileTab>("animal");
  const localPosition = useRef({ x: 100, y: 100 });
  const me = gameState?.players.find((player) => player.id === userId);
  const humans = (gameState?.players ?? []).filter((player) => !player.isBot);
  const readyCount = humans.filter((player) => player.isReady).length;
  const selectedAnimalDef = ANIMAL_DEFS[selectedAnimal];

  const copyRoom = async () => {
    try { await navigator.clipboard.writeText(roomCode); } catch { /* clipboard can be unavailable */ }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1_500);
    onCopyCode();
  };

  return (
    <main className="lobby-v2" data-connection={connectionStatus} data-player-animal={me?.animalType ?? "loading"}>
      <div className="lobby-v2__sky" aria-hidden="true"><i /><i /><i /></div>
      <header className="lobby-v2__header">
        <div className="lobby-brand" aria-label="Herd and Seek">
          <span className="lobby-brand__mark" aria-hidden="true"><i /><i /></span>
          <div><strong>Herd &amp; Seek</strong><small>Field Camp</small></div>
        </div>
        <span className="lobby-mode">Private expedition</span>
        <button className="lobby-quiet-button lobby-admin-button" type="button" onClick={onOpenAdmin}>Admin</button>
        <button className="room-ticket" type="button" onClick={copyRoom} aria-label={`Copy room code ${roomCode}`}>
          <small>Room code</small><strong>{roomCode}</strong><span>{copied ? "Copied" : "Copy"}</span>
        </button>
        <div className={`connection-chip connection-chip--${connectionStatus}`} role="status"><i />{connectionLabel(connectionStatus)}</div>
        <button className="profile-stamp" type="button" onClick={onOpenShop} aria-label="Open profile and shop">
          <span>{username.slice(0, 1).toUpperCase()}</span><div><strong>{username}</strong><small>Level {level} · {coins} coins</small></div>
        </button>
        <button className="lobby-quiet-button" type="button" onClick={onLeave}>Leave</button>
        {isHost && <button className="lobby-quiet-button lobby-quiet-button--danger" type="button" onClick={onCloseRoom}>Close room</button>}
      </header>

      <nav className="lobby-mobile-tabs" aria-label="Lobby setup">
        {(["maps", "animal", "perk"] as MobileTab[]).map((item) => (
          <button key={item} type="button" className={tab === item ? "is-active" : ""} onClick={() => setTab(item)}>{item === "maps" ? "Map" : item === "animal" ? "Animal" : "Perk"}</button>
        ))}
      </nav>

      <div className="lobby-v2__workspace">
        <section className={`lobby-panel lobby-panel--maps ${tab === "maps" ? "is-mobile-active" : ""}`}>
          <PanelHeading kicker="Expedition map" title="Choose the terrain" />
          <div className="map-stack">
            {LEVEL_ORDER.map((id) => {
              const levelDef = LEVELS[id];
              return (
                <button key={id} type="button" className={`map-card map-card--${id} ${selectedLevel === id ? "is-choice-selected" : ""}`} onClick={() => onSelectLevel(id)} aria-pressed={selectedLevel === id}>
                  <span className="map-card__art" aria-hidden="true"><i /><i /><i /></span>
                  <span><strong>{levelDef.displayName}</strong><small>{levelDef.subtitle}</small></span>
                  <b aria-hidden="true">{selectedLevel === id ? "Selected" : "Explore"}</b>
                </button>
              );
            })}
          </div>
          <div className="room-brief">
            <small>Mission</small><strong>Stealth Hunt</strong><span>{gameState?.matchDuration ?? 120} seconds · {humans.length} rangers</span>
            <label className="duration-field"><span>Round length</span><select aria-label="Round length" value={gameState?.matchDuration ?? 120} disabled={!isHost} onChange={(event) => onSetDuration(Number(event.target.value))}>
              <option value={30}>30 seconds</option><option value={60}>1 minute</option><option value={120}>2 minutes</option><option value={180}>3 minutes</option><option value={300}>5 minutes</option>
            </select></label>
          </div>
        </section>

        <section className={`lobby-panel lobby-panel--preview ${tab === "animal" ? "is-mobile-active" : ""}`}>
          <div className="preview-heading"><PanelHeading kicker="Your disguise" title={selectedAnimalDef?.label ?? selectedAnimal} /><span>{LEVELS[selectedLevel].displayName}</span></div>
          <div className="lobby-phaser-preview">
            <Suspense fallback={<div className="preview-loading">Preparing character…</div>}>
              <PhaserGame variant="preview" userId={userId} username={username} gameState={null} localPosRef={localPosition} send={noopSend}
                selectedAnimal={selectedAnimal} selectedLevel={selectedLevel} selectedPerk={selectedPerk} />
            </Suspense>
            <div className="preview-caption"><strong>{selectedAnimalDef?.label}</strong><span>{selectedAnimalDef?.description ?? "A nimble member of the herd."}</span></div>
          </div>
          <div className="animal-strip" role="list" aria-label="Animal choices">
            {animalsForLevel(selectedLevel).map((animal) => {
              const def = ANIMAL_DEFS[animal];
              return (
                <button key={animal} type="button" className={selectedAnimal === animal ? "is-choice-selected" : ""} onClick={() => onSelectAnimal(animal)} aria-pressed={selectedAnimal === animal} aria-label={def.label}>
                  <AnimalPortrait animal={animal} label={def.label} color={def.color} /><span>{def.label}</span>
                </button>
              );
            })}
          </div>
        </section>

        <section className={`lobby-panel lobby-panel--perks ${tab === "perk" ? "is-mobile-active" : ""}`}>
          <PanelHeading kicker="Field kit" title="Choose one advantage" />
          <div className="perk-stack">
            {PERK_OPTIONS.map((perk) => (
              <button key={perk.value} type="button" className={selectedPerk === perk.value ? "is-choice-selected" : ""} onClick={() => onSelectPerk(perk.value)} aria-pressed={selectedPerk === perk.value}>
                <b aria-hidden="true">{PERK_MARKS[perk.value]}</b><span><strong>{perk.label}</strong><small>{perk.description}</small></span><i aria-hidden="true" />
              </button>
            ))}
          </div>
        </section>
      </div>

      <footer className="lobby-v2__footer">
        <section className="roster" aria-label="Player roster">
          <div><small>Expedition party</small><strong>{readyCount} of {Math.max(2, humans.length)} ready</strong></div>
          <ul>
            {humans.map((player) => <li key={player.id} className={player.isReady ? "is-ready" : ""}><span>{player.username.slice(0, 1).toUpperCase()}</span><b>{player.username}</b><i>{player.isReady ? "Ready" : "Packing"}</i></li>)}
            {humans.length < 2 && <li className="is-open"><span>+</span><b>Waiting for ranger</b><i>Share code</i></li>}
          </ul>
        </section>
        <div className="ready-copy" role="status">{humans.length < 2 ? "Invite one more player to begin the expedition." : readyCount < humans.length ? "Everyone must be ready before the countdown begins." : "Party ready. The trail opens now."}</div>
        <button className={`ready-dominant ${me?.isReady ? "is-ready" : ""}`} type="button" onClick={() => onReady(!(me?.isReady ?? false))} disabled={!me}>
          <span>{me?.isReady ? "Stand down" : "Ready for the trail"}</span><small>{me?.isReady ? "Tap to change loadout" : "Lock map, animal, and perk"}</small>
        </button>
      </footer>
    </main>
  );
}

function PanelHeading({ kicker, title }: { kicker: string; title: string }) {
  return <div className="panel-heading"><small>{kicker}</small><h2>{title}</h2></div>;
}

function AnimalPortrait({ animal, label, color }: { animal: AnimalType; label: string; color?: string }) {
  const hasPng = !ANIMAL_DEFS[animal].ocean && !ANIMAL_DEFS[animal].savannah;
  return <span className="animal-portrait" style={{ backgroundColor: color ?? "#b98750" }}>{hasPng ? <img src={`/assets/${animal}.png`} alt="" /> : <b aria-hidden="true">{label.slice(0, 2).toUpperCase()}</b>}</span>;
}

function connectionLabel(status: ConnectionStatus) {
  return ({ idle: "Camp idle", connecting: "Connecting", connected: "Live link", reconnecting: "Reconnecting", disconnected: "Offline", failed: "Link failed" } as const)[status];
}

function noopSend(message: ClientMessage) { void message; }
