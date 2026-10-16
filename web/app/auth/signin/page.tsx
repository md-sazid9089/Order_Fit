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
    <div className="min-h-screen bg-[#F7F6F5] text-[#1A1A1A] flex flex-col justify-between selection:bg-[#B5F2C6] selection:text-[#004D3B] font-sans">
      {/* Top Navigation Bar */}
      <header className="w-full max-w-7xl mx-auto px-6 py-6 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 group outline-none">
          <span className="font-heading text-2xl font-bold tracking-tight text-[#1A1A1A] group-hover:text-[#093A2F] transition-colors">
            OrderFit
          </span>
        </Link>

        <div className="flex items-center gap-6 text-sm text-[#526975] font-medium font-sans">
          <Link href="/#products" className="hover:text-[#1A1A1A] transition-colors outline-none">
            About
          </Link>
          <Link href="/auth/signup" className="hover:text-[#1A1A1A] transition-colors outline-none">
            Sign Up
          </Link>
        </div>
      </header>

      {/* Main Centered Signin Card */}
      <main className="flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-[440px] bg-white rounded-3xl p-8 sm:p-10 border border-[#ECEAE4] shadow-xs">
          {/* Card Title */}
          <h1 className="font-heading text-2xl font-semibold text-center text-[#1A1A1A] mb-6 tracking-tight">
            Log In
          </h1>

          {/* Form */}
          <form onSubmit={submit} className="space-y-4 [&_:focus-visible]:outline-2! [&_:focus-visible]:outline-offset-2 [&_:focus-visible]:outline-white">
            {notice && (
              <p role="status" className="rounded-xl bg-[#EAF7EE] border border-[#B5F2C6] p-3 text-sm text-[#004D3B] font-sans">
                {notice}
              </p>
            )}
            {error && (
              <p role="alert" className="rounded-xl bg-rose-50 border border-rose-200 p-3 text-sm text-rose-800 font-sans">
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
                className="w-full px-4 py-3 bg-[#FAF9F7] border border-[#ECEAE4] rounded-xl text-sm text-[#1A1A1A] placeholder:text-[#8E8B82] outline-none focus:outline-none focus:border-[#1E2021] focus:ring-1 focus:ring-[#1E2021] transition-colors font-sans"
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
                  className="w-full px-4 py-3 bg-[#FAF9F7] border border-[#ECEAE4] rounded-xl text-sm text-[#1A1A1A] placeholder:text-[#8E8B82] outline-none focus:outline-none focus:border-[#1E2021] focus:ring-1 focus:ring-[#1E2021] transition-colors pr-11 font-sans"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#8E8B82] hover:text-[#1A1A1A] transition-colors p-1 border-0 outline-none focus:outline-none"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>

            {/* Buttons Row */}
            <div className="pt-2 flex items-center gap-3">
              <Link
                href="/auth/signup"
                className="flex-1 text-center py-3 px-4 rounded-xl bg-[#FAF9F7] hover:bg-[#F2EFE9] border border-[#ECEAE4] text-sm font-medium text-[#1A1A1A] transition-colors outline-none font-sans"
              >
                Sign up
              </Link>
              <button
                type="submit"
                disabled={busy}
                className="flex-1 py-3 px-4 rounded-xl bg-[#1E2021] hover:bg-black text-white font-semibold text-sm transition-colors border-0 active:scale-[0.98] disabled:opacity-70 cursor-pointer shadow-xs outline-none font-sans"
              >
                {busy ? "Signing in…" : "Log in"}
              </button>
            </div>

            {/* Disclaimer */}
            <div className="pt-2 text-center text-[11px] text-[#737373] leading-relaxed font-sans">
              Your account uses a password session. Financial assessments use reviewed manual inputs; outgoing actions are sandbox-only.
            </div>
          </form>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full py-6 text-center text-xs text-[#737373] font-sans">
        <div className="flex items-center justify-center gap-4">
          <span>OrderFit © 2026</span>
        </div>
      </footer>
    </div>
  );
}
