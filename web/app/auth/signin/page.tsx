"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Eye, EyeOff } from "lucide-react";
import { ApiError, mutate, type Session } from "@/lib/orderfit-api";
import { safeNext, signInNotice } from "@/lib/session-expiry";
import { resetSessionState } from "@/lib/session-reset";
import { setCachedSession } from "@/lib/session-store";
import { signInWithPasskey } from "@/lib/passkeys";
import { ThemeToggle } from "@/components/theme-toggle";

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
      resetSessionState(queryClient);
      const normalizedEmail = email.trim().toLowerCase();
      let session: Session;
      try {
        session = await mutate<Session>("/auth/signin", "POST", { email: normalizedEmail, password });
      } catch (cause) {
        if (!(cause instanceof ApiError) || cause.code !== "MFA_REQUIRED") throw cause;
        session = await signInWithPasskey(normalizedEmail, password);
      }
      setCachedSession(session);
      router.replace(safeNext(new URLSearchParams(window.location.search).get("next")) ?? "/overview");
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
    <div className="min-h-screen min-h-[100dvh] bg-[#F7F6F5] dark:bg-[#1E2021] text-[#1A1A1A] dark:text-[#F3F4F6] flex flex-col justify-between selection:bg-neutral-300 dark:selection:bg-neutral-700 selection:text-neutral-900 dark:selection:text-white font-sans w-full max-w-full overflow-x-hidden">
      {/* Top Navigation Bar */}
      <header className="w-full max-w-[1560px] mx-auto px-4 sm:px-6 py-4 sm:py-6 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 group outline-none">
          <span className="font-display text-2xl font-bold tracking-tight text-[#1E2021] dark:text-white group-hover:text-neutral-600 dark:group-hover:text-neutral-300 transition-colors">
            OrderFit
          </span>
        </Link>

        <div className="flex items-center gap-4 sm:gap-6 text-sm text-[#737373] dark:text-neutral-400 font-medium">
          <ThemeToggle variant="pill" />
          <Link href="/#products" className="hover:text-[#1E2021] dark:hover:text-white transition-colors outline-none">
            About
          </Link>
          <Link href="/auth/signup" className="hover:text-[#1E2021] dark:hover:text-white transition-colors outline-none">
            Sign Up
          </Link>
        </div>
      </header>

      {/* Main Centered Signin Card - Stable, non-shifting, touch-optimized */}
      <main className="flex-1 flex items-center justify-center px-4 py-4 sm:py-8 w-full max-w-full">
        <div className="w-full max-w-[440px] bg-white dark:bg-[#181A1B] border border-[#E8E6E1] dark:border-[#2A2C2D] rounded-2xl p-5 sm:p-8 md:p-10 shadow-xs dark:shadow-none">
          {/* Card Title */}
          <h1 className="text-xl sm:text-2xl font-bold text-center text-[#1E2021] dark:text-white mb-5 sm:mb-6 font-display tracking-tight">
            Log In
          </h1>

          {/* Form */}
          <form onSubmit={submit} className="space-y-4">
            {notice && (
              <p role="status" className="rounded-lg bg-emerald-50 dark:bg-emerald-950 p-3 text-sm text-emerald-800 dark:text-emerald-100 border border-emerald-200 dark:border-emerald-800">
                {notice}
              </p>
            )}
            {error && (
              <p role="alert" className="rounded-lg bg-red-50 dark:bg-red-950 p-3 text-sm text-red-800 dark:text-red-100 border border-red-200 dark:border-red-800">
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
                className="w-full px-4 py-3 bg-[#FAF9F7] dark:bg-[#222425] border border-[#E8E6E1] dark:border-[#2A2C2D] rounded-xl text-base sm:text-sm text-[#1E2021] dark:text-white placeholder-[#A3A3A3] dark:placeholder-neutral-400 outline-none focus:outline-none focus:border-[#1E2021] dark:focus:border-neutral-500 transition-colors"
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
                  className="w-full px-4 py-3 bg-[#FAF9F7] dark:bg-[#222425] border border-[#E8E6E1] dark:border-[#2A2C2D] rounded-xl text-base sm:text-sm text-[#1E2021] dark:text-white placeholder-[#A3A3A3] dark:placeholder-neutral-400 outline-none focus:outline-none focus:border-[#1E2021] dark:focus:border-neutral-500 transition-colors pr-11"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#737373] dark:text-neutral-500 hover:text-[#1E2021] dark:hover:text-white transition-colors p-1 border-0 outline-none focus:outline-none cursor-pointer"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
              <div className="flex justify-end pt-1.5">
                <Link
                  href="/auth/forgot-password"
                  className="text-xs text-[#737373] dark:text-neutral-400 hover:text-[#1E2021] dark:hover:text-white transition-colors outline-none"
                >
                  Forgot password?
                </Link>
              </div>
            </div>

            {/* Buttons Row - Clean, simple, high-contrast in both modes */}
            <div className="pt-2 flex items-center gap-3">
              <Link
                href="/auth/signup"
                className="flex-1 text-center py-3 px-4 rounded-xl bg-[#FAF9F7] dark:bg-[#232423] hover:bg-[#F4F2ED] dark:hover:bg-[#2B2D2C] border border-[#E8E6E1] dark:border-0 text-sm font-medium text-[#1E2021] dark:text-white transition-colors outline-none focus:outline-none"
              >
                Sign up
              </Link>
              <button
                type="submit"
                disabled={busy}
                className="flex-1 py-3 px-4 rounded-xl bg-[#1E2021] hover:bg-black text-white dark:bg-white dark:hover:bg-neutral-200 dark:text-neutral-900 font-semibold text-sm transition-colors border-0 disabled:opacity-70 cursor-pointer outline-none focus:outline-none"
              >
                {busy ? "Signing in…" : "Log in"}
              </button>
            </div>

            {/* Disclaimer */}
            <div className="pt-2 text-center text-[11px] text-[#737373] dark:text-neutral-400 leading-relaxed">
              Your account uses a password session. Financial assessments use reviewed manual inputs; outgoing actions are sandbox-only.
            </div>
          </form>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full py-4 sm:py-6 text-center text-xs text-[#737373] dark:text-neutral-400">
        <div className="flex items-center justify-center gap-4">
          <span>OrderFit © 2026</span>
        </div>
      </footer>
    </div>
  );
}
