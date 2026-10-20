# Pulidevan Prabakaran — site agent guide

A no-scroll 3D site for **Pulidevan Prabakaran**, founder of AI Essentials. Always write his full name, never a nickname. Read this before changing anything.
Works for Claude Code, Antigravity, Cursor or any coding agent. `CLAUDE.md` points here.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # static site in dist/ (relative paths, runs from any URL or folder)
npm run preview    # serve dist/ locally
```

Node 18+ and PHP 8.1+ (with pdo_sqlite and curl). `npm run dev` starts both PHP's built-in server (port 8787, serving `public/api`) and Vite (5173), and Vite proxies `/api` to PHP. `npm run dev:web` runs the frontend alone (the chat then falls back to errors).

Secrets go in `pp-config.php` in the project root (git-ignored); see "Backend" below. The music only works when served over http(s), not from `file://`.

## What the page is

One fixed screen, never scrolls:

- **Center:** his floating head, half skin and half liquid gold. A photo cutout on a dense plane displaced by a real depth map (Depth Anything V2). Rigid, turns only within ±0.3 rad. Clicking it asks the chat "Who are you?".
- **Bottom left: the AI clone.** Pulidevan Prabakaran's second brain, talking to visitors in first person in his voice (Gemini, streamed). The header shows his full face floating with a blurred halo. Visitors type or tap prompts; the log scrolls inside the card.
- **Cards in the chat:** a reply ending in `<videos/>` shows a reel of student films hosted for filmaking.aiessentials.in (hover previews, click plays inline). `<book/>`, or the "Book a call · ₹999" chip, shows the ₹999 call card linking straight to Razorpay.
- **No personal data on the site.** No forms, nothing typed is stored. Razorpay collects payer details; it sends payers back to `/?paid=1` for a thank-you.
- **Dashboard (`/admin.html`):** private. Only pulidevan3@gmail.com signs in (6-digit code by email). Lists people who paid on Razorpay (pulled in by "Sync payments" or the webhook), with WhatsApp/email buttons, notes, "contacted" status and CSV export.
- **Bottom right:** a 3D crate of vinyl records. Each record is a SoundCloud lofi artist, played through a hidden SoundCloud widget (no SoundCloud branding on the page). Hover lifts a record, click plays it, `S` shuffles, `M`/Mute sets volume to 0 (remembered). Autoplays where the browser allows, otherwise on the first click/tap/key. On phones the deck is a mute pill top right.
- **Atmosphere:** sprite clouds, a giant parallax name behind the head, film grain and a vignette.

## Where things live

| Path | What |
|---|---|
| `src/content.js` | **All site words.** Profile, the `assistant` (greeting, prompts, thank-you), the `offer` (price, Razorpay link), `films` and the SoundCloud `playlists`. |
| `public/api/_brand.php` | **The clone's brain:** facts, his voice, the `<book/>`/`<videos/>` rules, and the keyword fallback used when Gemini is unavailable. |
| `public/api/*.php` | Backend: `chat.php` (Gemini stream, nothing stored), `tts.php` (Google Gemini 3.8 Flash TTS realistic speech), `razorpay-webhook.php`, `admin.php` (sign-in + dashboard API). `_bootstrap.php` has config, the SQLite schema and payment matching. |
| `src/components/Chat.jsx` | The AI clone chat, film reel, booking card and realistic voice speech player. |
| `src/lib/api.js` | Browser → backend calls (streaming chat, leads, admin). |
| `admin.html`, `src/admin/` | The private dashboard. |
| `scripts/dev.mjs` | Starts PHP + Vite together. |
| `src/scene/createScene.js` | The Three.js layer: environment map, head cutout shader, clouds, record crate, picking, render loop. |
| `src/App.jsx` | HUD shell: header, chat, deck. Mounts the scene (skipped without WebGL; the chat still works). |
| `src/components/Deck.jsx` | Music card and the hidden SoundCloud widget controller. |
| `src/styles.css` | Design tokens (`:root`) and all styling. |
| `public/assets/` | The head cutout (`head.webp`) and its depth map. |
| `tools/make_cutout.py` | Photo → cutout + depth map pipeline. |
| `.github/workflows/pages.yml` | Auto-deploy to GitHub Pages on push to `main`. |

