import { useCallback, useEffect, useState } from "react";
import { admin } from "../lib/api.js";

const ADMIN = "pulidevan3@gmail.com";
// the site collects nothing itself: everyone here paid on Razorpay (pulled in by Sync or the webhook)
const TABS = [
  ["all", "All"],
  ["pending", "Pre-Consults (Free)"],
  ["paid", "Paid (₹999)"],
  ["contacted", "Contacted"]
];
const when = (s) => (s ? new Date(s * 1000).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : "");
const wa = (phone) => `https://wa.me/${phone.length === 10 ? "91" + phone : phone}`;

/** Private dashboard: sign in with a one-time email code, then see who booked and who actually paid. */
export default function Admin() {
  const [me, setMe] = useState(undefined);          // undefined = checking, null = signed out
  useEffect(() => { admin.get("me").then(setMe).catch(() => setMe(null)); }, []);
  if (me === undefined) return <main className="center"><p className="muted">Loading…</p></main>;
  return me ? <Dashboard me={me} onOut={() => setMe(null)} /> : <SignIn onIn={() => admin.get("me").then(setMe)} />;
}

function SignIn({ onIn }) {
  const [email, setEmail] = useState(ADMIN);
  const [code, setCode] = useState("");
  const [step, setStep] = useState("email");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const run = async (fn) => { setBusy(true); setNote(""); try { await fn(); } catch (e) { setNote(e.message); } setBusy(false); };
  const send = (e) => { e.preventDefault(); run(async () => { const r = await admin.sendCode(email); setNote(r.message); setStep("code"); }); };
  const verify = (e) => { e.preventDefault(); run(async () => { await admin.verify(email, code); await onIn(); }); };

  return (
    <main className="center">
      <form className="card signin" onSubmit={step === "email" ? send : verify}>
        <span className="dot"></span>
        <h1>Bookings</h1>
        <p className="muted">Only Pulidevan Prabakaran can open this. We'll email you a 6-digit code.</p>
        <label>Email<input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} disabled={step === "code"} autoComplete="email" /></label>
        {step === "code" && (
          <label>Code<input inputMode="numeric" autoComplete="one-time-code" required pattern="[0-9 ]{6,7}" value={code} onChange={(e) => setCode(e.target.value)} autoFocus placeholder="123456" /></label>
        )}
        {note && <p className="note">{note}</p>}
        <button className="btn" disabled={busy}>{busy ? "…" : step === "email" ? "Email me a code" : "Sign in"}</button>
        {step === "code" && <button type="button" className="link" onClick={() => { setStep("email"); setCode(""); setNote(""); }}>Use a different email or resend</button>}
      </form>
    </main>
  );
}

function Dashboard({ me, onOut }) {
  const [tab, setTab] = useState("all");
  const [data, setData] = useState({ leads: [], counts: {} });
  const [open, setOpen] = useState(null);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => admin.get("leads", { filter: tab }).then(setData).catch((e) => { if (e.status === 401) onOut(); else setMsg(e.message); }), [tab, onOut]);
  useEffect(() => { load(); }, [load]);

  const sync = async () => {
    setBusy(true); setMsg("");
    try { const r = await admin.sync(); setMsg(`Checked ${r.checked} Razorpay payments · ${r.paid} paid bookings matched.`); load(); }
    catch (e) { setMsg(e.message); }
    setBusy(false);
  };
  const setStatus = async (l, status, notes = l.notes) => { await admin.update({ id: l.id, status, notes }); load(); };
  const out = async () => { await admin.logout().catch(() => {}); onOut(); };

  return (
    <main className="dash">
      <header className="bar">
        <div><span className="dot"></span><strong>Bookings & Leads</strong><small>{me.email}</small></div>
        <div className="actions">
          <button className="btn ghost" onClick={sync} disabled={busy || !me.razorpay} title={me.razorpay ? "Pull captured payments from Razorpay and match them" : "Add Razorpay API keys first"}>{busy ? "Syncing…" : "↻ Sync payments"}</button>
          <a className="btn ghost" href={admin.exportUrl()}>⤓ Export CSV</a>
          <button className="btn ghost" onClick={out}>Sign out</button>
        </div>
      </header>

      {!me.razorpay && <p className="banner">Connect Razorpay to see who paid: add your Razorpay API keys to the server config, then press “Sync payments”. Until then, payers are in your Razorpay dashboard.</p>}
      {msg && <p className="banner ok">{msg}</p>}

      <nav className="tabs">
        {TABS.map(([id, label]) => (
          <button key={id} aria-current={tab === id} onClick={() => setTab(id)}>{label}<b>{data.counts[id === "all" ? "total" : id] ?? 0}</b></button>
        ))}
      </nav>

      {data.leads.length === 0 && <p className="empty muted">Nobody here yet.</p>}
      <ul className="leads">
        {data.leads.map((l) => (
          <li key={l.id} className={"lead" + (open === l.id ? " open" : "")}>
            <button className="row" onClick={() => setOpen(open === l.id ? null : l.id)} aria-expanded={open === l.id}>
              <span className="who"><strong>{l.name}</strong><small>{when(l.paid_at || l.created_at)}</small></span>
              <span className="need">{l.need || <i className="muted">No details</i>}</span>
              <span className={"pill " + (l.paid_verified ? "paid" : l.status)}>
                {l.paid_verified ? `Paid ₹${(l.amount || 0) / 100}` : l.status === "pending" ? "Pre-Consult (Free)" : l.status === "returned" ? "Back from payment" : l.status}
              </span>
            </button>
            {open === l.id && (
              <div className="detail">
                <div className="contact">
                  {l.phone && <a className="btn" href={wa(l.phone)} target="_blank" rel="noopener">WhatsApp {l.phone}</a>}
                  {l.email && <a className="btn ghost" href={`mailto:${l.email}`}>{l.email}</a>}
                  {l.status !== "contacted"
                    ? <button className="btn ghost" onClick={() => setStatus(l, "contacted")}>✓ Mark contacted</button>
                    : <button className="btn ghost" onClick={() => setStatus(l, l.paid_verified ? "paid" : "pending")}>Undo contacted</button>}
                </div>
                <dl>
                  <dt>Consultation</dt><dd>{l.paid_verified ? "Priority 1:1 with Pulidevan Prabakaran (Paid ₹999)" : "Free Pre-Consultation (Team Consultation)"}</dd>
                  <dt>Status</dt><dd>{l.status}</dd>
                  <dt>Payment</dt><dd>{l.payment_id ? <code>{l.payment_id}</code> : "Free pre-consultation / No payment required"} {l.paid_verified ? "· verified with Razorpay" : ""}</dd>
                  <dt>Date</dt><dd>{when(l.paid_at || l.created_at)}</dd>
                </dl>
                <Notes lead={l} onSave={(n) => setStatus(l, l.status, n)} />
                {l.transcript?.length > 0 && (
                  <details><summary>Chat transcript ({l.transcript.length})</summary>
                    <div className="transcript">{l.transcript.map((m, i) => <p key={i} className={m.role}>{m.text}</p>)}</div>
                  </details>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>
    </main>
  );
}

function Notes({ lead, onSave }) {
  const [v, setV] = useState(lead.notes || "");
  return (
    <div className="notes">
      <textarea rows={2} placeholder="Private notes" value={v} onChange={(e) => setV(e.target.value)} />
      {v !== (lead.notes || "") && <button className="btn" onClick={() => onSave(v)}>Save note</button>}
    </div>
  );
}
