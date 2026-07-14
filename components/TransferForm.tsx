"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch, ApiClientError } from "@/lib/api-client";
import { centsToDollarsString, dollarsToCents } from "@/lib/money";
import { AnimatedNumber } from "@/components/AnimatedNumber";
import { Spinner } from "@/components/Spinner";
import type { AccountSummary, TransactionSummary } from "@/lib/types";

interface TransferPayload {
  receiverAccountId: string;
  amountCents: number;
  description: string;
  idempotencyKey: string;
}

function newIdempotencyKey() {
  return crypto.randomUUID();
}

export function TransferForm() {
  const [accounts, setAccounts] = useState<AccountSummary[] | null>(null);
  const [recipientId, setRecipientId] = useState("");
  const [amountDollars, setAmountDollars] = useState("");
  const [description, setDescription] = useState("");
  const [idempotencyKey, setIdempotencyKey] = useState(newIdempotencyKey);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [result, setResult] = useState<{
    transaction: TransactionSummary;
    replayed: boolean;
  } | null>(null);
  const [lastPayload, setLastPayload] = useState<TransferPayload | null>(null);

  useEffect(() => {
    apiFetch<{ accounts: AccountSummary[] }>("/api/accounts")
      .then((res) => {
        setAccounts(res.accounts);
        if (res.accounts.length > 0) setRecipientId(res.accounts[0].id);
      })
      .catch((err) =>
        setError(
          err instanceof Error ? err.message : "Failed to load recipients",
        ),
      );
  }, []);

  async function submit(payload: TransferPayload) {
    setSubmitting(true);
    setError(null);
    setErrorCode(null);
    setResult(null);
    setLastPayload(payload);
    try {
      const res = await apiFetch<{
        transaction: TransactionSummary;
        replayed: boolean;
      }>("/api/transfers", {
        method: "POST",
        headers: { "Idempotency-Key": payload.idempotencyKey },
        body: JSON.stringify({
          receiverAccountId: payload.receiverAccountId,
          amountCents: payload.amountCents,
          description: payload.description,
        }),
      });
      setResult(res);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Transfer failed");
      setErrorCode(err instanceof ApiClientError ? (err.code ?? null) : null);
    } finally {
      setSubmitting(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const amount = Number(amountDollars);
    if (
      !recipientId ||
      !Number.isFinite(amount) ||
      amount <= 0 ||
      !description.trim()
    ) {
      setError("Fill in a recipient, a positive amount, and a description.");
      return;
    }
    submit({
      receiverAccountId: recipientId,
      amountCents: dollarsToCents(amount),
      description: description.trim(),
      idempotencyKey,
    });
  }

  function handleRetrySameRequest() {
    if (!lastPayload) return;
    submit(lastPayload);
  }

  function handleSendAgainPrefilled() {
    if (!lastPayload) return;
    setRecipientId(lastPayload.receiverAccountId);
    setAmountDollars(centsToDollarsString(lastPayload.amountCents));
    setDescription(lastPayload.description);
    setIdempotencyKey(newIdempotencyKey());
    setResult(null);
    setError(null);
    setErrorCode(null);
    setLastPayload(null);
  }

  function handleNewTransfer() {
    setResult(null);
    setError(null);
    setErrorCode(null);
    setLastPayload(null);
    setDescription("");
    setAmountDollars("");
    setIdempotencyKey(newIdempotencyKey());
  }

  const hasFailedAttempt = error !== null && lastPayload !== null;
  const isAuthError = errorCode === "UNAUTHORIZED";

  return (
    <div className="mx-auto max-w-md">
      <h1 className="text-2xl font-semibold tracking-tight">Send money</h1>

      {!result && !hasFailedAttempt && (
        <form
          onSubmit={handleSubmit}
          className="animate-fade-in-up mt-6 flex flex-col gap-4"
        >
          <div>
            <label className="block text-sm font-medium">Recipient</label>
            <select
              value={recipientId}
              onChange={(e) => setRecipientId(e.target.value)}
              className="mt-1 w-full rounded-md border border-black/10 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-zinc-950"
            >
              {accounts === null && <option>Loading…</option>}
              {accounts?.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.user.name} ({a.user.email})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium">Amount (USD)</label>
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={amountDollars}
              onChange={(e) => setAmountDollars(e.target.value)}
              placeholder="25.00"
              className="mt-1 w-full rounded-md border border-black/10 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-zinc-950"
            />
          </div>

          <div>
            <label className="block text-sm font-medium">Description</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Coffee, rent split, groceries…"
              maxLength={200}
              className="mt-1 w-full rounded-md border border-black/10 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-zinc-950"
            />
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              This is what the AI categorizer sees — try something like
              &ldquo;Uber ride&rdquo; or &ldquo;Whole Foods&rdquo;.
            </p>
          </div>

          <div className="rounded-md bg-zinc-100 px-3 py-2 text-xs text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
            Idempotency-Key: <span className="font-mono">{idempotencyKey}</span>
          </div>

          {error && (
            <p className="animate-fade-in-up rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting || accounts === null || accounts.length === 0}
            className="flex items-center justify-center gap-2 rounded-md border border-[#3cc4a9] bg-[#3cc4a9] px-4 py-2 text-sm font-medium text-black
             hover:bg-[#248673] hover:text-white hover:scale-[1.03]
             active:scale-[0.97] shadow-md hover:shadow-lg
             transition-all duration-150
             disabled:opacity-50 disabled:hover:scale-100 disabled:hover:bg-[#3cc4a9] disabled:hover:text-black disabled:hover:shadow-md"
          >
            {submitting && <Spinner />}
            {submitting ? "Sending…" : "Send"}
          </button>
        </form>
      )}

      {hasFailedAttempt && (
        <div className="animate-fade-in-up mt-6 rounded-xl border border-red-200 bg-red-50 p-5 dark:border-red-900 dark:bg-red-950">
          <div className="text-sm font-medium text-red-700 dark:text-red-300">
            Transfer failed
          </div>
          <p className="mt-1 text-sm text-red-700 dark:text-red-300">{error}</p>

          {isAuthError ? (
            <div className="mt-4">
              <Link
                href="/login"
                className="inline-block rounded-md bg-black px-4 py-2 text-sm font-medium text-white hover:scale-[1.02] hover:bg-zinc-800 active:scale-[0.97] dark:bg-white dark:text-black dark:hover:bg-zinc-200"
              >
                Log in
              </Link>
            </div>
          ) : (
            <>
              <p className="mt-3 text-xs text-red-700/70 dark:text-red-300/70">
                Idempotency-Key:{" "}
                <span className="font-mono">{lastPayload?.idempotencyKey}</span>
              </p>
              <div className="mt-4 flex gap-3">
                <button
                  onClick={handleRetrySameRequest}
                  disabled={submitting}
                  className="flex items-center gap-2 rounded-md border border-red-300 px-4 py-2 text-sm font-medium text-red-700 hover:scale-[1.02] hover:bg-red-100 active:scale-[0.97] disabled:opacity-50 disabled:hover:scale-100 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-900"
                >
                  {submitting && <Spinner />}
                  {submitting
                    ? "Retrying…"
                    : "Retry same request (should fail identically)"}
                </button>
                <button
                  onClick={handleNewTransfer}
                  className="rounded-md border border-black/10 px-4 py-2 text-sm font-medium hover:scale-[1.02] hover:bg-black/5 active:scale-[0.97] dark:border-white/10 dark:hover:bg-white/10"
                >
                  Try a different transfer
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {result && (
        <div className="animate-fade-in-up mt-6 rounded-xl border border-black/10 bg-white p-5 dark:border-white/10 dark:bg-zinc-950">
          <div className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
            {result.replayed
              ? "Duplicate request — original result returned"
              : "Transfer completed"}
          </div>
          <div className="mt-2 text-2xl font-semibold tabular-nums">
            <AnimatedNumber cents={result.transaction.amountCents} />
          </div>
          <dl className="mt-3 flex flex-col gap-1 text-sm text-zinc-500 dark:text-zinc-400">
            <div className="flex justify-between">
              <dt>Transaction ID</dt>
              <dd className="font-mono text-xs">{result.transaction.id}</dd>
            </div>
            <div className="flex justify-between">
              <dt>Status</dt>
              <dd>{result.transaction.status}</dd>
            </div>
            <div className="flex justify-between">
              <dt>Idempotency-Key used</dt>
              <dd className="font-mono text-xs">
                {result.transaction.idempotencyKey}
              </dd>
            </div>
          </dl>

          <div className="mt-5 flex flex-wrap gap-3">
            <button
              onClick={handleRetrySameRequest}
              disabled={submitting}
              className="flex items-center gap-2 rounded-md border border-black/10 px-4 py-2 text-sm font-medium hover:scale-[1.02] hover:bg-black/5 active:scale-[0.97] disabled:opacity-50 disabled:hover:scale-100 dark:border-white/10 dark:hover:bg-white/10"
            >
              {submitting && <Spinner />}
              {submitting
                ? "Retrying…"
                : "Retry same request (test idempotency)"}
            </button>
            <button
              onClick={handleSendAgainPrefilled}
              disabled={submitting}
              className="rounded-md border border-black/10 px-4 py-2 text-sm font-medium hover:scale-[1.02] hover:bg-black/5 active:scale-[0.97] disabled:opacity-50 disabled:hover:scale-100 dark:border-white/10 dark:hover:bg-white/10"
            >
              Send again
            </button>
            <button
              onClick={handleNewTransfer}
              className="rounded-md border border-[#3cc4a9] bg-[#3cc4a9] px-4 py-2 text-sm font-medium text-black
             hover:bg-[#248673] hover:text-white hover:scale-[1.02]
             active:scale-[0.97] shadow-md hover:shadow-lg
             transition-all duration-150"
            >
              New transfer
            </button>
          </div>

          {error && (
            <p className="animate-fade-in-up mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
              {error}
            </p>
          )}
        </div>
      )}

      <p className="mt-6 text-sm text-zinc-500 dark:text-zinc-400">
        <Link href="/" className="hover:underline">
          ← Back to dashboard
        </Link>
      </p>
    </div>
  );
}
