# Decisions

Running log of the design decisions behind this project, kept up to date as the build progresses. Each entry says what was decided, why, and what the tradeoff was against the alternative.

## Architecture: Next.js full-stack instead of a separate backend

**Decision:** Next.js App Router serves both the UI and the API (Route Handlers under `app/api/`), single codebase, single Vercel deployment.

This is a deliberate architectural choice, not a shortcut. The reasons:

- **Deploy simplicity and reliability.** One deployment target means no CORS configuration, no coordinating two release pipelines, no separate env var sets to keep in sync, no question of "did the backend redeploy before the frontend." For a small assessment app, a second service is pure operational surface area with no corresponding benefit.
- **The API layer still follows the layered structure an Express/Nest backend would have**: `app/api/*/route.ts` (routing/HTTP concerns only) → `lib/services/*` (business logic) → `lib/prisma.ts` (data access). Route Handlers are thin — they validate input with zod, call a service function, map the result to an HTTP response. All the logic a reviewer would want to read (transfer processing, categorization, insights) lives in `lib/services/`, not inline in route files. This is the same mental model as `routes → controllers/services → models` in Express; only the file-based routing convention differs.
- **Vercel is the deploy target regardless**, and Vercel's own runtime is built around Next.js — running a second Express/Nest service would mean either a separate host (more infra to explain and could fail independently) or awkwardly wrapping it as Vercel serverless functions anyway, at which point it's not really "a different backend," just more code achieving the same thing Route Handlers already do natively.

**Known cost of this choice:** Route Handlers are a newer surface than traditional Express routing, so there's a small learning-curve tax, and Next.js's own conventions (e.g. async `params`, non-cached-by-default `GET`) leak into the API layer in ways a bare Express app wouldn't have. Worth it here for the single-deploy guarantee the assessment explicitly asks for.

## Toolchain note: Next.js 16 / Prisma 7 (very recent versions)

The scaffold came pre-installed with Next.js 16.2.10 and, once installed, `prisma`/`@prisma/client` resolved to 7.8.0 — both meaningfully newer than what's common in most tutorials/training material. Two concrete breaking changes this caused, resolved by reading the installed packages' own docs/types rather than assuming prior knowledge:

