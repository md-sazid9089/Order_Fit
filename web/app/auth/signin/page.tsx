"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Eye, EyeOff } from "lucide-react";
import { ApiError, mutate } from "@/lib/orderfit-api";
import { safeNext, signInNotice } from "@/lib/session-expiry";
import { resetSessionState } from "@/lib/session-reset";

export default function SignInPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const text = signInNotice(new URLSearchParams(window.location.search).get("reason"));
    if (text) queueMicrotask(() => setNotice(text));
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      await mutate("/auth/signin", "POST", { email: email.trim().toLowerCase(), password });
      // A new sign-in must never see cache or pending commands from a previous account.
      resetSessionState(queryClient);
      router.replace(safeNext(new URLSearchParams(window.location.search).get("next")) ?? "/deals");
    } catch (cause) {
      if (cause instanceof ApiError && (cause.code === "INVALID_CREDENTIALS" || cause.status === 401)) {
        setError("Invalid email or password.");
      } else {
        setError(cause instanceof Error ? cause.message : "Sign in failed.");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#1E2021] text-[#F3F4F6] flex flex-col justify-between selection:bg-neutral-700 selection:text-white font-sans">
      {/* Top Navigation Bar */}
      <header className="w-full max-w-7xl mx-auto px-6 py-6 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 group outline-none">
          <span className="font-display text-2xl font-bold tracking-tight text-white group-hover:text-neutral-300 transition-colors">
            OrderFit
          </span>
        </Link>

        <div className="flex items-center gap-6 text-sm text-neutral-400 font-medium">
          <Link href="/#products" className="hover:text-white transition-colors outline-none">
            About
          </Link>
          <Link href="/auth/signup" className="hover:text-white transition-colors outline-none">
            Sign Up
          </Link>
        </div>
      </header>

      {/* Main Centered Signin Card - Flat, simple, borderless, zero shadows */}
      <main className="flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-[440px] bg-[#181A1B] rounded-2xl p-8 sm:p-10 border-0 shadow-none">
          {/* Card Title */}
          <h1 className="text-2xl font-bold text-center text-white mb-6 font-display tracking-tight">
            Log In
          </h1>

          {/* Form */}
          <form onSubmit={submit} className="space-y-4 [&_:focus-visible]:outline-2! [&_:focus-visible]:outline-offset-2 [&_:focus-visible]:outline-white">
            {notice && (
              <p role="status" className="rounded-lg bg-emerald-950 p-3 text-sm text-emerald-100">
                {notice}
              </p>
            )}
            {error && (
              <p role="alert" className="rounded-lg bg-red-950 p-3 text-sm text-red-100">
                {error}
              </p>
            )}

            {/* Email Field */}
            <div>
              <label htmlFor="email" className="sr-only">Email</label>
              <input
                type="email"
                id="email"
                required
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email*"
                className="w-full px-4 py-3 bg-[#222425] border-0 rounded-xl text-sm text-white placeholder-neutral-500 outline-none focus:outline-none ring-0 focus:ring-0 transition-colors"
              />
            </div>

            {/* Password Field */}
            <div>
              <label htmlFor="password" className="sr-only">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  id="password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password*"
                  className="w-full px-4 py-3 bg-[#222425] border-0 rounded-xl text-sm text-white placeholder-neutral-500 outline-none focus:outline-none ring-0 focus:ring-0 transition-colors pr-11"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-white transition-colors p-1 border-0 outline-none focus:outline-none"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>

            {/* Buttons Row - Clean, simple, no outlines, no shadows */}
            <div className="pt-2 flex items-center gap-3">
              <Link
                href="/auth/signup"
                className="flex-1 text-center py-3 px-4 rounded-xl bg-[#232423] hover:bg-[#2B2D2C] border-0 text-sm font-medium text-white transition-colors outline-none focus:outline-none"
              >
                Sign up
              </Link>
              <button
                type="submit"
                disabled={busy}
                className="flex-1 py-3 px-4 rounded-xl bg-white hover:bg-neutral-200 text-neutral-900 font-semibold text-sm transition-colors border-0 active:scale-[0.98] disabled:opacity-70 cursor-pointer outline-none focus:outline-none"
              >
                {busy ? "Signing in…" : "Log in"}
              </button>
            </div>

            {/* Disclaimer */}
            <div className="pt-2 text-center text-[11px] text-neutral-500 leading-relaxed">
              Your account uses a password session. Financial assessments use reviewed manual inputs; outgoing actions are sandbox-only.
            </div>
          </form>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full py-6 text-center text-xs text-neutral-500">
        <div className="flex items-center justify-center gap-4">
          <span>OrderFit © 2026</span>
        </div>
      </footer>
    </div>
  );
}
