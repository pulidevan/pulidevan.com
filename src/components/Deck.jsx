import { useCallback, useEffect, useRef, useState } from "react";
import { playlists as L } from "../content.js";

const MUTE_KEY = "pp-muted";
const readMuted = () => { try { return localStorage.getItem(MUTE_KEY) === "1"; } catch (e) { return false; } };
const saveMuted = (m) => { try { localStorage.setItem(MUTE_KEY, m ? "1" : "0"); } catch (e) { /* storage blocked */ } };

// SoundCloud widget, stripped of everything visible: the iframe sits off-screen and our own card is the UI.
const SC_OPTS = { auto_play: false, visual: false, show_artwork: false, show_comments: false, show_user: false, show_reposts: false,
  show_teaser: false, hide_related: true, buying: false, sharing: false, download: false, show_playcount: false, single_active: true };
const scSrc = (url) => "https://w.soundcloud.com/player/?" + new URLSearchParams({ url, ...Object.fromEntries(Object.entries(SC_OPTS).map(([k, v]) => [k, String(v)])) });

function loadScApi() {
  if (window.SC?.Widget) return Promise.resolve(window.SC);
  return new Promise((ok, bad) => {
    // index.html starts loading it early (#sc-api); only add our own tag if that one is missing
    let s = document.getElementById("sc-api");
    if (!s) { s = document.createElement("script"); s.src = "https://w.soundcloud.com/player/api.js"; s.async = true; document.head.appendChild(s); }
    s.addEventListener("load", () => ok(window.SC)); s.addEventListener("error", bad);
  });
}

/**
 * Music card under the 3D record crate. Each record is a SoundCloud artist or playlist.
 * Autoplay: tries as soon as the player is ready; browsers block sound until the visitor interacts,
 * so it also starts on the first click, tap or key press anywhere — unless they muted.
 * Mute sets the volume to 0 (the music keeps its place) and is remembered. Pause stops it.
 * Each new track starts SKIP_MS in, past the quiet intro, so sound arrives right away.
 * Other parts of the page can pause/resume it with the "pp-music" event (detail: "pause" | "resume"),
 * e.g. while a film plays.
 */
