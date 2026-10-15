"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Eye, EyeOff } from "lucide-react";

export default function SignUpPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [fullName, setFullName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    // Simulating signup
    setTimeout(() => {
      setIsLoading(false);
      window.location.href = "/deals";
    }, 800);
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

          {/* Google SSO Button */}
          <button
            type="button"
            className="w-full flex items-center justify-center gap-3 py-3 px-4 rounded-xl bg-[#222425] hover:bg-[#2A2C2D] border-0 text-sm font-medium text-white transition-colors cursor-pointer outline-none focus:outline-none"
          >
            {/* Official Google Icon */}
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            <span>Sign up with Google</span>
          </button>

          {/* OR Divider */}
          <div className="relative my-6 text-center">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-[#2A2C2D]" />
            </div>
            <span className="relative px-3 bg-[#181A1B] text-xs font-semibold uppercase tracking-wider text-neutral-500">
              OR
            </span>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
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
                  placeholder="Password (min. 8 characters)*"
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
              By creating an account, you agree to the deterministic evaluation rules and data protection policy.
            </div>
          </form>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full py-6 text-center text-xs text-neutral-500">
        <div className="flex items-center justify-center gap-4">
          <span>OrderFit © 2026</span>
          <span>·</span>
          <a href="#terms" className="hover:text-neutral-300 transition-colors outline-none">
            Terms of Service
          </a>
          <span>·</span>
          <a href="#privacy" className="hover:text-neutral-300 transition-colors outline-none">
            Privacy
          </a>
        </div>
      </footer>
    </div>
  );
}
