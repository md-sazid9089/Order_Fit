"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { mutate } from "@/lib/orderfit-api";
import { Eye, EyeOff } from "lucide-react";

export default function SignUpPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [currency, setCurrency] = useState("BDT");
  const [timezone, setTimezone] = useState("Asia/Dhaka");
  const [showPassword, setShowPassword] = useState(false);
  const [fullName, setFullName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setIsLoading(true); setError("");
    try { await mutate("/auth/signup", "POST", { full_name: fullName, business_name: businessName, email, password, currency, timezone }); router.replace("/deals"); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not create the account."); }
    finally { setIsLoading(false); }
  };

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
          <Link href="/auth/signin" className="hover:text-white transition-colors outline-none">
            Log In
          </Link>
        </div>
      </header>

      {/* Main Centered Signup Card - Flat, simple, borderless, zero shadows */}
      <main className="flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-[440px] bg-[#181A1B] rounded-2xl p-8 sm:p-10 border-0 shadow-none">
          {/* Card Title */}
          <h1 className="text-2xl font-bold text-center text-white mb-6 font-display tracking-tight">
            Create Account
          </h1>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && <p role="alert" className="rounded-lg bg-red-950 p-3 text-sm text-red-100">{error}</p>}
            <label className="block text-sm">Business currency<select className="mt-1 w-full rounded-xl bg-[#222425] p-3" value={currency} onChange={e => setCurrency(e.target.value)}>{["BDT", "USD", "EUR", "GBP"].map(c => <option key={c}>{c}</option>)}</select></label>
            <label className="block text-sm">Business timezone<input required className="mt-1 w-full rounded-xl bg-[#222425] p-3" value={timezone} onChange={e => setTimezone(e.target.value)} /></label>
            {/* Full Name Field */}
            <div>
              <input
                type="text"
                id="fullName"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Full Name*"
                className="w-full px-4 py-3 bg-[#222425] border-0 rounded-xl text-sm text-white placeholder-neutral-500 outline-none focus:outline-none ring-0 focus:ring-0 transition-colors"
              />
            </div>

            {/* Company / Business Name */}
            <div>
              <input
                type="text"
                id="businessName"
                required
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                placeholder="Business / Company Name*"
                className="w-full px-4 py-3 bg-[#222425] border-0 rounded-xl text-sm text-white placeholder-neutral-500 outline-none focus:outline-none ring-0 focus:ring-0 transition-colors"
              />
            </div>

            {/* Email Field */}
            <div>
              <input
                type="email"
                id="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email*"
                className="w-full px-4 py-3 bg-[#222425] border-0 rounded-xl text-sm text-white placeholder-neutral-500 outline-none focus:outline-none ring-0 focus:ring-0 transition-colors"
              />
            </div>

            {/* Password Field */}
            <div>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  id="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={12}
                  autoComplete="new-password"
                  placeholder="Password (min. 12 characters)*"
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
                href="/auth/signin"
                className="flex-1 text-center py-3 px-4 rounded-xl bg-[#232423] hover:bg-[#2B2D2C] border-0 text-sm font-medium text-white transition-colors outline-none focus:outline-none"
              >
                Log in
              </Link>
              <button
                type="submit"
                disabled={isLoading}
                className="flex-1 py-3 px-4 rounded-xl bg-white hover:bg-neutral-200 text-neutral-900 font-semibold text-sm transition-colors border-0 active:scale-[0.98] disabled:opacity-70 cursor-pointer outline-none focus:outline-none"
              >
                {isLoading ? "Creating..." : "Create account"}
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
