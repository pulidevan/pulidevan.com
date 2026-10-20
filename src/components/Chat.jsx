import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { assistant as A, offer, films } from "../content.js";
import { streamChat, submitLead, getVoiceAudio } from "../lib/api.js";

// Tags the AI puts in reply: <offer/> or <book/> for consultation, <videos/> for film reel
const TAGS = /<(book|offer|videos)\s*\/?>/gi;

function parseCards(t) {
  const cards = [];
  if (/<(book|offer)\s*\/?>/i.test(t)) cards.push("offer");
  if (/<videos\s*\/?>/i.test(t)) cards.push("videos");
  return cards;
}

function parseChips(t) {
  const m = t.match(/<chips>([\s\S]*?)<\/chips>/i);
  if (!m) return [];
  return m[1]
    .split("|")
    .map((s) => s.trim())
    .filter(Boolean);
}

// Clean text for speech bubble: strips chips (even while streaming) and card tags
function cleanText(t) {
  return t
    .replace(/<chips>[\s\S]*?<\/chips>/gi, "") // strip closed chips
    .replace(/<chips[\s\S]*$/i, "")            // strip open/half-streamed chips
    .replace(TAGS, "")                         // strip cards
    .replace(/<[a-z/]*$/i, "")                 // strip trailing partial tag
    .trim();
}

let uid = 0;
const msg = (role, text, cards = [], chips = []) => ({ id: ++uid, role, text, cards, chips });
const HEAD = import.meta.env.BASE_URL + "assets/head.webp";

/**
 * The AI clone: Pulidevan Prabakaran's second brain, streamed from /api/chat.php (Gemini).
 * Free pre-consultation goes to SQLite /admin; Priority direct founder call goes to Razorpay (₹999).
 * Voice narration powered by Google Gemini 3.8 Flash TTS (/api/tts.php).
 */