## How the pieces talk

- React → scene: `createScene()` returns `{ setRecord(i), dispose() }`.
- Anything → chat: window `CustomEvent` `pp-ask` (detail: question text). The head uses it.
- Scene → React: `pp-play` (detail: record index) when a record is clicked.

## Backend

Plain PHP + SQLite so it runs on Hostinger shared hosting next to the static site. Config is read from environment variables, then `pp-config.php` two folders above `api/` (the project root locally), then `api/_config.php` (how production is set up: Hostinger's upload API only writes inside public_html, and `.htaccess` blocks every `_` file). The database is `pp-data/pp.sqlite` in the same place.

`pp-config.php` returns an array:

| Key | What |
|---|---|
| `GEMINI_API_KEY` | Google AI Studio key. Without it the chat uses the keyword fallback. |
| `GEMINI_MODEL` | Default `gemini-3.5-flash` (fast first word). `GEMINI_THINKING` defaults to `minimal`. |
| `ADMIN_EMAIL` | Default `pulidevan3@gmail.com`. The only account that can sign in. |
| `MAIL_FROM` | Sender for sign-in codes, e.g. `no-reply@pulidevan.com` (must be a mailbox on the domain). |
| `APP_SECRET` | Any long random string (used to hash visitor IPs for rate limits). |
| `RAZORPAY_PAGE_URL` | Default the ₹999 discovery-call page. |
| `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` | Lets the site confirm payments with Razorpay and enables "Sync payments". |
| `RAZORPAY_WEBHOOK_SECRET` | For `api/razorpay-webhook.php` (event `payment.captured`). |
| `PRICE_PAISE` | Minimum amount that counts as paid. Default 99900. |

Payment truth: someone shows in the dashboard only once Razorpay confirms a captured payment of at least ₹999 (Sync with API keys, or the webhook). The site itself never collects names, emails or phones.

## Writing for the assistant

- Facts live in `_brand.php` only. Don't add clients, numbers, prices, dates or guarantees that the owner hasn't confirmed.
- Keep it about Pulidevan Prabakaran as founder of AI Essentials. No résumé, past jobs or client list.
- First person, his voice, under 50 words. `<videos/>` for AI video questions, `<book/>` when they're ready to book.

## Design system (keep it)

- **Palette:** teal sky (`--sky-top #3f7f97`, `--sky-mid #86b6c0`, `--sky-low #d7e8e6`), ink `#0f2a33`, signal orange `#ff5a1f` / `#d8401f`, frosted glass panels. Orange is the only accent.
- **Type:** Bricolage Grotesque for display and UI, Instrument Serif *italic* for the one emphasised phrase per block, JetBrains Mono uppercase with letter-spacing for labels and data.
- **Materials:** chrome, orange wool and frosted glass. Everything in the 3D layer should look photographed, never like a toy. Prefer photo cutouts with depth maps over modelled primitives.
- **Motion:** slow drift and bob, eased camera moves, one sheen sweep across the head. Honour `prefers-reduced-motion`. All smoothing in the loop uses `E(q)` (frame-rate independent). Keep it that way.

## Rules for changes

1. Personal facts go in `content.js` only. Don't invent clients, numbers, prices or quotes.
2. Don't deform the cutouts beyond their depth maps. Keep head rotation at ±0.3 rad or less, or the photo stretches ("clay" look).
3. Hit-testing uses the 2-triangle `hit` plane plus the alpha `MASK` for the head, and fixed `slots` for records. Never raycast the dense relief meshes. That cost ~130k triangle tests per frame before.
4. **No repeated images.** Never reuse an image, or a mirrored copy of it, as a second element. Use a new image instead.
5. Never put secrets in `public/` or `src/`. Never ship `pp-config.php` or `pp-data/` inside `dist/`.
6. Keep the page no-scroll and working at 400px wide (mobile layout is in the `@media (max-width:820px)` block).
7. After changes, run `npm run build` and check the console is clean.

## Known limits

- Music: browsers block sound until the visitor interacts, so true autoplay only works where the browser allows it; otherwise it starts on the first click, tap or key.
