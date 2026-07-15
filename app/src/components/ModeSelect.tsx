import "./modeSelect.css";
import AudioControls from "./AudioControls";
import ControlSettingsPanel from "./ControlSettingsPanel";

interface ModeSelectProps {
  onMultiplayer: () => void;
  onSolo: () => void;
  onOpenWorld: () => void;
  onSoccer: () => void;
}

export default function ModeSelect({ onMultiplayer, onSolo, onOpenWorld, onSoccer }: ModeSelectProps) {
  return (
    <main className="mode-camp">
      <div className="mode-camp__sky" aria-hidden="true"><i /><i /><i /></div>
      <header className="mode-camp__header">
        <div className="mode-camp__mark" aria-hidden="true"><span>H</span><i /></div>
        <div><p>Herd &amp; Seek</p><span>Field Expedition Desk</span></div>
        <div className="mode-camp__status"><i /> Ranger network ready</div>
        <AudioControls compact />
        <ControlSettingsPanel />
      </header>

      <section className="mode-camp__intro" aria-labelledby="choose-expedition">
        <p className="mode-camp__eyebrow">Choose an expedition</p>
        <h1 id="choose-expedition">Where will your trail begin?</h1>
        <p>Join friends for a live hunt, practice with a bot herd, or roam the reserve at your own pace.</p>
      </section>

      <section className="mode-camp__cards" aria-label="Game modes">
        <button type="button" className="mode-card mode-card--forest" onClick={onMultiplayer} aria-label="Multiplayer — browse public rooms or create a private room">
          <ModeIllustration kind="multiplayer" />
          <span className="mode-card__tag">Live expedition</span>
          <strong>Multiplayer</strong>
          <span>Browse live public rooms or lock a private expedition with a room name and password.</span>
          <span className="mode-card__action">Open room desk <b aria-hidden="true">→</b></span>
        </button>
        <button type="button" className="mode-card mode-card--solo" onClick={onSolo} aria-label="Solo vs AI — practice with bots">
          <ModeIllustration kind="solo" />
          <span className="mode-card__tag">Practice range</span>
          <strong>Solo vs AI</strong>
          <span>Set your role and difficulty, then learn the hunt against a responsive bot herd.</span>
          <span className="mode-card__action">Plan solo trail <b aria-hidden="true">→</b></span>
        </button>
        <button type="button" className="mode-card mode-card--reserve" onClick={onOpenWorld} aria-label="Open World — enter the Savannah Reserve">
          <ModeIllustration kind="reserve" />
          <span className="mode-card__tag">Persistent reserve</span>
          <strong>Open World</strong>
          <span>Explore seven seamless districts, follow quest markers, collect field finds, and earn rewards.</span>
          <span className="mode-card__action">Enter the reserve <b aria-hidden="true">→</b></span>
        </button>
        <button type="button" className="mode-card mode-card--soccer" onClick={onSoccer} aria-label="Field League soccer — choose a team and play">
          <ModeIllustration kind="soccer" />
          <span className="mode-card__tag">Field League</span>
          <strong>Striker Field</strong>
          <span>Choose the Ranger Squad or Wild Herd, then battle through a three-minute match.</span>
          <span className="mode-card__action">Take the field <b aria-hidden="true">→</b></span>
        </button>
      </section>

      <footer className="mode-camp__footer"><span>Keyboard and touch-ready controls</span><span>Public rooms · Private rooms · Server-authoritative play</span></footer>
    </main>
  );
}

function ModeIllustration({ kind }: { kind: "multiplayer" | "solo" | "reserve" | "soccer" }) {
  return (
    <span className={`mode-art mode-art--${kind}`} aria-hidden="true">
      <i className="mode-art__sun" />
      <i className="mode-art__hill mode-art__hill--back" />
      <i className="mode-art__hill mode-art__hill--front" />
      <i className="mode-art__tree"><b /></i>
      {kind === "multiplayer" && <><i className="mode-art__animal mode-art__animal--one" /><i className="mode-art__animal mode-art__animal--two" /></>}
      {kind === "solo" && <><i className="mode-art__target" /><i className="mode-art__ranger" /></>}
      {kind === "reserve" && <><i className="mode-art__lodge" /><i className="mode-art__trail" /></>}
      {kind === "soccer" && <><i className="mode-art__goal" /><i className="mode-art__ball" /></>}
    </span>
  );
}