export default function Chat() {
  const [msgs, setMsgs] = useState(() => A.greeting.map((t) => msg("model", t)));
  const [busy, setBusy] = useState(false);
  const [input, setInput] = useState("");
  const [used, setUsed] = useState(() => new Set());
  const [voiceEnabled, setVoiceEnabled] = useState(() => localStorage.getItem("pp_voice") !== "0");
  const [playingMsgId, setPlayingMsgId] = useState(null);
  const [audioLoadingId, setAudioLoadingId] = useState(null);

  const logRef = useRef(null), msgsRef = useRef(msgs);
  msgsRef.current = msgs;

  const voiceEnabledRef = useRef(voiceEnabled);
  voiceEnabledRef.current = voiceEnabled;

  const currentAudioRef = useRef(null);

  const stopAudio = useCallback(() => {
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current.currentTime = 0;
      currentAudioRef.current = null;
    }
    setPlayingMsgId(null);
    setAudioLoadingId(null);
  }, []);

  const playAudioFor = useCallback(async (id, text) => {
    if (!text) return;
    stopAudio();
    setAudioLoadingId(id);
    try {
      const audioUrl = await getVoiceAudio(text);
      if (!audioUrl) {
        setAudioLoadingId(null);
        return;
      }
      const audio = new Audio(audioUrl);
      currentAudioRef.current = audio;
      setPlayingMsgId(id);
      setAudioLoadingId(null);

      audio.onended = () => {
        setPlayingMsgId((curr) => (curr === id ? null : curr));
        if (currentAudioRef.current === audio) currentAudioRef.current = null;
      };
      audio.onerror = () => {
        setPlayingMsgId((curr) => (curr === id ? null : curr));
        setAudioLoadingId((curr) => (curr === id ? null : curr));
        if (currentAudioRef.current === audio) currentAudioRef.current = null;
      };
      await audio.play();
    } catch (err) {
      console.warn("Audio playback error:", err);
      setPlayingMsgId(null);
      setAudioLoadingId(null);
    }
  }, [stopAudio]);

  const toggleVoice = useCallback(() => {
    setVoiceEnabled((v) => {
      const next = !v;
      localStorage.setItem("pp_voice", next ? "1" : "0");
      if (!next) stopAudio();
      return next;
    });
  }, [stopAudio]);

  // Clean up audio on unmount
  useEffect(() => {
    return () => stopAudio();
  }, [stopAudio]);

  // keep the newest message in view
  useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [msgs, busy]);

  const ask = useCallback(async (q) => {
    q = q.trim();
    if (!q || busy) return;
    stopAudio();
    setUsed((s) => new Set(s).add(q));
    setInput("");
    const convo = [...msgsRef.current.slice(A.greeting.length), msg("user", q)];
    const reply = msg("model", "");
    setMsgs((m) => [...m, convo[convo.length - 1], reply]);
    setBusy(true);
    let final;
    try {
      final = await streamChat(convo, (t) => {
        setMsgs((m) =>
          m.map((x) =>
            x.id === reply.id
              ? { ...x, text: t, cards: parseCards(t), chips: parseChips(t) }
              : x
          )
        );
      });
    } catch (e) {
      final = e.message;
    }
    setMsgs((m) =>
      m.map((x) =>
        x.id === reply.id
          ? { ...x, text: final, cards: parseCards(final), chips: parseChips(final) }
          : x
      )
    );
    setBusy(false);

    // Speak reply automatically if voice narration is active
    if (voiceEnabledRef.current && final) {
      const clean = cleanText(final);
      if (clean) playAudioFor(reply.id, clean);
    }
  }, [busy, stopAudio, playAudioFor]);

  const book = useCallback(() => {
    setMsgs((m) => [...m, msg("user", A.bookChip), msg("model", A.bookReply, ["offer"])]);
  }, []);

  // the 3D head asks a question
  useEffect(() => {
    const onAsk = (e) => ask(e.detail);
    addEventListener("pp-ask", onAsk);
    return () => removeEventListener("pp-ask", onAsk);
  }, [ask]);

  // back from Razorpay
  useEffect(() => {
    const qs = new URLSearchParams(location.search);
    if (!qs.has("paid") && !qs.has("razorpay_payment_id")) return;
    history.replaceState(null, "", location.pathname);
    setMsgs((m) => [...m, msg("model", A.paid)]);
  }, []);

  const chips = A.prompts.filter((p) => !used.has(p));

  return (
    <section className="chat" aria-label="Chat with Pulidevan Prabakaran's AI clone">
      <header className="chat-head">
        <span className="face" aria-hidden="true"><i style={{ backgroundImage: `url(${HEAD})` }}></i><img src={HEAD} alt="" /></span>
        <div><strong>Pulidevan Prabakaran</strong><small>{A.label}</small></div>
        <button
          type="button"
          className={"voice-pill" + (voiceEnabled ? " active" : "")}
          onClick={toggleVoice}
          title={voiceEnabled ? "Mute AI voice narration" : "Enable AI voice narration (Gemini 3.8 Flash TTS)"}
          aria-label={voiceEnabled ? "Voice narration active" : "Voice narration muted"}
        >
          <span className="v-wave" aria-hidden="true">
            <i></i><i></i><i></i>
          </span>
          <span className="v-label">{voiceEnabled ? "Voice" : "Muted"}</span>
        </button>
        <span className="live"><i></i>online</span>
      </header>

      <div className="log" role="log" aria-live="polite" ref={logRef}>
        {msgs.map((m) => {
          const t = m.role === "model" ? cleanText(m.text) : m.text;
          const showTyping = m.role === "model" && !t && !m.cards.length;
          return (
            <div className="turn" key={m.id}>
              {showTyping && (
                <p className="bubble typing" aria-label="Typing">
                  <i></i><i></i><i></i>
                </p>
              )}
              {t && (
                m.role === "model" ? (
                  <div className="bubble-row">
                    <p className="bubble">{t}</p>
                    <button
                      type="button"
                      className={"speak-btn" + (playingMsgId === m.id ? " playing" : "") + (audioLoadingId === m.id ? " loading" : "")}
                      onClick={() => {
                        if (playingMsgId === m.id) stopAudio();
                        else playAudioFor(m.id, t);
                      }}
                      title={playingMsgId === m.id ? "Stop voice" : "Listen in Pulidevan's voice"}
                      aria-label={playingMsgId === m.id ? "Stop reading" : "Read aloud with Google Gemini TTS"}
                    >
                      {audioLoadingId === m.id ? (
                        <span className="mini-spin" aria-hidden="true" />
                      ) : playingMsgId === m.id ? (
                        <span className="mini-bars" aria-hidden="true"><i></i><i></i><i></i></span>
                      ) : (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                          <path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>
                          <path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path>
                        </svg>
                      )}
                    </button>
                  </div>
                ) : (
                  <p className="bubble me">{t}</p>
                )
              )}
              
              {/* Interactive suggestion chips emitted by AI */}
              {m.role === "model" && m.chips && m.chips.length > 0 && (
                <div className="turn-chips" aria-label="Suggested replies">
                  {m.chips.map((chip, idx) => (
                    <button
                      key={idx}
                      className="chip-btn"
                      onClick={() => ask(chip)}
                      disabled={busy}
                    >
                      {chip}
                    </button>
                  ))}
                </div>
              )}

              {m.cards.includes("videos") && <Films />}
              {(m.cards.includes("offer") || m.cards.includes("book")) && (
                <OfferCard convo={msgs} onBooked={() => {}} />
              )}
            </div>
          );
        })}
      </div>

      <div className="choices on" aria-label="Suggested questions">
        {chips.map((p) => <button key={p} onClick={() => ask(p)} disabled={busy}>{p}</button>)}
        <button className="hot" onClick={book} disabled={busy}>{A.bookChip}</button>
      </div>

      <form className="ask" onSubmit={(e) => { e.preventDefault(); ask(input); }}>
        <input value={input} onChange={(e) => setInput(e.target.value)} placeholder={A.placeholder} maxLength={600} aria-label="Your message" />
        <button type="submit" disabled={busy || !input.trim()} aria-label="Send">↑</button>
      </form>
    </section>
  );
}

