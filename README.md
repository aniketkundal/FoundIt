# FoundIt — Smart Campus Lost & Found for SMVDU

**Live:** https://found-it-six.vercel.app

FoundIt is a lost-and-found platform for **Shri Mata Vaishno Devi University (SMVDU)**. Anyone in the SMVDU community can report a lost or found item in seconds, and an **AI matching engine** automatically surfaces likely matches between lost and found reports — with a safe, mediated, admin-overseen **claim-and-handover** flow.

- **Stack:** MERN — MongoDB (Atlas), Express, React (Vite), Node.js
- **Hosting:** Vercel (frontend + serverless API) + MongoDB Atlas — all on **free tiers**
- **AI matching:** DB pre-filter + Google **Gemini** (`gemini-2.5-flash`) ranking
- **Author / owner:** **Aniket Kundal**

---

## Features

- **SMVDU-gated accounts** — registration restricted to configured email domains; JWT auth; `user` and `admin` roles.
- **Report lost/found** — multi-step form, campus-aware locations and categories (each with a custom "Other" option), optional photo (Cloudinary), and a private ownership-verification question. Mobile-optimized with a collapsible menu and touch-friendly controls.
- **Browse** — searchable, filterable feed (type, category, location) with pagination.
- **AI matching** — every new report is pre-filtered in the DB then ranked by Gemini, producing a **confidence score + human-readable reason**. Both parties are notified (in-app + email).
- **Claims & handover** — claimants answer the private verifying question; the finder/admin approves or rejects; the status lifecycle runs `open → potential_match → claim_pending → claim_approved → collected/closed`.
- **Direct contact** — call / WhatsApp the reporter (community-only), with item details pre-filled into the WhatsApp message.
- **Admin dashboard** — stats, moderation (remove/restore), pending-claim review, desk-held items, password-reset requests, and an audit log.
- **Notifications** — in-app notification centre + Brevo transactional email.
- **Polish** — clean SaaS design, real SMVDU branding, dark mode, mobile-first responsive, accessible (labels, focus states, reduced-motion), and security-hardened (helmet, CSP, rate limits, validation).

## Tech & architecture

Express does **not** run as a long-lived server on Vercel. The app is built as a monorepo:

```
FoundIt/
├─ api/index.js          # Vercel serverless entry — exports the Express app
├─ server/               # Express app
│  ├─ app.js             # app factory: middleware, routes, error handler
│  ├─ config/            # env, cached Mongo connection, domain constants
│  ├─ models/            # User, Item, Match, Claim, Notification, AuditLog, PasswordResetRequest
│  ├─ routes/            # auth, items, claims, matches (via items), notifications, admin, config, health
│  ├─ controllers/       # request handlers
│  ├─ middleware/        # auth (JWT), role guard, validation (Zod), rate-limit, errors
│  └─ services/          # gemini (ranking), matching (orchestration), email (Brevo), audit
├─ client/               # Vite + React SPA
│  ├─ public/            # smvdu-logo.png, favicon.png, campus.jpg
│  └─ src/
│     ├─ components/     # NavBar, Footer, Logo, Icons, ItemCard, Badge, modals, etc.
│     ├─ pages/          # Landing, Login, Signup, Browse, ReportItem, ItemDetail, Profile, Admin, …
│     ├─ context/        # Auth, Theme, Config, Notification providers
│     ├─ lib/            # api client, cloudinary upload, display helpers
│     └─ styles/         # tokens.css + global.css (design system)
├─ vercel.json           # build + routing + security headers
└─ .env.example          # required environment variables
```

`vercel.json` rewrites every `/api/*` request to the single serverless function and serves the Vite build as static files. The MongoDB connection is **cached across warm invocations** to respect Atlas free-tier connection limits.

## How the AI matching works

1. **Pre-filter (cheap, in MongoDB):** when an item is posted, find open reports of the **opposite type**, same **category**, within a **±30-day** window — capped at 12 candidates.
2. **Rank (Gemini):** the new item + candidates are sent to `gemini-2.5-flash`, which returns **strict JSON** (`responseSchema`) with a `score (0–100)` and a one-line `reason` per candidate. Transient `503/429` responses are retried with backoff.
3. **Record & notify:** matches scoring ≥ 50 become `Match` records; both items move to `potential_match`; both reporters get an in-app notification + email.