const SKIP_MS = 5000;
export default function Deck({ onSelect }) {
  const [i, setI] = useState(() => { const h = L.findIndex((p) => p.home); return h >= 0 ? h : 0; });
  const [src] = useState(() => scSrc(L[i].url));    // later records load through the widget API, not a new src
  const [muted, setMuted] = useState(readMuted);
  const [track, setTrack] = useState("");
  const [playing, setPlaying] = useState(false);
  const userPaused = useRef(false), soundId = useRef(null);
  const frame = useRef(null), widget = useRef(null), started = useRef(false), iRef = useRef(i), mutedRef = useRef(muted);
  iRef.current = i; mutedRef.current = muted;

  useEffect(() => { onSelect?.(i); }, [i, onSelect]);

  const play = useCallback(() => {
    const w = widget.current; if (!w) return;
    w.setVolume(mutedRef.current ? 0 : 70);
    if (!mutedRef.current) w.play();
  }, []);

  useEffect(() => {
    let alive = true;
    loadScApi().then((SC) => {
      if (!alive || !frame.current) return;
      const w = SC.Widget(frame.current); widget.current = w;
      const E = SC.Widget.Events;
      w.bind(E.READY, () => play());                 // autoplay attempt; works where the browser allows it
      w.bind(E.PLAY, () => {
        setPlaying(true);
        w.getCurrentSound((s) => {
          if (!s) return;
          setTrack(s.title || "");
          if (s.id !== soundId.current) {         // a new track: skip the intro once
            soundId.current = s.id;
            w.getPosition((pos) => { if (pos < SKIP_MS - 1000 && (s.duration || 0) > SKIP_MS * 4) w.seekTo(SKIP_MS); });
          }
        });
      });
      w.bind(E.PAUSE, () => setPlaying(false));
      w.bind(E.FINISH, () => w.next());
    }).catch(() => setTrack("Music unavailable"));
    const first = (e) => {
      if (started.current || !widget.current) return;
      started.current = true;
      if (!e.target.closest?.(".mute,.play")) play();   // pressing mute/pause first shouldn't start the music
      off();
    };
    const evs = ["pointerdown", "keydown", "touchstart"];
    const off = () => evs.forEach((t) => removeEventListener(t, first));
    evs.forEach((t) => addEventListener(t, first));
    return () => { alive = false; off(); };
  }, [play]);

  const choose = useCallback((n) => {
    setI(n); setTrack(""); started.current = true; userPaused.current = false;
    if (mutedRef.current) { mutedRef.current = false; setMuted(false); saveMuted(false); }
    const w = widget.current;
    if (w) w.load(L[n].url, { ...SC_OPTS, auto_play: true, callback: () => play() });
  }, [play]);
  const shuffle = useCallback(() => {
    let n = iRef.current;
    while (L.length > 1 && n === iRef.current) n = Math.floor(Math.random() * L.length);
    choose(n);
  }, [choose]);
  const toggleMute = useCallback(() => {
    const m = !mutedRef.current; mutedRef.current = m; setMuted(m); saveMuted(m); started.current = true;
    const w = widget.current; if (!w) return;
    w.setVolume(m ? 0 : 70);
    if (!m) w.isPaused((p) => p && w.play());
  }, []);

  const togglePlay = useCallback(() => {
    const w = widget.current; if (!w) return;
    started.current = true;
    w.isPaused((p) => {
      userPaused.current = !p;
      if (p) { if (mutedRef.current) { mutedRef.current = false; setMuted(false); saveMuted(false); } w.setVolume(70); w.play(); }
      else w.pause();
    });
  }, []);

  // films (and anything else) can borrow the sound; resume only if the visitor hadn't paused it
  useEffect(() => {
    let wasPlaying = false;
    const onMusic = (e) => {
      const w = widget.current; if (!w) return;
      if (e.detail === "pause") w.isPaused((p) => { wasPlaying = !p; if (!p) w.pause(); });
      if (e.detail === "resume" && wasPlaying && !userPaused.current) { wasPlaying = false; w.play(); }
    };
    addEventListener("pp-music", onMusic);
    return () => removeEventListener("pp-music", onMusic);
  }, []);

  useEffect(() => {
    const onPlay = (e) => choose(e.detail);
    const onKey = (e) => {
      if (e.target.closest?.("input,textarea,select")) return;   // typing in the chat isn't a shortcut
      if (e.key === "s" || e.key === "S") shuffle();
      if (e.key === "m" || e.key === "M") toggleMute();
      if (e.key === "p" || e.key === "P") togglePlay();
    };
    addEventListener("pp-play", onPlay); addEventListener("keydown", onKey);
    return () => { removeEventListener("pp-play", onPlay); removeEventListener("keydown", onKey); };
  }, [choose, shuffle, toggleMute, togglePlay]);

  const p = L[i];
  return (
    <aside className="deck" aria-label="Studio crate">
      <div className="deck-head"><span><span className={"eq" + (muted ? " off" : "")}><i></i><i></i><i></i></span>Studio crate · lofi</span><span>Pick a record ↑</span></div>
      <div className="now">
        <div className="dot" style={{ background: p.color }}></div>
        <div className="now-t"><small>{muted ? "Muted" : !playing ? "Paused" : track || "Now spinning"}</small><strong>{p.name}</strong></div>
        <button className="btn ghost ic play" onClick={togglePlay} title={playing ? "Pause (P)" : "Play (P)"} aria-label={playing ? "Pause music" : "Play music"}>{playing ? "❚❚" : "▶"}</button>
        <button className="btn ghost ic mute" onClick={toggleMute} aria-pressed={muted} title={muted ? "Unmute (M)" : "Mute (M)"} aria-label={muted ? "Unmute" : "Mute"}>{muted ? "🔇" : "🔊"}</button>
        <button className="btn ghost ic" onClick={shuffle} title="Shuffle (S)" aria-label="Shuffle">🔀</button>
      </div>
      {/* the actual player: loaded and audible, never seen */}
      <iframe ref={frame} className="sc" title="Music player" src={src} allow="autoplay; encrypted-media" tabIndex={-1} aria-hidden="true"></iframe>
    </aside>
  );
}
