import "./modeSelect.css";

interface ModeSelectProps {
  onMultiplayer: () => void;
  onSolo: () => void;
  onOpenWorld: () => void;
}

export default function ModeSelect({ onMultiplayer, onSolo, onOpenWorld }: ModeSelectProps) {
  return (
    <main className="mode-camp">
      <div className="mode-camp__sky" aria-hidden="true"><i /><i /><i /></div>
      <header className="mode-camp__header">
        <div className="mode-camp__mark" aria-hidden="true"><span>H</span><i /></div>
        <div><p>Herd &amp; Seek</p><span>Field Expedition Desk</span></div>
        <div className="mode-camp__status"><i /> Ranger network ready</div>
      </header>

      <section className="mode-camp__intro" aria-labelledby="choose-expedition">
        <p className="mode-camp__eyebrow">Choose an expedition</p>
        <h1 id="choose-expedition">Where will your trail begin?</h1>
        <p>Join friends for a live hunt, practice with a bot herd, or roam the reserve at your own pace.</p>
      </section>

      <section className="mode-camp__cards" aria-label="Game modes">
        <button type="button" className="mode-card mode-card--forest" onClick={onMultiplayer} aria-label="Multiplayer — create or join a private room">
          <ModeIllustration kind="multiplayer" />
          <span className="mode-card__tag">Live expedition</span>
          <strong>Multiplayer</strong>
          <span>Create or join a private room, choose a trail, and outsmart your friends.</span>
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
          <span>Explore five districts, follow quest markers, collect field finds, and earn rewards.</span>
          <span className="mode-card__action">Enter the reserve <b aria-hidden="true">→</b></span>
        </button>
      </section>

      <footer className="mode-camp__footer"><span>Keyboard, touch, and gamepad-ready controls</span><span>Private rooms · Server-authoritative play</span></footer>
    </main>
  );
}

function ModeIllustration({ kind }: { kind: "multiplayer" | "solo" | "reserve" }) {
  return (
    <span className={`mode-art mode-art--${kind}`} aria-hidden="true">
      <i className="mode-art__sun" />
      <i className="mode-art__hill mode-art__hill--back" />
      <i className="mode-art__hill mode-art__hill--front" />
      <i className="mode-art__tree"><b /></i>
      {kind === "multiplayer" && <><i className="mode-art__animal mode-art__animal--one" /><i className="mode-art__animal mode-art__animal--two" /></>}
      {kind === "solo" && <><i className="mode-art__target" /><i className="mode-art__ranger" /></>}
      {kind === "reserve" && <><i className="mode-art__lodge" /><i className="mode-art__trail" /></>}
    </span>
  );
}