1. **Route Handler `params` is a `Promise`** (`{ params }: { params: Promise<{ id: string }> }`, must be `await`ed) — a Next.js 15+ change, still true in 16.
2. **Prisma 7 removed `url`/`directUrl` from `datasource` blocks in `schema.prisma` entirely.** Connection strings now live in two places instead:
   - `prisma.config.ts` — used only by the Prisma CLI (`migrate`, `studio`, `db push`). Configured to use `DIRECT_URL` (Neon's non-pooled connection), because Postgres migrations need session-level features (advisory locks, prepared statements) that PgBouncer's transaction-mode pooling doesn't support well.
   - `lib/prisma.ts` — the actual running app. Constructs a `@prisma/adapter-pg` driver adapter explicitly from `DATABASE_URL` (Neon's **pooled** connection, the one that matters for not exhausting connections under Vercel's serverless concurrency) and passes it to `new PrismaClient({ adapter })`.

   This is a better fit for our requirements than the old model, not a workaround — Prisma 7's driver-adapter pattern is exactly the "explicit, serverless-aware connection" story we need for Neon + Vercel.

## Data modeling: ledger pattern

**Decision:** implemented as specified — `Account.balanceCents` is a fast-read cache; `TransactionEntry` (one DEBIT row + one CREDIT row per transfer, each with a `balanceAfter` snapshot) is the source of truth and audit trail; `Transaction` is one row per transfer *attempt*, carrying the idempotency key and status.

### Money: integer cents vs Decimal/Numeric

**Decision: integer cents** (`balanceCents`, `amountCents` as Postgres `INTEGER`).

- Floats are disqualified outright — `0.1 + 0.2 !== 0.3` in IEEE 754, unacceptable for a ledger.
- Between the two exact options: `NUMERIC` avoids the cents conversion in the schema, but Prisma represents `NUMERIC` as a JS **string** at the client boundary to avoid float precision loss — meaning every add/subtract in the service layer needs a decimal library (e.g. `decimal.js`) instead of native arithmetic.
- Integer cents is a plain JS `number`: arithmetic is exact and native, comparisons for the `CHECK (balanceCents >= 0)` constraint are trivial, and the only cost is dividing by 100 for display. This is a fine tradeoff for a single-currency app with exactly 2 decimal places (true here).

### Isolation level: READ COMMITTED + row locks vs SERIALIZABLE

**Decision: READ COMMITTED (Postgres's default) + explicit `SELECT ... FOR UPDATE`** on both accounts involved in a transfer, always locked in ascending `id` order regardless of which account is sender vs receiver.

- We are not relying on snapshot consistency across arbitrary rows — we're serializing access to the exact two rows a transfer touches, which row locks do directly and cheaply.
- SERIALIZABLE gives the same correctness automatically but can abort transactions with a `40001 serialization_failure` under contention, which pushes retry-loop complexity into every caller. Since we already have to hold locks correctly for the ledger pattern to work, SERIALIZABLE would be strictly more machinery for no additional guarantee here.
- Consistent lock ordering (sort by account ID before locking) is what prevents deadlocks between two transfers that touch the same two accounts in opposite directions concurrently — without it, transfer A→B and transfer B→A locking in "sender first" order could each hold one lock and wait on the other forever.

**Two real deadlock bugs were found and fixed during testing** (10 simultaneous transfers between the same two accounts, fired with `curl ... &` in a loop) — recording both because neither is obvious in advance and both are genuine Postgres gotchas, not application logic errors:

1. **`ORDER BY` on `SELECT ... FOR UPDATE` doesn't order lock acquisition.** The first implementation locked both accounts with one statement — `SELECT ... FROM "Account" WHERE "id" IN ($a, $b) ORDER BY "id" FOR UPDATE` — reasoning that `ORDER BY "id"` would make Postgres acquire the two row locks in ascending-ID order. It doesn't: `ORDER BY` only sorts the *returned rows*, it doesn't control the order the query planner scans and locks matching rows during execution. Two concurrent transfers with sender/receiver roles reversed could lock the same two rows in opposite orders and deadlock (`40P01`). Fix: two **separate, sequential** single-row `SELECT ... WHERE "id" = $id FOR UPDATE` statements, issued in ascending-ID order — since they're separate round trips on the same transaction, the first lock is fully held before the second is even requested, which is what actually enforces a consistent order.

2. **Locking the accounts *after* inserting the `Transaction` row also deadlocks**, even with the ordering fix from (1) applied. The `Transaction` insert references both accounts via foreign key, and Postgres takes an implicit `FOR KEY SHARE` lock on both referenced rows to validate that FK — before our explicit locks ever run. `FOR KEY SHARE` is a shared lock, so many concurrent transactions' inserts all succeed and proceed past it simultaneously. Then every one of those transactions tries to upgrade its own shared lock to an exclusive `FOR UPDATE` lock on the same row at roughly the same time — each waiting for every *other* transaction's shared lock to clear first — forming a wait cycle and deadlocking. Fix: acquire the exclusive `FOR UPDATE` locks on both accounts **before** creating the `Transaction` row. By the time the insert's implicit FK check runs, this transaction already holds the strongest possible lock on both rows itself, so there's no weaker lock for anyone to be racing to upgrade.

After both fixes: re-ran the same 10-concurrent-transfer test — zero deadlocks, zero lost updates, exactly 10× the transfer amount moved. This ordering (lock accounts, then insert the idempotency-keyed row) means a duplicate-key request pays for lock acquisition before discovering it's a duplicate on the insert — a minor inefficiency, not a correctness issue, since duplicate keys are the rare case (retries), not the common one.

### Idempotency design

**Decision: `Idempotency-Key` HTTP header**, required on `POST /api/transfers`.

Mechanism (implemented in `lib/services/transfer.ts`):

1. Open a DB transaction. Attempt to `INSERT` a `Transaction` row with `status = PENDING` using the caller-supplied key as `idempotencyKey` (a `@unique` column).
2. If the insert violates the unique constraint, the key has been used before: abandon this attempt, read back the **existing** row by that key outside the failed transaction, and return its stored outcome verbatim (same status code, same body) — regardless of whether the original attempt succeeded or failed. Concurrent duplicate submissions are handled by Postgres itself: a second `INSERT` with the same unique key blocks until the first transaction commits, then deterministically fails — no polling, no extra application-level locking required.
3. If the insert succeeds (first time seeing this key): lock both accounts `FOR UPDATE` in ascending ID order, validate the sender's balance.
   - Insufficient funds → mark the row `FAILED` with a reason and **commit** (not roll back). This permanently burns the idempotency key against that specific failure, so a retry gets the identical "insufficient funds" response instead of silently re-evaluating against a balance that may have since changed.
   - Sufficient → debit sender, credit receiver, write both `TransactionEntry` rows with `balanceAfter` snapshots, mark `COMPLETED`, commit.
4. Any *unexpected* error (DB error, etc.) rolls back the entire transaction, including the `Transaction` insert — so a transient failure never burns the idempotency key, and a genuine client retry is correctly treated as a first attempt.

Chose the header (over a body field) to mirror the Stripe/PayPal convention reviewers will recognize immediately, and to keep retry semantics decoupled from the transfer payload itself.

## Auth: password + JWT session with a sliding 5-minute idle timeout

**Original decision (superseded):** the first version of this app used a "log in as" picker over the seeded demo users — no password, a DB-backed opaque token. That was an explicit, documented scope tradeoff for speed, since none of the graded requirements (idempotency, concurrency, ledger correctness, AI feedback loop) depend on auth sophistication. It was later upgraded to real credentialed auth at the user's request, described below. The rest of this section describes the **current** design.

**Current decision:** real email+password login, and a stateless JWT session with a 5-minute *sliding* (idle) timeout — matching how real banking apps behave (activity keeps you logged in; 5 minutes of inactivity logs you out and requires re-entering credentials, not a hard cutoff mid-session).

- **Password storage:** Node's built-in `crypto.scrypt` (see `lib/password.ts`), not bcrypt/argon2. Zero extra dependency, no native bindings to worry about across dev/CI/Vercel, and scrypt is a well-regarded memory-hard KDF. Stored as a single self-contained `"salt:derivedKeyHex"` string — one column, no separate salt table. Verification uses `crypto.timingSafeEqual`, not `===`, to avoid leaking a byte-by-byte timing oracle.
- **Login error messages are identical** whether the email doesn't exist or the password is wrong ("Invalid email or password") — distinguishing them would let an attacker enumerate registered emails.
- **JWT library:** `jose`, not `jsonwebtoken` — it's edge/runtime-agnostic (no `node:crypto` dependency), which matters because the token is verified from two different runtime contexts (see below), and it's the library the Next.js team itself points to in this scenario.
- **Session is fully stateless** — no DB table at all. The `Session` model from the original design was dropped in a migration; a signed JWT (`{ userId, iat, exp }`, HS256) in an httpOnly cookie is the entire session. Verifying it is pure signature+expiry checking, no DB round-trip. The cost: there's no way to force-invalidate a session before its natural expiry (no "log out everywhere" button, no revocation list) — acceptable given the window is only 5 minutes, and worth calling out as a real limitation for the "known limitations" section.
- **Sliding expiration mechanism:** every request re-signs the token with a fresh 5-minute `exp` and re-sets the cookie. This runs in `proxy.ts` — the Next.js **16** file convention (see below), invoked on every matched request before the route handles it. Verified live: hitting `/api/auth/me` twice a few seconds apart produced two different `exp` timestamps, confirming activity genuinely extends the session rather than just appearing to.
- **Timeout redirect distinguishes cause:** `lib/session.ts`'s `requireCurrentUserForPage()` checks whether a session cookie was present-but-invalid (→ `/login?reason=timeout`, shows "you were logged out after 5 minutes of inactivity") versus never present at all (→ plain `/login`). Verified live by forging an already-expired JWT and confirming the dashboard 307-redirects to the `reason=timeout` variant specifically.
- **Sign-up:** `POST /api/auth/signup` (name, email, password — 8 char minimum) creates a `User` + a fresh `Account` starting at **$0.00**, then logs them in. A new user has to receive their first transfer from an existing account before they can send anything, same as any real account — no "give yourself starting money" shortcut. Duplicate email returns `409 CONFLICT`.
- **The old no-password "log in as" demo picker was removed entirely** (not kept alongside real login) — leaving it in would have undermined the entire point of adding passwords and timeouts. The seed script sets the same known password (`Password123!`, documented in README.md) for all 5 demo users, so grading is exactly as easy as the picker was: log in with any seeded email + that password.

**Next.js 16 surprised us again here:** `middleware.ts` doesn't exist anymore — it was renamed to `proxy.ts` in v16 (same file-convention slot: project root, runs before every matched request), and as of v16 it now **defaults to the Node.js runtime** instead of Edge. Found this by grepping the installed `next` package's own bundled docs rather than assuming prior knowledge, since this project has repeatedly had newer-than-expected framework/library versions.

## Client-side cache invalidation after mutations

**Bug found during live testing, not from the automated test scenarios below:** after sending a transfer, then clicking "Transactions" in the nav, the new transaction sometimes didn't appear. Verified via direct API calls (bypassing the browser entirely) that the data was always correct — the transaction existed and `GET /api/transactions` returned it immediately after the transfer committed. The bug was Next.js's **client-side router cache**: `<Link>` navigation can reuse a previously-prefetched RSC payload for a route instead of asking the server again, and nothing was telling it that a mutation had made that cached payload stale.

Fix: every mutating route handler (`POST /api/transfers`, `PATCH /api/transactions/[id]/category`, `POST /api/auth/login`, `POST /api/auth/logout`, `POST /api/auth/signup`) now calls `revalidatePath('/', 'layout')` from `next/cache` after its write succeeds. This invalidates the router cache for the whole app on the next navigation — simplest correct option at this app's size; a larger app would use tag-based `revalidateTag` scoped to just the affected data. Login/logout also revalidate, since switching users must never show a trace of the previous user's cached pages.

## AI categorization

**Categories:** Food & Dining, Transport, Bills, Shopping, Entertainment, Salary, Transfers, plus **Other** as an explicit fallback — both for genuinely ambiguous descriptions and as the safe default if the LLM call fails after retries. Forcing every transaction into one of 7 buckets with no escape hatch produces confidently wrong categorizations; `Other` is the honest alternative.

**Feedback loop:** corrections table + pattern match before the LLM call, over embeddings/similarity search.

- When a user corrects a transaction's category, we store `(userId, normalizedDescription) → category` in `CategoryCorrection`.
- On every new transaction, we check for a matching prior correction on that (normalized) description **before** calling the LLM at all. A hit short-circuits the LLM entirely.
- Only when there's no matching correction do we fall back to the Gemini call.

This is simple, fully transparent (the UI can honestly say "categorized from your past correction," see `categorySource`), adds no infrastructure, and the learning effect is directly demonstrable: correct a category once, submit a similar transaction again, watch it skip the LLM. The alternative (embedding-based similarity search) would catch paraphrased descriptions exact/substring matching misses (e.g. "Uber" vs "Uber Trip #4521"), but requires a vector column (`pgvector` on Neon), an embedding API call per transaction, and a similarity-threshold tuning problem — meaningfully more build and debug time for a difference that's unlikely to be visible in a short demo with a handful of transactions.

**Gemini rate-limit handling:** `callGeminiForCategory` in `lib/services/categorization.ts` retries up to 3 times with exponential backoff (500ms, 1s, 2s) specifically on a `429` response, and falls back to category `OTHER` with `categorySource: FALLBACK` if all retries are exhausted (or on any other error) — a burst of test transactions, or a genuinely exhausted free-tier quota, degrades the categorization quality rather than failing the transfer that triggered it. This fallback path is real, not theoretical: it's exactly what happened during development (see below), and it worked as designed — every transfer still completed correctly while categorization silently degraded to `OTHER`.

**Model selection, and a real debugging story worth recording:** the request was to use `gemini-1.5-flash` or `gemini-2.0-flash`. In practice, live-testing against the free-tier API key found:
- `gemini-2.5-flash` and `gemini-2.5-flash-lite`: `404 Not Found` — "no longer available to new users" (deprecated for new API keys/projects, despite still appearing in the `ListModels` catalog).
- `gemini-2.0-flash` and `gemini-2.0-flash-lite`: authenticate fine, but return `429` with `limit: 0` on every call — not a normal rate limit, a genuine zero free-tier quota allocation for that specific model on this project.
- `gemini-flash-latest` (a rolling alias Google maintains to "the current recommended flash model," rather than a version-pinned name): works, with real quota, verified with a live call that returned a correctly structured `{"category":"FOOD_DINING"}` for a real test transaction.

Switched to `gemini-flash-latest`. This is a deviation from the exact model names given in the assessment brief, made necessary because Google's free-tier model availability shifted (version-pinned free access to `2.0-flash` appears to have been sunset since the brief was written) — using a rolling alias is arguably more robust for a project like this anyway, since it won't go stale the next time Google deprecates a specific version.

**Structured output:** the Gemini call uses `responseMimeType: "application/json"` with an explicit `responseSchema` (an enum-constrained `category` string, built from the same `CATEGORIES` list the UI uses), so the response is parsed as a JSON field — never regex/string-matched out of free text.

## Spending insights

**Decision:** three insights, computed via SQL aggregation (no extra LLM calls):

1. Top spending categories (current period, grouped sum)
2. Month-over-month spend change (absolute + %)
3. Monthly summary — income vs spend vs net

Deliberately left out **unusual/outlier transaction detection** given the time budget — it needs more query design (statistics over a user's own transaction history) than the other three, and the three chosen insights already cover "where is my money going," "is that changing," and "what's the bottom line," which is the more load-bearing set for a small demo.

## Seed data

**Decision:** yes — a re-runnable seed script (`npx prisma db seed`) creates ~5 demo users with starting balances and a handful of historical transactions spanning categories and dates, so insights and the category-correction feedback loop have real data to show on first run instead of an empty state.

## UI polish (requested after the core build)

Added at the user's request, layered on top of the already-working functionality rather than changing it: subtle entrance/hover animations (`app/globals.css`), a login/signup page redesign with a brand-colored ambient animated background (`components/AnimatedBackground.tsx`, colors pulled directly from `public/ledger-logo.svg`), a sticky frosted-glass nav bar, and a balance/amount count-up effect (`components/AnimatedNumber.tsx`). All respect `prefers-reduced-motion`. None of this touches the transfer/idempotency/concurrency/categorization logic — it's presentation-layer only, verified with the same typecheck+build gate as every other change in this log.

## Known limitations / intentionally omitted scope

- **No session revocation before natural expiry.** The JWT session is fully stateless (no DB-backed session table) — there's no "log out of all devices" or admin-forced logout. Given the 5-minute idle window this is a small exposure, but a production system handling real money would want at least a short-TTL revocation list (e.g. Redis) for compromised-token scenarios.
- **No password reset flow, no email verification.** Signup accepts any email without confirming the requester owns it. Fine for a demo; not fine for a real product.
- **No rate limiting on login attempts.** `POST /api/auth/login` can be brute-forced — no lockout, no backoff, no CAPTCHA. The password itself is safely hashed (scrypt), but nothing stops repeated guesses.
- **Unusual/outlier transaction insight was not built** (see "Spending insights" above) — deliberately deprioritized given the time budget in favor of the three insights that ship.
- **No pagination on transaction history** — `GET /api/transactions` caps at 100 rows via `take: 100`. Fine for a demo dataset; a real account history would need cursor-based pagination.
- **Single currency, no multi-currency support** — `amountCents` is assumed USD throughout; there's no currency column or conversion logic.
- **No automated test suite** (unit/integration tests). Correctness for the graded scenarios (idempotency, concurrency/locking, insufficient funds) was verified by direct, repeated testing against the live database during development — documented inline in this file, including two real bugs (deadlocks) that were found and fixed exactly this way — but there's no `npm test` a reviewer can run to reproduce that verification themselves. Given more time, the concurrency and idempotency scenarios in particular are exactly the kind of thing worth codifying as an integration test (spin up N concurrent requests against a test DB, assert on final balances) rather than relying on manual `curl` loops.