This keeps cost near-zero (one small call per report, well within Gemini's free tier) while still giving an explainable match. A future upgrade path is embeddings + Atlas Vector Search (the schema already reserves an `embedding` field).

## Accounts & roles

- Registration requires an email in `ALLOWED_EMAIL_DOMAINS` (e.g. `smvdu.ac.in`).
- A user becomes **admin** automatically if their email is in `ADMIN_EMAILS`. To promote an already-registered user, run `npm run seed:admin`.
- **Forgot password** is admin-mediated: a user requests a reset → admins approve in the dashboard → a temporary password is emailed → the user changes it from **Profile → Change password**.

## Environment variables

Copy `.env.example` → `.env` for local dev, and set the **same keys** in your Vercel project (Production + Preview).

| Variable | Purpose |
|---|---|
| `MONGODB_URI` | Atlas connection string (include the `/foundit` db name) |
| `JWT_SECRET` | Secret for signing login tokens — long random string |
| `ALLOWED_EMAIL_DOMAINS` | Comma-separated domains allowed to register |
| `ADMIN_EMAILS` | Comma-separated emails granted the admin role |
| `GEMINI_API_KEY` | Google Gemini key ([aistudio.google.com/apikey](https://aistudio.google.com/apikey)) |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary cloud name (public) |
| `CLOUDINARY_UPLOAD_PRESET` | Cloudinary **unsigned** upload preset (public) |
| `BREVO_API_KEY` | Brevo API key for transactional email |
| `BREVO_SENDER_EMAIL` | Verified Brevo sender address |
| `BREVO_SENDER_NAME` | Display name for emails (e.g. `FoundIt SMVDU`) |
| `CLIENT_URL` | Public app URL — used in email links and prod CORS |

## Local development

**Prerequisites:** Node.js 18+, a MongoDB Atlas connection string.

```bash
# 1. Install dependencies
npm install
npm install --prefix client

# 2. Configure environment
cp .env.example .env        # then fill in the values

# 3. Run API + frontend together
npm run dev
```

- Frontend: http://localhost:5173 · API: http://localhost:5000 (the frontend proxies `/api` here)
- Useful scripts: `npm run build` (build client), `npm run seed:admin` (promote ADMIN_EMAILS users)

## Deployment (Vercel + Atlas, free tier)

1. **Atlas** — create a free **M0** cluster, a database user, and allow network access from anywhere (`0.0.0.0/0`, required for Vercel's dynamic IPs). Copy the connection string.
2. **Cloudinary / Brevo / Gemini** — create free accounts and grab the keys (see the env table). For Cloudinary, create an **unsigned** upload preset.
3. **GitHub** — push this repo to your GitHub account.
4. **Vercel** — “Add New → Project”, import the repo. Vercel auto-detects the config in `vercel.json` (build command `npm run build`, output `client/dist`). Add **all environment variables** from the table above, then **Deploy**.
5. Set `CLIENT_URL` to your Vercel production URL and redeploy so email links and CORS use the right origin.

**Free-tier notes:** Vercel Hobby has a serverless timeout (matching keeps Gemini calls small); Atlas M0 = 512 MB; Gemini Flash free tier ≈ 1,500 req/day; Brevo ≈ 300 emails/day; Cloudinary ≈ 25 GB. The app degrades gracefully if email/AI is unavailable.

## Security

JWT + bcrypt auth, role-based middleware, Zod validation on every write, centralized error handling, rate-limiting on auth + posting, `helmet` headers on the API, a Content-Security-Policy and security headers on the SPA (`vercel.json`), CORS locked to `CLIENT_URL` in production, and an audit log of sensitive actions. Verifying answers are hashed and never returned; personal contact is shown only to the logged-in SMVDU community.

## License

MIT © Aniket Kundal
