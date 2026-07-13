import type { ConnectionStatus, PlayerState, SerializedState } from "../types";

interface GameHudProps {
  state: SerializedState;
  player?: PlayerState;
  eventLog: string[];
  connection: ConnectionStatus;
}

export default function GameHud({ state, player, eventLog, connection }: GameHudProps) {
  const isHunter = player?.isHunter ?? false;
  const ammoRatio = state.maxAmmo > 0 ? state.ammo / state.maxAmmo : 0;
  return (
    <div className="safari-hud" aria-label="Game status">
      <section className="safari-hud__objective" aria-live="polite">
        <p className="safari-hud__eyebrow">Current objective</p>
        <strong>{isHunter ? "Track the hidden herd" : "Blend in. Stay moving."}</strong>
        <span>{isHunter ? "Aim with the pointer and make every round count." : "Survive until the ranger clock expires."}</span>
      </section>

      <div className="safari-hud__timer" aria-label={`${state.timeRemaining} seconds remaining`}>
        <span className="safari-hud__compass" aria-hidden="true">N</span>
        <strong>{formatTime(state.timeRemaining)}</strong>
        <small>{state.levelId === "forest" ? "Fernwhistle Forest" : state.levelId === "deepDark" ? "The Deep Dark" : "Savannah at Dusk"}</small>
      </div>

      <section className="safari-hud__loadout">
        <div className="safari-hud__role">
          <span aria-hidden="true">{isHunter ? "◎" : "◇"}</span>
          <div><small>Your role</small><strong>{isHunter ? "Ranger" : "Herd animal"}</strong></div>
        </div>
        {isHunter ? (
          <div className="safari-hud__ammo" aria-label={`${state.ammo} of ${state.maxAmmo} rounds remaining`}>
            <div><small>Rounds</small><strong>{state.ammo}<span> / {state.maxAmmo}</span></strong></div>
            <div className="safari-hud__ammo-track"><i style={{ width: `${ammoRatio * 100}%` }} /></div>
          </div>
        ) : (
          <div className="safari-hud__perk"><small>Field skill</small><strong>{perkLabel(player?.perk ?? "none")}</strong></div>
        )}
      </section>

      <section className="safari-hud__events" aria-live="polite" aria-label="Match events">
        <p className="safari-hud__eyebrow">Field notes</p>
        {eventLog.length ? eventLog.slice(0, 3).map((event, index) => <span key={`${event}-${index}`}>{event}</span>) : <span>The hunt has begun. Watch the tree line.</span>}
      </section>

      <div className={`safari-hud__connection safari-hud__connection--${connection}`} role="status">
        <i aria-hidden="true" />{connection === "connected" ? "Live link" : connection}
      </div>
    </div>
  );
}

function formatTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  return `${minutes.toString().padStart(2, "0")}:${Math.max(0, seconds % 60).toString().padStart(2, "0")}`;
}

function perkLabel(perk: PlayerState["perk"]): string {
  return ({ none: "No field skill", sprint: "Sprinting dash", camouflage: "Camouflage freeze", extraLife: "Second chance", decoy: "Decoy drop", speedBoost: "Fleet foot" } as const)[perk];
}
