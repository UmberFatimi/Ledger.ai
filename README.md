# Ledger.ai

A small fintech wallet: account balances, transfers between users, transaction history, AI-assisted
categorization with a correcting feedback loop, and spending insights. Single Next.js App Router
codebase — Route Handlers under `app/api/` are the backend, the same project serves the UI.

See [DECISIONS.md](./DECISIONS.md) for the reasoning behind every non-obvious choice (data modeling,
idempotency, concurrency/locking, the AI feedback loop, and known limitations).

## Stack

- **Next.js (App Router)** — TypeScript, strict mode. Route Handlers = API layer, same deploy as the UI.
- **PostgreSQL via Prisma ORM**, hosted on **Neon** (serverless-friendly, pooled connections for Vercel).
- **Google Gemini** (`@google/generative-ai`) for transaction categorization.
- **jose** for JWT session signing/verification; Node's built-in `crypto.scrypt` for password hashing.
- **zod** for request validation.

## Project structure 

```
app/
  api/            Route Handlers (the backend API)
  (pages)/        UI pages
lib/
  prisma.ts       single reused PrismaClient instance
  services/       business logic (transfer, categorization, insights, accounts, transactions, auth)
  session.ts      JWT session issuing/verification (see DECISIONS.md)
  jwt.ts          sign/verify the session JWT (edge-safe: no node:crypto, no Prisma)
  password.ts     scrypt password hashing
  errors.ts       typed error hierarchy shared by every API route
  api-handler.ts  wraps Route Handlers with consistent error → HTTP status mapping
prisma/
  schema.prisma
  seed.ts         seeds demo users (with a shared password) + drives real transfers through the
                   actual service layer
proxy.ts          Next.js 16's renamed "Middleware" — refreshes the sliding 5-minute session
                   on every request (see DECISIONS.md)
```

## Setup

### 1. Prerequisites

- Node.js 20+
- A [Neon](https://neon.tech) Postgres project (free tier is fine)
- A [Google AI Studio](https://aistudio.google.com/apikey) API key — **use this exact page**, not the
  Cloud Console. Keys from `aistudio.google.com/apikey` start with `AIzaSy...` and get free-tier
  quota; keys minted other ways may authenticate but return a zero-quota `429` on every call (this
  happened during development — see DECISIONS.md).

### 2. Environment variables

Copy `.env.example` to `.env` and fill in real values:

```bash
cp .env.example .env
```

```bash
# Neon pooled connection (PgBouncer) — used by the running app
DATABASE_URL="postgresql://user:pass@ep-xxx-pooler.region.aws.neon.tech/dbname?sslmode=require&channel_binding=require"

# Neon direct (non-pooled) connection — used only by Prisma Migrate/seed.
# Same as DATABASE_URL but with "-pooler" removed from the host.
DIRECT_URL="postgresql://user:pass@ep-xxx.region.aws.neon.tech/dbname?sslmode=require&channel_binding=require"

GEMINI_API_KEY="AIzaSy..."

# Signing secret for JWT session tokens. Generate with:
#   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# Rotating this immediately invalidates every existing session.
SESSION_SECRET="<a long random hex string>"
```

Both connection strings are in Neon's dashboard under **Connection Details** — toggle "Pooled
connection" to get each variant.

### 3. Install, migrate, seed

```bash
npm install
npx prisma migrate deploy   # applies the schema + CHECK constraints to your database
npx prisma db seed          # creates 5 demo users and ~17 sample transfers
```

The seed script drives its sample data through the real transfer + categorization service — the
same code path the API uses — so it also exercises real Gemini calls on first run. If Neon's
free-tier compute has been idle, the very first query can be slow (cold start); the seed script
warms the connection up front, but if you still see a timeout on the very first attempt, just
re-run `npx prisma db seed`.

### 4. Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — you'll land on the login page.

**Demo credentials** (all 5 seeded users share this password):

| Email | Password |
|---|---|
| alice@example.com | `Password123!` |
| bob@example.com | `Password123!` |
| carol@example.com | `Password123!` |
| dave@example.com | `Password123!` |
| eve@example.com | `Password123!` |

Or use the Sign Up tab to create a brand-new account (starts at $0.00). Sessions time out after
5 minutes of inactivity (sliding — any activity resets the clock) and require logging back in,
same as a real banking app; see DECISIONS.md for the mechanism.

## Deployment (Vercel)

1. Push this repo to GitHub, import it in Vercel.
2. Set `DATABASE_URL`, `DIRECT_URL`, `GEMINI_API_KEY`, and `SESSION_SECRET` as Vercel environment
   variables (same values as `.env` — or generate a fresh `SESSION_SECRET` for production).
3. Deploy. Vercel's build runs `prisma generate` automatically via the `postinstall`-equivalent
   Next.js build step; no separate backend deploy is needed — Route Handlers ship as part of the
   same deployment as the UI.
4. Run `npx prisma migrate deploy` once (locally, pointed at the production `DIRECT_URL`, or via a
   one-off Vercel deploy hook) before the first request hits a fresh database, then `npx prisma db
   seed` if you want demo data in production too.

Live deployment: **[fill in after deploying]**

## Manual test scenarios to verify before submitting

These are the scenarios the assessment is graded on most heavily. All of them were exercised
directly against the running API during development (not just written and assumed to work) —
details of what was found and fixed are in DECISIONS.md.

1. **Duplicate idempotency key never double-transfers.** On the Send Money page, submit a
   transfer, then click "Retry same request" — it must return the *same* transaction (check the ID)
   and the balance must only move once. (Equivalent curl: send the same `POST /api/transfers` body
   twice with the same `Idempotency-Key` header; the second response should have `"replayed": true`
   and an unchanged balance.)
2. **Concurrent transfers on the same account stay correct.** Fire several simultaneous transfers
   between the same two accounts (e.g. a short shell loop of `curl ... &`). The final balance must
   reflect the exact sum of all successful transfers — no lost updates, no deadlock errors.
3. **Insufficient balance is rejected, and rejected identically on retry.** Attempt a transfer
   larger than the sender's balance — expect a `422 INSUFFICIENT_FUNDS`, and the balance unchanged.
   Retry with the *same* idempotency key: expect the identical error, not a different one and not a
   silent success.
4. **Category correction persists and is reused.** On the Transactions page, click a category badge
   and correct it. Make a new transfer with a similar description (e.g. correct "Uber ride" to
   Transport, then send a new transfer described "Uber trip") — the new transaction should be
   categorized `PATTERN_MATCH` (hover the badge, or check `categorySource` in the API response)
   without a new Gemini call, using your correction.
5. **Wrong password / nonexistent email give the identical error.** Try logging in with a seeded
   email and a wrong password, then with an email that doesn't exist at all — both must return the
   same "Invalid email or password" message (not "no account found," which would leak which emails
   are registered).
6. **Signup creates a real $0.00 account.** Use the Sign Up tab with a new email — the resulting
   account balance must be exactly $0.00, not pre-funded. Send it money from a demo user afterward
   and confirm the balance updates.
7. **Session times out after 5 minutes idle, and activity resets the clock.** Log in, then leave the
   tab alone for 5+ minutes — the next navigation should redirect to `/login?reason=timeout` with a
   visible "logged out after 5 minutes of inactivity" message. Separately, confirm that *actively*
   using the app for longer than 5 minutes (clicking around every minute or so) does **not** log you
   out — the timeout is idle-based, not a fixed countdown from login.
