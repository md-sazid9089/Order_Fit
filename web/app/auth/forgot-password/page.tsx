import Link from "next/link";
import { ArrowLeft, Mail } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";

export default function ForgotPasswordPage() {
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
          <Link href="/auth/signup" className="hover:text-[#1E2021] dark:hover:text-white transition-colors outline-none">
            Sign Up
          </Link>
        </div>
      </header>

      {/* Honest notice: no reset backend exists */}
      <main className="flex-1 flex items-center justify-center px-4 py-6 sm:py-10 w-full max-w-full">
        <div className="w-full max-w-[440px] bg-white dark:bg-[#181A1B] border border-[#E8E6E1] dark:border-[#2A2C2D] rounded-2xl p-5 sm:p-8 md:p-10 shadow-xs dark:shadow-none">
          {/* Top Icon Badge */}
          <div className="mx-auto w-12 h-12 rounded-2xl bg-[#FAF9F7] dark:bg-[#222425] border border-[#E8E6E1] dark:border-[#2A2C2D] flex items-center justify-center text-[#1E2021] dark:text-white mb-5 shadow-xs">
            <Mail className="size-5 text-[#004D3B] dark:text-[#B5F2C6]" />
          </div>

          {/* Heading */}
          <h1 className="text-xl sm:text-2xl font-bold text-center text-[#1E2021] dark:text-white mb-2 font-display tracking-tight">
            Password recovery isn&apos;t available yet
          </h1>
          <p className="text-center text-xs sm:text-sm text-[#737373] dark:text-neutral-400 leading-relaxed mb-6">
            This release has no email-based password reset. If you are signed in on another device, change your
            password in Settings. Otherwise ask a business owner or administrator for help with your account.
          </p>
          <Link
            href="/auth/signin"
            className="w-full py-2.5 px-4 rounded-xl bg-transparent hover:bg-[#FAF9F7] dark:hover:bg-[#222425] text-xs sm:text-sm font-medium text-[#737373] dark:text-neutral-400 hover:text-[#1E2021] dark:hover:text-white transition-colors flex items-center justify-center gap-2 outline-none"
          >
            <ArrowLeft className="size-3.5" />
            <span>Back to Log In</span>
          </Link>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full max-w-[1560px] mx-auto px-4 sm:px-6 py-4 text-center text-xs text-[#737373] dark:text-neutral-400">
        &copy; {new Date().getFullYear()} OrderFit Inc. All rights reserved.
      </footer>
    </div>
  );
}
