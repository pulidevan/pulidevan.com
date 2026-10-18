import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { assistant as A, offer, films } from "../content.js";
import { streamChat } from "../lib/api.js";

// tags the AI puts at the end of a reply to show a card (see public/api/_brand.php)
const TAGS = /<(book|videos)\s*\/?>/gi;
const cardsIn = (t) => [...t.matchAll(TAGS)].map((m) => m[1].toLowerCase());
const shown = (t) => t.replace(TAGS, "").replace(/<[a-z/]*$/i, "").trim();   // hide tags, even half-streamed
let uid = 0;
const msg = (role, text, cards = []) => ({ id: ++uid, role, text, cards });
const HEAD = import.meta.env.BASE_URL + "assets/head.webp";

/**
 * The AI clone: Pulidevan Prabakaran's second brain, streamed from /api/chat.php (Gemini).
 * Nothing the visitor types is stored. Booking goes straight to Razorpay; Razorpay sends payers back to /?paid=1.
 */
export default function Chat() {
  const [msgs, setMsgs] = useState(() => A.greeting.map((t) => msg("model", t)));
  const [busy, setBusy] = useState(false);
  const [input, setInput] = useState("");
  const [used, setUsed] = useState(() => new Set());
  const logRef = useRef(null), msgsRef = useRef(msgs);
  msgsRef.current = msgs;

  // keep the newest message in view
  useEffect(() => { const el = logRef.current; if (el) el.scrollTop = el.scrollHeight; }, [msgs, busy]);

  const ask = useCallback(async (q) => {
    q = q.trim();
    if (!q || busy) return;
    setUsed((s) => new Set(s).add(q));
    setInput("");
    const convo = [...msgsRef.current.slice(A.greeting.length), msg("user", q)];
    const reply = msg("model", "");
    setMsgs((m) => [...m, convo[convo.length - 1], reply]);
    setBusy(true);
    let final;
    try {
      final = await streamChat(convo, (t) => setMsgs((m) => m.map((x) => (x.id === reply.id ? { ...x, text: t } : x))));
    } catch (e) {
      final = e.message;
    }
    setMsgs((m) => m.map((x) => (x.id === reply.id ? { ...x, text: final, cards: cardsIn(final) } : x)));
    setBusy(false);
  }, [busy]);

  const book = useCallback(() => {
    setMsgs((m) => [...m, msg("user", A.bookChip), msg("model", A.bookReply, ["book"])]);
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
        <span className="live"><i></i>online</span>
      </header>

      <div className="log" role="log" aria-live="polite" ref={logRef}>
        {msgs.map((m) => {
          const t = m.role === "model" ? shown(m.text) : m.text;
          if (m.role === "model" && !t && !m.cards.length) return <p className="bubble typing" key={m.id} aria-label="Typing"><i></i><i></i><i></i></p>;
          return (
            <div className="turn" key={m.id}>
              {t && <p className={"bubble" + (m.role === "user" ? " me" : "")}>{t}</p>}
              {m.cards.includes("videos") && <Films />}
              {m.cards.includes("book") && <BookCard />}
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

function BookCard() {
  return (
    <div className="offer">
      <div>
        <small>{offer.with}</small>
        <strong>{offer.title}</strong>
        <div className="price"><b>{offer.price}</b><s aria-label={`was ${offer.was}`}>{offer.was}</s></div>
      </div>
      <a className="btn signal" href={offer.payUrl} rel="noopener">{offer.cta} ↗</a>
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

  // rendered on <body>: the chat card's backdrop-filter would otherwise trap position:fixed inside it
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