/**
 * OfferCard: Two clear paths
 * 1. Free Pre-Consultation (Team Strategy Call) -> logs to SQLite leads table in /admin.html
 * 2. Priority Direct Access with Founder (₹999 on Razorpay) -> captured by Razorpay webhook
 */
function OfferCard({ convo = [], onBooked }) {
  const [mode, setMode] = useState("choose"); // "choose" | "free" | "done"
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [need, setNeed] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const handleFreeSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Please enter your name.");
      return;
    }
    const clean = phone.replace(/\D/g, "");
    if (clean.length < 10) {
      setError("Please enter a valid 10-digit WhatsApp/phone number.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await submitLead({
        name: name.trim(),
        phone: phone.trim(),
        email: email.trim(),
        need: need.trim() || "Free Pre-Consultation requested via chat",
        transcript: convo.map(({ role, text }) => ({ role, text }))
      });
      setMode("done");
      onBooked?.();
    } catch (err) {
      setError(err.message || "Failed to submit. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  if (mode === "done") {
    return (
      <div className="offer-done-box">
        <span className="badge-ok">✓ Pre-Consultation Booked</span>
        <strong>We've got your requirement, {name.trim().split(" ")[0]}!</strong>
        <p>Pulidevan's team will review your brief and reach out to you on WhatsApp (<b>{phone}</b>) within 24 hours.</p>
      </div>
    );
  }

  if (mode === "free") {
    return (
      <div className="offer-form-box">
        <div className="offer-form-head">
          <span className="badge-team">Team Pre-Consultation · Free</span>
          <strong>Tell us about your requirement</strong>
          <p>Pulidevan's team will consult you on your business needs and suggest the best AI blueprint.</p>
        </div>
        <form className="lead-form" onSubmit={handleFreeSubmit}>
          <div className="form-row">
            <label>Name</label>
            <input
              type="text"
              required
              placeholder="Your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={busy}
              autoFocus
            />
          </div>
          <div className="form-row">
            <label>WhatsApp / Phone</label>
            <input
              type="tel"
              required
              placeholder="e.g. 98765 43210"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              disabled={busy}
            />
          </div>
          <div className="form-row">
            <label>Email <small>(optional)</small></label>
            <input
              type="email"
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={busy}
            />
          </div>
          <div className="form-row">
            <label>Requirement / Goal</label>
            <input
              type="text"
              placeholder="e.g. AI video ads, automating operations, training..."
              value={need}
              onChange={(e) => setNeed(e.target.value)}
              disabled={busy}
            />
          </div>
          {error && <p className="form-error">{error}</p>}
          <div className="form-buttons">
            <button type="submit" className="btn signal" disabled={busy}>
              {busy ? "Booking…" : "Confirm Free Pre-Consultation"}
            </button>
            <button type="button" className="btn ghost" onClick={() => setMode("choose")} disabled={busy}>
              Back
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="offer-grid">
      {/* 1. Free Pre-Consultation (Team Strategy Call) */}
      <div className="offer-card free">
        <div className="offer-badge-wrap">
          <span className="badge-team">Free Strategy Call</span>
        </div>
        <strong>Team Pre-Consultation</strong>
        <p className="offer-desc">Our team will consult you regarding your requirement and find your quick AI wins.</p>
        <div className="offer-price-row">
          <b className="free-tag">₹0</b>
          <span className="price-sub">Free exploration</span>
        </div>
        <button type="button" className="btn ghost full" onClick={() => setMode("free")}>
          Request Free Pre-Consultation →
        </button>
      </div>

      {/* 2. Priority Direct Access with Founder (₹999) */}
      <div className="offer-card priority">
        <div className="offer-badge-wrap">
          <span className="badge-founder">Priority Access · Founder 1:1</span>
        </div>
        <strong>1:1 with Pulidevan Prabakaran</strong>
        <p className="offer-desc">Skip the queue. Direct 1:1 strategy session with the founder to map your AI leverage.</p>
        <div className="offer-price-row">
          <b className="paid-tag">{offer.price}</b>
          <s className="was-tag">{offer.was}</s>
        </div>
        <a className="btn signal full" href={offer.payUrl} target="_blank" rel="noopener">
          {offer.cta} ↗
        </a>
      </div>
    </div>
  );
}

/**
 * Student films: posters in a strip, hover previews. Click opens a big viewer over the page with
 * fullscreen; the lofi pauses while a film plays and comes back when it closes.
 */
function Films() {
  const [open, setOpen] = useState(null);
  return (
    <div className="films">
      <div className="film-strip">
        {films.items.map((f, n) => (
          <button key={f.src} className="film" onClick={() => setOpen(n)} aria-label={`Play ${f.title}`}
            onMouseEnter={(e) => { const v = e.currentTarget.querySelector("video"); v?.play().catch(() => {}); }}
            onMouseLeave={(e) => { const v = e.currentTarget.querySelector("video"); if (v) { v.pause(); v.currentTime = 0; } }}>
            <img src={f.poster} alt="" loading="lazy" />
            <video src={f.preview} muted loop playsInline preload="none" />
            <span>▶ {f.title}</span>
          </button>
        ))}
      </div>
      <a className="film-more" href={films.more} target="_blank" rel="noopener">More on filmaking.aiessentials.in ↗</a>
      {open != null && <Viewer i={open} onClose={() => setOpen(null)} onGo={setOpen} />}
    </div>
  );
}

function Viewer({ i, onClose, onGo }) {
  const v = useRef(null), box = useRef(null);
  const f = films.items[i], n = films.items.length;
  const music = (d) => dispatchEvent(new CustomEvent("pp-music", { detail: d }));

  useEffect(() => { music("pause"); return () => music("resume"); }, []);
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape" && !document.fullscreenElement) onClose();
      if (e.key === "ArrowRight") onGo((i + 1) % n);
      if (e.key === "ArrowLeft") onGo((i - 1 + n) % n);
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [i, n, onClose, onGo]);

  const full = () => {
    const el = v.current; if (!el) return;
    if (el.requestFullscreen) el.requestFullscreen().catch(() => {});
    else if (el.webkitEnterFullscreen) el.webkitEnterFullscreen();     // iPhone Safari
  };

  return createPortal(
    <div className="viewer" role="dialog" aria-modal="true" aria-label={f.title} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="viewer-box" ref={box}>
        <video ref={v} key={f.src} src={f.src} poster={f.poster} controls autoPlay playsInline />
        <div className="viewer-bar">
          <strong>{f.title}</strong>
          <span className="viewer-ctl">
            <button onClick={() => onGo((i - 1 + n) % n)} aria-label="Previous film">←</button>
            <span>{i + 1}/{n}</span>
            <button onClick={() => onGo((i + 1) % n)} aria-label="Next film">→</button>
            <button onClick={full}>⛶ Fullscreen</button>
            <button onClick={onClose}>✕ Close</button>
          </span>
        </div>
      </div>
    </div>,
    document.body
  );
}
