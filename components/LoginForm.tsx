"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { apiFetch, ApiClientError } from "@/lib/api-client";
import { PasswordInput } from "@/components/PasswordInput";
import { Spinner } from "@/components/Spinner";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const timedOut = searchParams.get("reason") === "timeout";

  const [mode, setMode] = useState<"login" | "signup">("login");
  const [error, setError] = useState<string | null>(null);

  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);

  const [signupName, setSignupName] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [signingUp, setSigningUp] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoggingIn(true);
    setError(null);
    try {
      await apiFetch("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email: loginEmail.trim(), password: loginPassword }),
      });
      router.push("/");
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Login failed");
      setLoggingIn(false);
    }
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setSigningUp(true);
    setError(null);
    try {
      await apiFetch("/api/auth/signup", {
        method: "POST",
        body: JSON.stringify({
          name: signupName.trim(),
          email: signupEmail.trim(),
          password: signupPassword,
        }),
      });
      router.push("/");
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Sign up failed");
      setSigningUp(false);
    }
  }

  return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-fade-in-up w-full max-w-md rounded-2xl border border-black/10 bg-white/90 p-8 shadow-xl backdrop-blur-sm dark:border-white/10 dark:bg-zinc-950/90">
          <div className="mb-6 flex flex-col items-center gap-2 text-center">
            <Image src="/ledger-logo.svg" alt="Ledger logo" width={44} height={44} />
            <span className="text-lg font-semibold tracking-tight">Ledger.ai</span>
          </div>

          <div className="flex gap-1 rounded-lg bg-zinc-100 p-1 text-sm dark:bg-zinc-900">
            <button
              onClick={() => {
                setMode("login");
                setError(null);
              }}
              className={`flex-1 rounded-md py-1.5 font-medium transition-all duration-200 ${
                mode === "login"
                  ? "bg-white shadow-sm dark:bg-zinc-800"
                  : "text-zinc-500 dark:text-zinc-400"
              }`}
            >
              Log in
            </button>
            <button
              onClick={() => {
                setMode("signup");
                setError(null);
              }}
              className={`flex-1 rounded-md py-1.5 font-medium transition-all duration-200 ${
                mode === "signup"
                  ? "bg-white shadow-sm dark:bg-zinc-800"
                  : "text-zinc-500 dark:text-zinc-400"
              }`}
            >
              Sign up
            </button>
          </div>

          {timedOut && (
            <p className="animate-fade-in-up mt-4 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950 dark:text-amber-300">
              You were logged out after 5 minutes of inactivity. Log in again to continue.
            </p>
          )}

          {mode === "login" ? (
            <div className="animate-fade-in-up">
              <h1 className="mt-6 text-2xl font-semibold tracking-tight">Log in</h1>
              <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
                Sessions time out after 5 minutes of inactivity, same as a real banking app — see
                DECISIONS.md. Demo credentials are in README.md.
              </p>

              <form onSubmit={handleLogin} className="mt-6 flex flex-col gap-4">
                <div>
                  <label className="block text-sm font-medium">Email</label>
                  <input
                    type="email"
                    required
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    placeholder="alice@example.com"
                    className="mt-1 w-full rounded-md border border-black/10 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-zinc-950"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium">Password</label>
                  <PasswordInput
                    required
                    value={loginPassword}
                    onChange={setLoginPassword}
                    className="mt-1 w-full rounded-md border border-black/10 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-zinc-950"
                  />
                </div>

                {error && (
                  <p className="animate-fade-in-up rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={loggingIn}
                  className="flex items-center justify-center gap-2 rounded-md bg-black px-4 py-2 text-sm font-medium text-white hover:scale-[1.01] hover:bg-zinc-800 active:scale-[0.98] disabled:opacity-50 disabled:hover:scale-100 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
                >
                  {loggingIn && <Spinner />}
                  {loggingIn ? "Logging in…" : "Log in"}
                </button>
              </form>
            </div>
          ) : (
            <div className="animate-fade-in-up">
              <h1 className="mt-6 text-2xl font-semibold tracking-tight">Sign up</h1>
              <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
                Creates a brand-new account starting at $0.00 — send yourself some money from a
                demo user afterward, or ask a friend who signed up too.
              </p>

              <form onSubmit={handleSignup} className="mt-6 flex flex-col gap-4">
                <div>
                  <label className="block text-sm font-medium">Name</label>
                  <input
                    type="text"
                    required
                    value={signupName}
                    onChange={(e) => setSignupName(e.target.value)}
                    placeholder="Jordan Lee"
                    className="mt-1 w-full rounded-md border border-black/10 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-zinc-950"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium">Email</label>
                  <input
                    type="email"
                    required
                    value={signupEmail}
                    onChange={(e) => setSignupEmail(e.target.value)}
                    placeholder="jordan@example.com"
                    className="mt-1 w-full rounded-md border border-black/10 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-zinc-950"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium">Password</label>
                  <PasswordInput
                    required
                    minLength={8}
                    value={signupPassword}
                    onChange={setSignupPassword}
                    placeholder="At least 8 characters"
                    className="mt-1 w-full rounded-md border border-black/10 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-zinc-950"
                  />
                </div>

                {error && (
                  <p className="animate-fade-in-up rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={signingUp}
                  className="flex items-center justify-center gap-2 rounded-md bg-black px-4 py-2 text-sm font-medium text-white hover:scale-[1.01] hover:bg-zinc-800 active:scale-[0.98] disabled:opacity-50 disabled:hover:scale-100 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
                >
                  {signingUp && <Spinner />}
                  {signingUp ? "Creating account…" : "Create account"}
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
  );
}
