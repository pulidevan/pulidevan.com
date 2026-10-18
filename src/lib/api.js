/**
 * Talks to the PHP backend in public/api/. Paths are relative, so the site works from any folder.
 * Locally, Vite proxies /api to the PHP dev server (see vite.config.js).
 */
const API = import.meta.env.BASE_URL + "api/";

async function post(path, data, headers = {}) {
  const r = await fetch(API + path, { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(data), credentials: "same-origin" });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || "Something went wrong. Try again.");
  return j;
}

/**
 * Streams the assistant's reply. Calls onText(fullTextSoFar) as words arrive.
 * Resolves with the final text.
 */
export async function streamChat(messages, onText) {
  const r = await fetch(API + "chat.php", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages: messages.map(({ role, text }) => ({ role, text })) })
  });
  if (!r.ok || !r.body) {
    const j = await r.json().catch(() => ({}));
    throw new Error(j.error || "The assistant is offline right now.");
  }
  const reader = r.body.getReader(), dec = new TextDecoder();
  let buf = "", text = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let i;
    while ((i = buf.indexOf("\n\n")) >= 0) {
      const line = buf.slice(0, i).trim(); buf = buf.slice(i + 2);
      if (!line.startsWith("data:")) continue;
      const d = JSON.parse(line.slice(5));
      if (d.t) { text += d.t; onText(text); }
      if (d.error) { text += d.error; onText(text); }
    }
  }
  return text;
}

/* admin */
export const admin = {
  sendCode: (email) => post("admin.php?action=send-code", { email }),
  verify: (email, code) => post("admin.php?action=verify", { email, code }),
  logout: () => post("admin.php?action=logout", {}, { "X-PP": "1" }),
  update: (data) => post("admin.php?action=update", data, { "X-PP": "1" }),
  sync: () => post("admin.php?action=sync", {}, { "X-PP": "1" }),
  async get(action, params = {}) {
    const r = await fetch(API + "admin.php?" + new URLSearchParams({ action, ...params }), { credentials: "same-origin" });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { const e = new Error(j.error || "Request failed"); e.status = r.status; throw e; }
    return j;
  },
  exportUrl: () => API + "admin.php?action=export"
};
