"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { ArrowLeft, Mail, ArrowRight } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = email.trim().toLowerCase();

    if (!trimmed || !trimmed.includes("@") || !trimmed.includes(".")) {
      setError("Please enter a valid email address.");
      return;
    }

    setError("");
    setBusy(true);

    // Smooth UI transition redirect to OTP page
    setTimeout(() => {
      router.push(`/auth/forgot-password/otp?email=${encodeURIComponent(trimmed)}`);
    }, 350);
  }

  return (
    <div className="min-h-screen min-h-[100dvh] bg-[#F7F6F5] dark:bg-[#1E2021] text-[#1A1A1A] dark:text-[#F3F4F6] flex flex-col justify-between selection:bg-neutral-300 dark:selection:bg-neutral-700 selection:text-neutral-900 dark:selection:text-white font-sans w-full max-w-full overflow-x-hidden">
      {/* Top Navigation Bar */}
      <header className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-6 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 group outline-none">
          <span className="font-display text-2xl font-bold tracking-tight text-[#1E2021] dark:text-white group-hover:text-neutral-600 dark:group-hover:text-neutral-300 transition-colors">
            OrderFit
          </span>
        </Link>

        <div className="flex items-center gap-4 sm:gap-6 text-sm text-[#737373] dark:text-neutral-400 font-medium">
          <ThemeToggle variant="pill" />
          <Link href="/auth/signin" className="hover:text-[#1E2021] dark:hover:text-white transition-colors outline-none">
            Log In
          </Link>
          <Link href="/auth/signup" className="hover:text-[#1E2021] dark:hover:text-white transition-colors outline-none">
            Sign Up
          </Link>
        </div>
      </header>

      {/* Main Centered Reset Card */}
      <main className="flex-1 flex items-center justify-center px-4 py-6 sm:py-10 w-full max-w-full">
        <div className="w-full max-w-[440px] bg-white dark:bg-[#181A1B] border border-[#E8E6E1] dark:border-[#2A2C2D] rounded-2xl p-5 sm:p-8 md:p-10 shadow-xs dark:shadow-none">
          {/* Top Icon Badge */}
          <div className="mx-auto w-12 h-12 rounded-2xl bg-[#FAF9F7] dark:bg-[#222425] border border-[#E8E6E1] dark:border-[#2A2C2D] flex items-center justify-center text-[#1E2021] dark:text-white mb-5 shadow-xs">
            <Mail className="size-5 text-[#004D3B] dark:text-[#B5F2C6]" />
          </div>

          {/* Heading */}
          <h1 className="text-xl sm:text-2xl font-bold text-center text-[#1E2021] dark:text-white mb-2 font-display tracking-tight">
            Forgot Password
          </h1>
          <p className="text-center text-xs sm:text-sm text-[#737373] dark:text-neutral-400 leading-relaxed mb-6">
            Enter the email associated with your account and we&apos;ll send you a 6-digit verification code.
          </p>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <p role="alert" className="rounded-lg bg-red-50 dark:bg-red-950 p-3 text-xs sm:text-sm text-red-800 dark:text-red-100 border border-red-200 dark:border-red-800">
                {error}
              </p>
            )}

            {/* Email Field */}
            <div>
              <label htmlFor="email" className="block text-xs font-medium text-[#1E2021] dark:text-neutral-300 mb-1.5">
                Work Email
              </label>
              <div className="relative">
                <input
                  type="email"
                  id="email"
                  required
                  autoFocus
                  autoComplete="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (error) setError("");
                  }}
                  placeholder="name@company.com"
                  className="w-full px-4 py-3 bg-[#FAF9F7] dark:bg-[#222425] border border-[#E8E6E1] dark:border-[#2A2C2D] rounded-xl text-base sm:text-sm text-[#1E2021] dark:text-white placeholder-[#A3A3A3] dark:placeholder-neutral-400 outline-none focus:outline-none focus:border-[#1E2021] dark:focus:border-neutral-500 transition-colors"
                />
              </div>
            </div>

            {/* Action Buttons */}
            <div className="pt-2 space-y-3">
              <button
                type="submit"
                disabled={busy}
                className="w-full py-3 px-4 rounded-xl bg-[#1E2021] hover:bg-black text-white dark:bg-white dark:hover:bg-neutral-200 dark:text-neutral-900 font-semibold text-sm transition-colors border-0 disabled:opacity-70 cursor-pointer outline-none focus:outline-none flex items-center justify-center gap-2"
              >
                {busy ? (
                  <span>Sending code…</span>
                ) : (
                  <>
                    <span>Send Verification Code</span>
                    <ArrowRight className="size-4" />
                  </>
                )}
              </button>

              <Link
                href="/auth/signin"
                className="w-full py-2.5 px-4 rounded-xl bg-transparent hover:bg-[#FAF9F7] dark:hover:bg-[#222425] text-xs sm:text-sm font-medium text-[#737373] dark:text-neutral-400 hover:text-[#1E2021] dark:hover:text-white transition-colors flex items-center justify-center gap-2 outline-none"
              >
                <ArrowLeft className="size-3.5" />
                <span>Back to Log In</span>
              </Link>
            </div>
          </form>

          {/* Footer Security Notice */}
          <div className="pt-6 mt-6 border-t border-[#E8E6E1] dark:border-[#2A2C2D] text-center text-[11px] text-[#737373] dark:text-neutral-400 leading-relaxed">
            OrderFit verification codes expire after 10 minutes. Only authorized account emails will receive recovery tokens.
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-4 text-center text-xs text-[#737373] dark:text-neutral-400">
        &copy; {new Date().getFullYear()} OrderFit Inc. All rights reserved.
      </footer>
    </div>
  );
}
