import { useState } from "react";
import type { SoccerTeamId } from "../game-engine/soccer";
import "./soccerSetup.css";

export type SoccerFormat = "quick" | "crew";

export interface SoccerSetupSelection {
  team: SoccerTeamId;
  format: SoccerFormat;
  teamSize: 3 | 5;
}

interface SoccerSetupProps {
  playerName: string;
  onStart: (selection: SoccerSetupSelection) => void;
  onBack?: () => void;
}

const TEAM_COPY = {
  coral: {
    name: "Ranger Squad",
    callout: "Trail guardians",
    description: "Block-built rangers with sharp passing and a fearless press.",
  },
  teal: {
    name: "Wild Herd",
    callout: "Hooves in motion",
    description: "Fast-footed reserve animals that break into space as one herd.",
  },
} satisfies Record<SoccerTeamId, { name: string; callout: string; description: string }>;

export default function SoccerSetup({ playerName, onStart, onBack }: SoccerSetupProps) {
  const [team, setTeam] = useState<SoccerTeamId>("coral");
  const [format, setFormat] = useState<SoccerFormat>("quick");
  const [teamSize, setTeamSize] = useState<3 | 5>(5);
  const selection: SoccerSetupSelection = { team, format, teamSize };

  return (
    <main className={`soccer-setup soccer-setup--${team}`}>
      <div className="soccer-setup__sky" aria-hidden="true"><i /><i /><i /><i /></div>
      <header className="soccer-setup__topbar">
        <button type="button" className="soccer-setup__back" onClick={onBack} aria-label="Back to game modes">
          <span aria-hidden="true">←</span> Modes
        </button>
        <div className="soccer-setup__league-mark" aria-label="Herd and Seek Field League">
          <span aria-hidden="true"><i /><b /></span>
          <div><strong>Field League</strong><small>Herd &amp; Seek</small></div>
        </div>
        <p className="soccer-setup__player"><span>Captain</span><strong>{playerName || "Ranger"}</strong></p>
      </header>

      <section className="soccer-setup__stage" aria-labelledby="soccer-setup-heading">
        <div className="soccer-setup__copy">
          <p className="soccer-setup__eyebrow">Rangers versus animals. Three minutes.</p>
          <h1 id="soccer-setup-heading">Choose your side.</h1>
          <p>Lead the Ranger Squad or the Wild Herd through quick passes, brave tackles, and one enormous final whistle.</p>
          <div className="soccer-setup__match-note">
            <span aria-hidden="true"><i /><i /><i /></span>
            <p><strong>Drop-in friendly</strong> AI fills every open position so the match starts balanced.</p>
          </div>
        </div>
        <StadiumPreview team={team} />
      </section>

      <section className="soccer-setup__console" aria-label="Match setup">
        <fieldset className="soccer-setup__teams">
          <legend>Choose a team</legend>
          {(Object.keys(TEAM_COPY) as SoccerTeamId[]).map((teamId) => {
            const copy = TEAM_COPY[teamId];
            return (
              <button
                type="button"
                key={teamId}
                className={`soccer-team soccer-team--${teamId}`}
                data-team={teamId}
                aria-pressed={team === teamId}
                onClick={() => setTeam(teamId)}
              >
                <span className="soccer-team__crest" aria-hidden="true"><i /><b>{teamId === "coral" ? "R" : "H"}</b></span>
                <span className="soccer-team__copy"><small>{copy.callout}</small><strong>{copy.name}</strong><span>{copy.description}</span></span>
                <span className="soccer-team__check" aria-hidden="true">✓</span>
              </button>
            );
          })}
        </fieldset>

        <div className="soccer-setup__options">
          <fieldset>
            <legend>Match type</legend>
            <div className="soccer-choice-row">
              <button type="button" data-format="quick" aria-pressed={format === "quick"} onClick={() => setFormat("quick")}>
                <strong>Quick Play</strong><span>Start now · solo + AI</span>
              </button>
              <button type="button" data-format="crew" aria-pressed={format === "crew"} onClick={() => setFormat("crew")}>
                <strong>Play with Friends</strong><span>Create or join a game</span>
              </button>
            </div>
          </fieldset>
          <fieldset>
            <legend>Squad size</legend>
            <div className="soccer-size-row">
              {([3, 5] as const).map((size) => (
                <button
                  type="button"
                  key={size}
                  data-team-size={size}
                  aria-pressed={teamSize === size}
                  onClick={() => setTeamSize(size)}
                >
                  <strong>{size}v{size}</strong><span>{size === 3 ? "Quick pitch" : "Full formation"}</span>
                </button>
              ))}
            </div>
          </fieldset>
        </div>

        <aside className="soccer-setup__launch">
          <div className="soccer-setup__ticket">
            <span>Tonight's fixture</span>
            <strong>{TEAM_COPY[team].name}</strong>
            <p>{teamSize}v{teamSize} · {format === "quick" ? "AI Cup" : "Crew Cup"} · 03:00</p>
          </div>
          <button type="button" className="soccer-setup__start" data-testid="soccer-start" onClick={() => onStart(selection)}>
            Take the field <span aria-hidden="true">→</span>
          </button>
          <p>Quick Play starts instantly and gives your captain a small 8% pace boost over AI. Friend matches keep every human equal.</p>
        </aside>
      </section>
    </main>
  );
}

