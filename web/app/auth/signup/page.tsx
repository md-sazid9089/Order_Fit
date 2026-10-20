"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { ApiError, mutate, type Session } from "@/lib/orderfit-api";
import { resetSessionState } from "@/lib/session-reset";
import { setCachedSession } from "@/lib/session-store";
import { Eye, EyeOff } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { toast } from "@/lib/toast";

const COMMON_TIMEZONES = [
  "Asia/Dhaka",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Asia/Dubai",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Asia/Kolkata",
  "Australia/Sydney",
  "UTC",
];

export default function SignUpPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [error, setError] = useState("");
  const [currency, setCurrency] = useState("BDT");
  const [timezone, setTimezone] = useState(() => {
    if (typeof window !== "undefined") {
      try {
        return Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Dhaka";
      } catch {
        return "Asia/Dhaka";
      }
    }
    return "Asia/Dhaka";
  });
  const [showPassword, setShowPassword] = useState(false);
  const [fullName, setFullName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const timezoneList = useMemo(() => {
    if (timezone && !COMMON_TIMEZONES.includes(timezone)) {
      return [timezone, ...COMMON_TIMEZONES];
    }
    return COMMON_TIMEZONES;
  }, [timezone]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password.length < 12) {
      setError("Password must be at least 12 characters.");
      return;
    }

    setIsLoading(true);
    try {
      resetSessionState(queryClient);
      const session = await mutate<Session>("/auth/signup", "POST", {
        email: email.trim().toLowerCase(),
        password,
        full_name: fullName.trim(),
        business_name: businessName.trim(),
        currency,
        timezone,
      });
      setCachedSession(session);
      toast.success("Account created successfully.");
      const businessId = session.memberships?.[0]?.business_id;
      const target = businessId
        ? `/overview?businessId=${businessId}&onboarding=start`
        : "/overview?onboarding=start";
      router.replace(target);
    } catch (cause) {
      const msg = cause instanceof ApiError || cause instanceof Error ? cause.message : "Sign up failed.";
      setError(msg);
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  };

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
          <Link href="/auth/signin" className="hover:text-[#1E2021] dark:hover:text-white transition-colors outline-none">
            Log In
          </Link>
        </div>
      </header>

      {/* Main Centered Signup Card */}
      <main className="flex-1 flex items-center justify-center px-4 py-4 sm:py-8 w-full max-w-full">
        <div className="w-full max-w-[440px] bg-white dark:bg-[#181A1B] border border-[#E8E6E1] dark:border-[#2A2C2D] rounded-2xl p-5 sm:p-8 md:p-10 shadow-xs dark:shadow-none">
          {(
            <>
              {/* Card Title */}
              <h1 className="text-xl sm:text-2xl font-bold text-center text-[#1E2021] dark:text-white mb-5 sm:mb-6 font-display tracking-tight">
                Create Account
              </h1>

              {/* Form */}
              <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                  <p role="alert" className="rounded-lg bg-red-50 dark:bg-red-950 p-3 text-sm text-red-800 dark:text-red-100 border border-red-200 dark:border-red-800">
                    {error}
                  </p>
                )}

                {/* Full Name Field */}
                <div>
                  <label htmlFor="fullName" className="sr-only">Full name</label>
                  <input
                    type="text"
                    id="fullName"
                    name="fullName"
                    required
                    autoComplete="name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Full Name*"
                    className="w-full px-4 py-3 bg-[#FAF9F7] dark:bg-[#222425] border border-[#E8E6E1] dark:border-[#2A2C2D] rounded-xl text-base sm:text-sm text-[#1E2021] dark:text-white placeholder-[#6B6B6B] dark:placeholder-neutral-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1E2021] dark:focus-visible:outline-white focus:border-[#1E2021] dark:focus:border-neutral-500 transition-colors"
                  />
                </div>

                {/* Company / Business Name */}
                <div>
                  <label htmlFor="businessName" className="sr-only">Business / Company name</label>
                  <input
                    type="text"
                    id="businessName"
                    name="businessName"
                    required
                    autoComplete="organization"
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    placeholder="Business / Company Name*"
                    className="w-full px-4 py-3 bg-[#FAF9F7] dark:bg-[#222425] border border-[#E8E6E1] dark:border-[#2A2C2D] rounded-xl text-base sm:text-sm text-[#1E2021] dark:text-white placeholder-[#6B6B6B] dark:placeholder-neutral-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1E2021] dark:focus-visible:outline-white focus:border-[#1E2021] dark:focus:border-neutral-500 transition-colors"
                  />
                </div>

                {/* Email Field */}
                <div>
                  <label htmlFor="email" className="sr-only">Email</label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Email*"
                    className="w-full px-4 py-3 bg-[#FAF9F7] dark:bg-[#222425] border border-[#E8E6E1] dark:border-[#2A2C2D] rounded-xl text-base sm:text-sm text-[#1E2021] dark:text-white placeholder-[#6B6B6B] dark:placeholder-neutral-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1E2021] dark:focus-visible:outline-white focus:border-[#1E2021] dark:focus:border-neutral-500 transition-colors"
                  />
                </div>

                {/* Password Field */}
                <div>
                  <label htmlFor="password" className="sr-only">Password (min. 12 characters)</label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      id="password"
                      name="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      minLength={12}
                      autoComplete="new-password"
                      placeholder="Password (min. 12 characters)*"
                      className="w-full px-4 py-3 bg-[#FAF9F7] dark:bg-[#222425] border border-[#E8E6E1] dark:border-[#2A2C2D] rounded-xl text-base sm:text-sm text-[#1E2021] dark:text-white placeholder-[#6B6B6B] dark:placeholder-neutral-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1E2021] dark:focus-visible:outline-white focus:border-[#1E2021] dark:focus:border-neutral-500 transition-colors pr-11"
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
                </div>

                {/* Currency and Timezone Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div className="min-w-0">
                    <label htmlFor="currency" className="block text-xs font-medium text-[#737373] dark:text-neutral-400 mb-1.5">
                      Business currency
                    </label>
                    <select
                      id="currency"
                      value={currency}
                      onChange={(e) => setCurrency(e.target.value)}
                      className="w-full min-w-0 max-w-full px-3 py-2.5 bg-[#FAF9F7] dark:bg-[#222425] border border-[#E8E6E1] dark:border-[#2A2C2D] rounded-xl text-base sm:text-sm text-[#1E2021] dark:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1E2021] dark:focus-visible:outline-white focus:border-[#1E2021] dark:focus:border-neutral-500 transition-colors cursor-pointer"
                    >
                      <option value="BDT" className="bg-white dark:bg-[#222425] text-[#1E2021] dark:text-white">BDT (৳)</option>
                      <option value="USD" className="bg-white dark:bg-[#222425] text-[#1E2021] dark:text-white">USD ($)</option>
                      <option value="EUR" className="bg-white dark:bg-[#222425] text-[#1E2021] dark:text-white">EUR (€)</option>
                      <option value="GBP" className="bg-white dark:bg-[#222425] text-[#1E2021] dark:text-white">GBP (£)</option>
                    </select>
                  </div>

                  <div className="min-w-0">
                    <label htmlFor="timezone" className="block text-xs font-medium text-[#737373] dark:text-neutral-400 mb-1.5">
                      Business timezone
                    </label>
                    <select
                      id="timezone"
                      value={timezone}
                      onChange={(e) => setTimezone(e.target.value)}
                      className="w-full min-w-0 max-w-full truncate px-3 py-2.5 bg-[#FAF9F7] dark:bg-[#222425] border border-[#E8E6E1] dark:border-[#2A2C2D] rounded-xl text-base sm:text-sm text-[#1E2021] dark:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1E2021] dark:focus-visible:outline-white focus:border-[#1E2021] dark:focus:border-neutral-500 transition-colors cursor-pointer"
                    >
                      {timezoneList.map((tz) => (
                        <option key={tz} value={tz} className="bg-white dark:bg-[#222425] text-[#1E2021] dark:text-white">
                          {tz}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Buttons Row - Clean, simple, high-contrast in both modes */}
                <div className="pt-2 flex items-center gap-3">
                  <Link
                    href="/auth/signin"
                    className="flex-1 text-center py-3 px-4 rounded-xl bg-[#FAF9F7] dark:bg-[#232423] hover:bg-[#F4F2ED] dark:hover:bg-[#2B2D2C] border border-[#E8E6E1] dark:border-0 text-sm font-medium text-[#1E2021] dark:text-white transition-colors outline-none focus:outline-none"
                  >
                    Log in
                  </Link>
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="flex-1 py-3 px-4 rounded-xl bg-[#1E2021] hover:bg-black text-white dark:bg-white dark:hover:bg-neutral-200 dark:text-neutral-900 font-semibold text-sm transition-colors border-0 disabled:opacity-70 cursor-pointer outline-none focus:outline-none"
                  >
                    {isLoading ? "Creating..." : "Create account"}
                  </button>
                </div>

                {/* Disclaimer */}
                <div className="pt-2 text-center text-[11px] text-[#737373] dark:text-neutral-400 leading-relaxed">
                  Your account uses a password session. Financial assessments use reviewed manual inputs; outgoing actions are sandbox-only.
                </div>
              </form>
            </>
          )}
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
