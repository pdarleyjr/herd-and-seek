import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { normalizeRoomCode } from "../room";
import { createRoom, joinRoom, listPublicRooms, roomDirectoryErrorMessage } from "../services/roomDirectory";
import type { RoomActivity, RoomSummary, RoomVisibility } from "../types/rooms";
import "./roomBrowser.css";

interface RoomBrowserProps {
  onCreate: (code: string, accessToken?: string) => void;
  onJoin: (code: string, accessToken?: string) => void;
  onBack: () => void;
  activity?: RoomActivity;
  defaultMaxPlayers?: number;
}

const REFRESH_MS = 4_000;

export default function RoomBrowser({ onCreate, onJoin, onBack, activity = "hunt", defaultMaxPlayers }: RoomBrowserProps) {
  const [rooms, setRooms] = useState<RoomSummary[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(true);
  const [listError, setListError] = useState("");
  const [lastRefresh, setLastRefresh] = useState<number | null>(null);
  const requestRef = useRef<AbortController | null>(null);

  const [createName, setCreateName] = useState("");
  const [visibility, setVisibility] = useState<RoomVisibility>("public");
  const [createPassword, setCreatePassword] = useState("");
  const [maxPlayers, setMaxPlayers] = useState(defaultMaxPlayers ?? (activity === "soccer" ? 10 : 8));
  const [createError, setCreateError] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const [privateName, setPrivateName] = useState("");
  const [privatePassword, setPrivatePassword] = useState("");
  const [privateError, setPrivateError] = useState("");
  const [joiningRoomId, setJoiningRoomId] = useState<string | null>(null);

  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState("");

  const refresh = useCallback(async () => {
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    setIsRefreshing(true);
    try {
      const nextRooms = await listPublicRooms(controller.signal, activity);
      if (controller.signal.aborted) return;
      setRooms(nextRooms);
      setListError("");
      setLastRefresh(Date.now());
    } catch (error) {
      if (controller.signal.aborted) return;
      setListError(roomDirectoryErrorMessage(error));
    } finally {
      if (!controller.signal.aborted) setIsRefreshing(false);
    }
  }, [activity]);

  useEffect(() => {
    const initialRefresh = window.setTimeout(() => void refresh(), 0);
    const timer = window.setInterval(() => void refresh(), REFRESH_MS);
    return () => {
      window.clearTimeout(initialRefresh);
      window.clearInterval(timer);
      requestRef.current?.abort();
    };
  }, [refresh]);

  const submitCreate = async (event: FormEvent) => {
    event.preventDefault();
    setCreateError("");
    if (createName.trim().length < 3) {
      setCreateError("Give your room a name with at least 3 characters.");
      return;
    }
    if (visibility === "private" && createPassword.length < 8) {
      setCreateError("Private room passwords need at least 8 characters.");
      return;
    }
    setIsCreating(true);
    try {
      const result = await createRoom({
        name: createName.trim(),
        visibility,
        maxPlayers,
        activity,
        ...(visibility === "private" ? { password: createPassword } : {}),
      });
      setCreatePassword("");
      onCreate(result.room.roomId, result.accessToken);
    } catch (error) {
      setCreateError(roomDirectoryErrorMessage(error));
    } finally {
      setIsCreating(false);
    }
  };

  const joinPublic = async (room: RoomSummary) => {
    setJoiningRoomId(room.roomId);
    setListError("");
    try {
      const result = await joinRoom({ roomId: room.roomId, activity });
      onJoin(result.room.roomId, result.accessToken);
    } catch (error) {
      const message = roomDirectoryErrorMessage(error);
      await refresh();
      setListError(message);
    } finally {
      setJoiningRoomId(null);
    }
  };

  const submitPrivate = async (event: FormEvent) => {
    event.preventDefault();
    setPrivateError("");
    if (!privateName.trim() || !privatePassword) {
      setPrivateError("Enter the private room name and password.");
      return;
    }
    setJoiningRoomId("private");
    try {
      const result = await joinRoom({ roomName: privateName.trim(), password: privatePassword, activity });
      setPrivatePassword("");
      onJoin(result.room.roomId, result.accessToken);
    } catch (error) {
      setPrivateError(roomDirectoryErrorMessage(error));
    } finally {
      setJoiningRoomId(null);
    }
  };

  const joinByCode = () => {
    const normalized = normalizeRoomCode(code);
    if (normalized.length < 4) {
      setCodeError("Enter a valid room code, like ABCD-EFGH.");
      return;
    }
    setCodeError("");
    onJoin(normalized, undefined);
  };

  return (
    <main className="room-browser-shell">
      <div className="room-browser-sun" aria-hidden="true" />
      <div className="room-browser-landscape" aria-hidden="true"><i /><i /><i /></div>

      <header className="room-browser-header">
        <button type="button" className="room-browser-back" onClick={onBack} aria-label="Back to game modes">
          <span aria-hidden="true">‹</span> Modes
        </button>
        <div>
          <p className="room-browser-eyebrow">{activity === "soccer" ? "Field League matchmaking" : "Multiplayer trailhead"}</p>
          <h1>{activity === "soccer" ? "Build your match." : "Pick your expedition."}</h1>
          <p>{activity === "soccer" ? "Create a crew match, join a public pitch, or unlock a private fixture." : "Create a squad, find a public camp, or unlock a friend’s private room."}</p>
        </div>
        <div className="room-browser-compass" aria-hidden="true"><span>N</span><i /></div>
      </header>

      <div className="room-browser-grid">
        <section className="room-create-zone" aria-labelledby="create-room-heading">
          <div className="room-section-heading">
            <span className="room-step">01</span>
            <div><h2 id="create-room-heading">Create a room</h2><p>{activity === "soccer" ? "You pick the side. We’ll mark the pitch." : "You set the rules. We’ll pack the map."}</p></div>
          </div>

          <form className="room-create-form" onSubmit={submitCreate}>
            <label className="room-field">
              <span>Room name</span>
              <input value={createName} onChange={(event) => setCreateName(event.target.value)} maxLength={32} autoComplete="off" placeholder="Firefly Rangers" />
            </label>

            <fieldset className="room-visibility">
              <legend>Who can join?</legend>
              <div>
                <button type="button" className={visibility === "public" ? "is-selected" : ""} aria-pressed={visibility === "public"} onClick={() => setVisibility("public")}>
                  <strong>Public</strong><small>Listed for everyone</small>
                </button>
                <button type="button" className={visibility === "private" ? "is-selected" : ""} aria-pressed={visibility === "private"} onClick={() => setVisibility("private")}>
                  <strong>Private</strong><small>Name + password</small>
                </button>
              </div>
            </fieldset>

            {visibility === "private" && (
              <label className="room-field room-private-field">
                <span>Room password</span>
                <input type="password" value={createPassword} onChange={(event) => setCreatePassword(event.target.value)} minLength={8} maxLength={72} autoComplete="new-password" placeholder="8+ characters" />
                <small>Shared only with the friends you invite.</small>
              </label>
            )}

            <label className="room-field room-player-count">
              <span>{activity === "soccer" ? "Match capacity" : "Squad size"}</span>
              <select value={maxPlayers} onChange={(event) => setMaxPlayers(Number(event.target.value))}>
                {(activity === "soccer" ? [defaultMaxPlayers ?? 10] : [4, 6, 8, 10, 12]).map((count) => <option key={count} value={count}>{count} players</option>)}
              </select>
            </label>

            {createError && <p className="room-inline-error" role="alert">{createError}</p>}
            <button className="room-primary-action" type="submit" disabled={isCreating}>
              <span>{isCreating ? "Building camp…" : "Create room"}</span><i aria-hidden="true">→</i>
            </button>
          </form>

          <details className="room-private-join">
            <summary>Joining a private room?</summary>
            <form onSubmit={submitPrivate}>
              <label className="room-field"><span>Private room name</span><input value={privateName} onChange={(event) => setPrivateName(event.target.value)} maxLength={32} autoComplete="off" /></label>
              <label className="room-field"><span>Private room password</span><input type="password" value={privatePassword} onChange={(event) => setPrivatePassword(event.target.value)} maxLength={72} autoComplete="current-password" /></label>
              {privateError && <p className="room-inline-error" role="alert">{privateError}</p>}
              <button type="submit" className="room-secondary-action" disabled={joiningRoomId === "private"}>{joiningRoomId === "private" ? "Unlocking…" : "Join private room"}</button>
            </form>
          </details>

          <div className="room-code-join">
            <label className="room-field"><span>Room code</span><input value={code} onChange={(event) => setCode(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") joinByCode(); }} maxLength={32} autoComplete="off" placeholder="ABCD-EFGH" /></label>
            <button type="button" onClick={joinByCode}>Join by code</button>
            {codeError && <p className="room-inline-error" role="alert">{codeError}</p>}
          </div>
        </section>

        <section className="room-public-zone" aria-labelledby="public-rooms-heading">
          <div className="room-section-heading room-public-heading">
            <span className="room-step">02</span>
            <div><h2 id="public-rooms-heading">Public rooms</h2><p>{activity === "soccer" ? "Live fixtures with room for another captain." : "Live camps with space for one more explorer."}</p></div>
            <button type="button" className="room-refresh" onClick={() => void refresh()} disabled={isRefreshing} aria-label="Refresh public rooms">
              <span aria-hidden="true">↻</span>{isRefreshing ? "Checking" : "Refresh"}
            </button>
          </div>

          <div className="room-live-strip" role="status" aria-live="polite">
            <i /> Live directory
            {lastRefresh && <time dateTime={new Date(lastRefresh).toISOString()}>updated just now</time>}
          </div>

          {listError && <p className="room-list-error" role="alert">{listError}</p>}
          <div className="room-public-list" aria-busy={isRefreshing}>
            {!isRefreshing && rooms.length === 0 && !listError && (
              <div className="room-empty-state"><i aria-hidden="true" /><h3>Quiet trail—for now.</h3><p>Start a public room and be the first camp on the map.</p></div>
            )}
            {rooms.map((room, index) => (
              <article className="room-public-card" key={room.roomId} style={{ "--room-index": index } as React.CSSProperties}>
                <div className="room-card-mark" aria-hidden="true"><span>{room.name.slice(0, 1).toUpperCase()}</span></div>
                <div className="room-card-copy">
                  <h3>{room.name}</h3>
                  <p><span>{room.playerCount} / {room.maxPlayers}</span> {activity === "soccer" ? "players" : "explorers"} · Lobby open</p>
                </div>
                <div className="room-card-capacity" aria-label={`${room.playerCount} of ${room.maxPlayers} players`}>
                  {Array.from({ length: Math.min(room.maxPlayers, 8) }, (_, slot) => <i className={slot < room.playerCount ? "is-filled" : ""} key={slot} />)}
                </div>
                <button type="button" onClick={() => void joinPublic(room)} disabled={joiningRoomId === room.roomId}>
                  {joiningRoomId === room.roomId ? "Joining…" : "Join"}<span aria-hidden="true">›</span>
                </button>
              </article>
            ))}
            {isRefreshing && rooms.length === 0 && Array.from({ length: 3 }, (_, index) => <div className="room-card-skeleton" key={index} aria-hidden="true" />)}
          </div>
        </section>
      </div>
    </main>
  );
}
