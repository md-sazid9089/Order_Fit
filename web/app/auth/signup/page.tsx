"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { mutate, type Session } from "@/lib/orderfit-api";
import { resetSessionState } from "@/lib/session-reset";
import { setCachedSession } from "@/lib/session-store";
import { AuthField, AuthFrame, PasswordField, authControl, authPrimary } from "@/components/auth/auth-frame";
import { InlineAlert } from "@/components/system/inline-alert";

const COMMON_TIMEZONES = [
  "Asia/Dhaka", "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles", "Europe/London",
  "Europe/Paris", "Europe/Berlin", "Asia/Dubai", "Asia/Singapore", "Asia/Tokyo", "Asia/Kolkata", "Australia/Sydney", "UTC",
];

const CURRENCIES = [
  { value: "BDT", label: "BDT (৳) Bangladeshi taka" },
  { value: "USD", label: "USD ($) US dollar" },
  { value: "EUR", label: "EUR (€) Euro" },
  { value: "GBP", label: "GBP (£) British pound" },
];

export default function SignUpPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [error, setError] = useState("");
  const [currency, setCurrency] = useState("BDT");
  // Rendered with a fixed default on the server, then set to the browser's zone after hydration (no mismatch).
  const [timezone, setTimezone] = useState("Asia/Dhaka");
  const [showPassword, setShowPassword] = useState(false);
  const [fullName, setFullName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    let detected = "";
    try { detected = Intl.DateTimeFormat().resolvedOptions().timeZone || ""; } catch { detected = ""; }
    if (detected) queueMicrotask(() => setTimezone(detected));
  }, []);

  const timezoneList = useMemo(() => (timezone && !COMMON_TIMEZONES.includes(timezone) ? [timezone, ...COMMON_TIMEZONES] : COMMON_TIMEZONES), [timezone]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (password.length < 12) { setError("Use a password of at least 12 characters."); return; }
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
      router.replace("/deals");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Your account wasn't created. Try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthFrame title="Create your account" description="One account and your first business. You can invite your team afterwards." links="signin">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <InlineAlert tone="danger">{error}</InlineAlert>}
        <AuthField id="fullName" name="fullName" label="Full name" required autoComplete="name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
        <AuthField id="businessName" name="businessName" label="Business / Company name" required autoComplete="organization" value={businessName} onChange={(e) => setBusinessName(e.target.value)} />
        <AuthField id="email" name="email" label="Email" type="email" required autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@business.com" />
        <PasswordField id="password" name="password" label="Password (min. 12 characters)" required minLength={12} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} visible={showPassword} onToggle={() => setShowPassword(!showPassword)} />
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-medium text-foreground">
            Business currency
            <select id="currency" className={authControl} value={currency} onChange={(e) => setCurrency(e.target.value)}>
              {CURRENCIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </label>
          <label className="block text-sm font-medium text-foreground">
            Time zone
            <select id="timezone" className={authControl} value={timezone} onChange={(e) => setTimezone(e.target.value)}>
              {timezoneList.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
            </select>
          </label>
        </div>
        <p className="text-xs leading-5 text-muted-foreground">The currency is fixed for this business: every amount is recorded and evaluated in it.</p>
        <button type="submit" disabled={isLoading} className={authPrimary}>{isLoading ? "Creating…" : "Create account"}</button>
        <p className="text-center text-sm text-muted-foreground">
          Already have an account? <Link href="/auth/signin" className="font-medium text-primary underline">Sign in</Link>
        </p>
      </form>
    </AuthFrame>
  );
}
