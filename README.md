# Pulidevan Prabakaran

A no-scroll, click-through conversation with Pulidevan Prabakaran, founder of AI Essentials. A floating half-gold head above the clouds, an AI clone that talks in his voice and books ₹999 calls through Razorpay, and a 3D crate of SoundCloud lofi records.

```bash
npm install
npm run dev        # site on http://localhost:5173, dashboard on /admin.html (PHP + Vite)
```

- Site words: `src/content.js`. What the AI knows: `public/api/_brand.php`.
- Secrets: `pp-config.php` in the project root (git-ignored). Agent instructions: `AGENTS.md`.

## Deploy to Hostinger

Live at https://pulidevan.com (account u666355642). To redeploy:

1. `npm run build`, copy `dist/` somewhere temporary, add `api/_config.php` (see `AGENTS.md`), zip it.
2. Hostinger API: `POST /api/hosting/v1/files/upload-urls` → TUS-upload the zip into public_html → `POST /api/hosting/v1/accounts/u666355642/websites/pulidevan.com/deploy` with `archive_path`. This replaces everything in public_html, so the zip must include `api/_config.php`.
3. Razorpay → the ₹999 Payment Page → redirect after payment: `https://pulidevan.com/?paid=1`.
4. To list payers in `/admin.html`: add Razorpay API keys to `api/_config.php` (and optionally a webhook to `https://pulidevan.com/api/razorpay-webhook.php`, event `payment.captured`).

Stack: Vite 5 · React 18 · Three.js r160 · PHP 8 + SQLite · Gemini API · Razorpay · SoundCloud Widget API.
