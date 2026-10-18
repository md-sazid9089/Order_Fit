"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useEffect, useState } from "react";
import { ArrowLeft, CheckCircle2, Eye, EyeOff, KeyRound, Lock, RotateCcw, ShieldCheck } from "lucide-react";
import { OTPInput, type OTPStatus } from "@/components/ui/be-ui-otp-input";
import { ThemeToggle } from "@/components/theme-toggle";

function OtpVerificationContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get("email") || "your email";

  // State
  const [otp, setOtp] = useState("");
  const [status, setStatus] = useState<OTPStatus>("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [resendSeconds, setResendSeconds] = useState(60);
  const [resendNotice, setResendNotice] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);

  // Password reset step (after OTP is confirmed)
  const [step, setStep] = useState<"otp" | "new_password" | "done">("otp");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [resetError, setResetError] = useState("");
  const [isResetting, setIsResetting] = useState(false);

  // Resend countdown
  useEffect(() => {
    if (resendSeconds <= 0) return;
    const interval = setInterval(() => {
      setResendSeconds((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [resendSeconds]);

  // Handle OTP submission / verification
  const handleVerify = (code: string) => {
    if (code.length !== 6) return;

    setIsVerifying(true);
    setStatus("idle");
    setErrorMessage("");

    setTimeout(() => {
      // In UI demo mode, accept "123456" or any 6-digit input, but reject if explicitly entered wrong pattern
      if (code === "000000") {
        setStatus("error");
        setErrorMessage("Invalid code. Enter 123456 or try resending.");
        setIsVerifying(false);
      } else {
        setStatus("success");
        setIsVerifying(false);

        // Transition to New Password step after success animation
        setTimeout(() => {
          setStep("new_password");
        }, 850);
      }
    }, 600);
  };

  const handleResend = () => {
    if (resendSeconds > 0) return;
    setOtp("");
    setStatus("idle");
    setErrorMessage("");
    setResendSeconds(60);
    setResendNotice("A new 6-digit verification code has been dispatched.");
    setTimeout(() => setResendNotice(""), 5000);
  };

  const handlePasswordResetSubmit = (e: FormEvent) => {
    e.preventDefault();
    setResetError("");

    if (newPassword.length < 8) {
      setResetError("Password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setResetError("Passwords do not match.");
      return;
    }

    setIsResetting(true);
    setTimeout(() => {
      setIsResetting(false);
      setStep("done");
      // Redirect to signin with the notice after 1.5 seconds
      setTimeout(() => {
        router.push("/auth/signin?reason=password-changed");
      }, 1500);
    }, 700);
  };

  return (
    <div className="w-full max-w-[480px] bg-white dark:bg-[#181A1B] border border-[#E8E6E1] dark:border-[#2A2C2D] rounded-2xl p-5 sm:p-8 md:p-10 shadow-xs dark:shadow-none">
      {step === "otp" && (
        <div className="flex flex-col items-center text-center">
          {/* Security Icon Badge */}
          <div className="w-12 h-12 rounded-2xl bg-[#FAF9F7] dark:bg-[#222425] border border-[#E8E6E1] dark:border-[#2A2C2D] flex items-center justify-center text-[#004D3B] dark:text-[#B5F2C6] mb-5 shadow-xs">
            <KeyRound className="size-5" />
          </div>

          <h1 className="text-xl sm:text-2xl font-bold text-[#1E2021] dark:text-white mb-2 font-display tracking-tight">
            Verify Your Email
          </h1>

          <p className="text-xs sm:text-sm text-[#737373] dark:text-neutral-400 leading-relaxed mb-1 max-w-sm">
            We sent a 6-digit verification code to
          </p>
          <div className="flex items-center gap-2 mb-6">
            <span className="font-semibold text-xs sm:text-sm text-[#1E2021] dark:text-white break-all">
              {email}
            </span>
            <Link
              href="/auth/forgot-password"
              className="text-xs text-[#004D3B] dark:text-[#B5F2C6] hover:underline font-medium inline-flex items-center gap-0.5"
            >
              Change
            </Link>
          </div>

          {resendNotice && (
            <div className="w-full mb-4 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-200 flex items-center justify-center gap-2">
              <CheckCircle2 className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <span>{resendNotice}</span>
            </div>
          )}

          {/* OTP Input Component */}
          <div className="w-full flex flex-col items-center justify-center py-2">
            <OTPInput
              length={6}
              value={otp}
              onChange={(val) => {
                setOtp(val);
                if (status === "error") {
                  setStatus("idle");
                  setErrorMessage("");
                }
              }}
              onComplete={handleVerify}
              status={status}
              errorMessage={errorMessage}
              successMessage="Code verified! Redirecting…"
              hint="Enter code 123456 to test the flow"
              autoFocus
              aria-label="6-digit verification code"
              className="items-center"
            />
          </div>

          {/* Verify Button */}
          <div className="w-full pt-4 space-y-3">
            <button
              type="button"
              onClick={() => handleVerify(otp)}
              disabled={otp.length !== 6 || isVerifying || status === "success"}
              className="w-full py-3 px-4 rounded-xl bg-[#1E2021] hover:bg-black text-white dark:bg-white dark:hover:bg-neutral-200 dark:text-neutral-900 font-semibold text-sm transition-colors border-0 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer outline-none focus:outline-none flex items-center justify-center gap-2"
            >
              {isVerifying ? (
                <span>Verifying…</span>
              ) : status === "success" ? (
                <>
                  <CheckCircle2 className="size-4 text-emerald-400" />
                  <span>Verified</span>
                </>
              ) : (
                <span>Verify Code</span>
              )}
            </button>

            {/* Resend Link & Timer */}
            <div className="flex items-center justify-center gap-1.5 text-xs text-[#737373] dark:text-neutral-400 pt-2">
              <span>Didn&apos;t get a code?</span>
              {resendSeconds > 0 ? (
                <span className="font-medium text-[#1E2021] dark:text-neutral-300">
                  Resend in {resendSeconds}s
                </span>
              ) : (
                <button
                  type="button"
                  onClick={handleResend}
                  className="font-medium text-[#004D3B] dark:text-[#B5F2C6] hover:underline cursor-pointer inline-flex items-center gap-1 border-0 bg-transparent p-0"
                >
                  <RotateCcw className="size-3" />
                  <span>Resend code</span>
                </button>
              )}
            </div>

            <div className="pt-2">
              <Link
                href="/auth/signin"
                className="w-full py-2.5 px-4 rounded-xl bg-transparent hover:bg-[#FAF9F7] dark:hover:bg-[#222425] text-xs sm:text-sm font-medium text-[#737373] dark:text-neutral-400 hover:text-[#1E2021] dark:hover:text-white transition-colors flex items-center justify-center gap-2 outline-none"
              >
                <ArrowLeft className="size-3.5" />
                <span>Return to Log In</span>
              </Link>
            </div>
          </div>
        </div>
      )}

      {step === "new_password" && (
        <div>
          {/* Header */}
          <div className="mx-auto w-12 h-12 rounded-2xl bg-[#FAF9F7] dark:bg-[#222425] border border-[#E8E6E1] dark:border-[#2A2C2D] flex items-center justify-center text-[#004D3B] dark:text-[#B5F2C6] mb-5 shadow-xs">
            <Lock className="size-5" />
          </div>

          <h1 className="text-xl sm:text-2xl font-bold text-center text-[#1E2021] dark:text-white mb-2 font-display tracking-tight">
            Create New Password
          </h1>
          <p className="text-center text-xs sm:text-sm text-[#737373] dark:text-neutral-400 leading-relaxed mb-6">
            Your verification was successful. Enter your new password below.
          </p>

          <form onSubmit={handlePasswordResetSubmit} className="space-y-4">
            {resetError && (
              <p role="alert" className="rounded-lg bg-red-50 dark:bg-red-950 p-3 text-xs sm:text-sm text-red-800 dark:text-red-100 border border-red-200 dark:border-red-800">
                {resetError}
              </p>
            )}

            {/* New Password */}
            <div>
              <label htmlFor="new-password" className="block text-xs font-medium text-[#1E2021] dark:text-neutral-300 mb-1.5">
                New Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  id="new-password"
                  required
                  autoFocus
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="At least 8 characters"
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
            </div>

            {/* Confirm Password */}
            <div>
              <label htmlFor="confirm-password" className="block text-xs font-medium text-[#1E2021] dark:text-neutral-300 mb-1.5">
                Confirm New Password
              </label>
              <input
                type={showPassword ? "text" : "password"}
                id="confirm-password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter your password"
                className="w-full px-4 py-3 bg-[#FAF9F7] dark:bg-[#222425] border border-[#E8E6E1] dark:border-[#2A2C2D] rounded-xl text-base sm:text-sm text-[#1E2021] dark:text-white placeholder-[#A3A3A3] dark:placeholder-neutral-400 outline-none focus:outline-none focus:border-[#1E2021] dark:focus:border-neutral-500 transition-colors"
              />
            </div>

            {/* Submit */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={isResetting}
                className="w-full py-3 px-4 rounded-xl bg-[#1E2021] hover:bg-black text-white dark:bg-white dark:hover:bg-neutral-200 dark:text-neutral-900 font-semibold text-sm transition-colors border-0 disabled:opacity-70 cursor-pointer outline-none focus:outline-none flex items-center justify-center gap-2"
              >
                {isResetting ? (
                  <span>Updating password…</span>
                ) : (
                  <span>Update Password</span>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {step === "done" && (
        <div className="flex flex-col items-center text-center py-4">
          <div className="w-14 h-14 rounded-full bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center text-emerald-600 dark:text-emerald-400 mb-4 shadow-xs">
            <ShieldCheck className="size-7" />
          </div>

          <h2 className="text-xl font-bold text-[#1E2021] dark:text-white mb-2 font-display">
            Password Changed!
          </h2>
          <p className="text-xs sm:text-sm text-[#737373] dark:text-neutral-400 leading-relaxed mb-6">
            Your password has been successfully updated. Redirecting you to sign in…
          </p>

          <Link
            href="/auth/signin?reason=password-changed"
            className="w-full py-3 px-4 rounded-xl bg-[#1E2021] hover:bg-black text-white dark:bg-white dark:hover:bg-neutral-200 dark:text-neutral-900 font-semibold text-sm transition-colors text-center inline-block outline-none"
          >
            Continue to Log In
          </Link>
        </div>
      )}
    </div>
  );
}

export default function ForgotPasswordOtpPage() {
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
          <Link href="/auth/signin" className="hover:text-[#1E2021] dark:hover:text-white transition-colors outline-none">
            Log In
          </Link>
        </div>
      </header>

      {/* Centered Content with Suspense for useSearchParams */}
      <main className="flex-1 flex items-center justify-center px-4 py-6 sm:py-10 w-full max-w-full">
        <Suspense
          fallback={
            <div className="w-full max-w-[480px] bg-white dark:bg-[#181A1B] border border-[#E8E6E1] dark:border-[#2A2C2D] rounded-2xl p-10 text-center text-sm text-[#737373] dark:text-neutral-400">
              Loading verification…
            </div>
          }
        >
          <OtpVerificationContent />
        </Suspense>
      </main>

      {/* Footer */}
      <footer className="w-full max-w-[1560px] mx-auto px-4 sm:px-6 py-4 text-center text-xs text-[#737373] dark:text-neutral-400">
        &copy; {new Date().getFullYear()} OrderFit Inc. All rights reserved.
      </footer>
    </div>
  );
}