function StadiumPreview({ team }: { team: SoccerTeamId }) {
  return (
    <div className="soccer-stadium" aria-hidden="true">
      <svg viewBox="0 0 720 430" role="presentation">
        <defs>
          <linearGradient id="pitch" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#72c765" /><stop offset="1" stopColor="#2f875b" /></linearGradient>
          <linearGradient id="sky" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#ffd8ad" /><stop offset="1" stopColor="#fd8083" /></linearGradient>
        </defs>
        <path d="M50 194 360 74l310 120-310 172Z" fill="url(#pitch)" stroke="#4a174f" strokeWidth="9" strokeLinejoin="round" />
        <path d="M360 76v288M52 194l618 0" fill="none" stroke="#f7efcf" strokeWidth="5" opacity=".78" />
        <ellipse cx="360" cy="194" rx="74" ry="36" fill="none" stroke="#f7efcf" strokeWidth="5" opacity=".78" />
        <path d="m50 194 66-25v75l-66 28zm620 0-66-25v75l66 28z" fill="none" stroke="#f7efcf" strokeWidth="5" />
        <g className="soccer-stadium__stands"><path d="m41 166 319-122 319 122-9 28L360 74 50 194Z" fill="#3b0855" /><path d="m66 157 294-111 294 111-12 13L360 65 78 171Z" fill="url(#sky)" /></g>
        <g className="soccer-stadium__player soccer-stadium__player--coral" transform="translate(244 200)"><ellipse cy="23" rx="28" ry="11" fill="#3b0855" opacity=".25"/><path d="m-17-20 34 0 8 44-50 0z" fill="#ee227d" stroke="#4a174f" strokeWidth="6"/><circle cy="-37" r="17" fill="#f3b07d" stroke="#4a174f" strokeWidth="6"/><path d="m-9 24-5 29m27-29 5 29" stroke="#4a174f" strokeWidth="10" strokeLinecap="round"/></g>
        <g className="soccer-stadium__player soccer-stadium__player--teal" transform="translate(472 175)"><ellipse cy="23" rx="34" ry="11" fill="#3b0855" opacity=".25"/><rect x="-28" y="-25" width="58" height="45" rx="18" fill="#30c0b7" stroke="#174b62" strokeWidth="6"/><circle cx="-29" cy="-29" r="18" fill="#30c0b7" stroke="#174b62" strokeWidth="6"/><path d="m-38-44-8-18 17 12m7 5 13-16 1 22M-17 17l-4 31m37-31 5 31" stroke="#174b62" strokeWidth="9" strokeLinecap="round"/><path d="m-8-22 7 37m10-35 7 35" stroke="#fff1d5" strokeWidth="7"/></g>
        <g className={`soccer-stadium__ball soccer-stadium__ball--${team}`} transform="translate(360 220)"><circle r="22" fill="#fff1d5" stroke="#4a174f" strokeWidth="5"/><path d="m0-8 8 6-3 10H-5l-3-10Z" fill="#852467"/><path d="m0-8-9-9m17 15 11-5M5 8l7 11m-17-11-8 10m5-20-11-5" stroke="#852467" strokeWidth="4"/></g>
      </svg>
      <p><span>{team === "coral" ? "Rangers" : "Herd"}</span> Meadowbank Arena</p>
    </div>
  );
}
