import Link from "next/link";
import type { ReactNode } from "react";
import { ThemeToggle } from "@/components/theme-toggle";

/** The one layout for every sign-in, sign-up and account-recovery screen: brand, one card, one task. */
export function AuthFrame({ title, description, children, links = "both" }: { title: string; description?: ReactNode; children: ReactNode; links?: "signin" | "signup" | "both" }) {
  return (
    <div className="flex min-h-[100dvh] flex-col bg-background text-foreground">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-4 sm:px-6 sm:py-6">
        <Link href="/" className="rounded-md text-2xl font-bold tracking-tight text-foreground">OrderFit</Link>
        <nav aria-label="Account" className="flex items-center gap-4 text-sm font-medium text-muted-foreground sm:gap-6">
          <ThemeToggle variant="pill" />
          {links !== "signup" && <Link href="/auth/signin" className="rounded-md hover:text-foreground">Sign in</Link>}
          {links !== "signin" && <Link href="/auth/signup" className="rounded-md hover:text-foreground">Sign up</Link>}
        </nav>
      </header>
      <main className="flex w-full flex-1 items-start justify-center px-4 py-6 sm:items-center sm:py-10">
        <div className="w-full max-w-[440px] rounded-2xl border border-border bg-card p-5 shadow-xs sm:p-8">
          <h1 className="mb-2 text-center text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
          {description && <div className="mb-6 text-center text-sm leading-6 text-muted-foreground">{description}</div>}
          {children}
        </div>
      </main>
      <footer className="mx-auto w-full max-w-6xl px-4 py-4 text-center text-xs text-muted-foreground sm:px-6">
        All outgoing actions in OrderFit run in a sandbox. Nothing is sent to a bank, lender or payee.
      </footer>
    </div>
  );
}

export const authControl =
  "mt-1.5 h-11 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground/70 transition-colors hover:border-border-strong focus-visible:border-ring disabled:opacity-60";

/** A labelled auth input. The label is always visible; placeholders are examples, never the label. */
export function AuthField({ label, hint, ...input }: React.InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string }) {
  return (
    <label className="block text-sm font-medium text-foreground">
      {label}
      <input {...input} className={authControl} />
      {hint && <span className="mt-1 block text-xs font-normal text-muted-foreground">{hint}</span>}
    </label>
  );
}

export const authPrimary =
  "inline-flex h-11 w-full items-center justify-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60";
