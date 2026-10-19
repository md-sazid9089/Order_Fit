import Link from "next/link";
import { ArrowRight } from "lucide-react";

// A real next step only. (A newsletter form used to claim "Thank you for subscribing" without sending anything.)
export function CtaSection() {
  return (
    <section className="py-16 md:py-24 bg-[#F7F6F5] dark:bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="rounded-4xl bg-white dark:bg-card border border-[#ECEAE4] dark:border-border px-6 py-16 sm:px-12 sm:py-20 text-center shadow-sm">
          <div className="max-w-3xl mx-auto flex flex-col items-center">
            <h2 className="font-heading font-medium text-[2rem] sm:text-[2.5rem] md:text-[3rem] leading-[110%] tracking-tight text-[#1A1A1A] dark:text-foreground mb-4 text-balance">
              Check your next order before you say yes
            </h2>
            <p className="font-sans text-base sm:text-lg text-[#526975] dark:text-muted-foreground leading-relaxed max-w-xl mx-auto mb-8">
              Enter the order and your cash position, and OrderFit shows the day your reserve would break, what terms would keep it safe,
              and what needs your approval. Every action runs in a sandbox until you are ready.
            </p>
            <div className="flex w-full max-w-md flex-col sm:flex-row items-center justify-center gap-3">
              <Link
                href="/auth/signup"
                className="inline-flex w-full sm:w-auto min-h-11 items-center justify-center gap-2 rounded-full px-7 py-3 bg-[#004D3B] text-[#FFFAEC] hover:bg-[#00382B] font-semibold text-sm transition-colors"
              >
                Create a free account <ArrowRight className="size-4" aria-hidden />
              </Link>
              <Link
                href="/auth/signin"
                className="inline-flex w-full sm:w-auto min-h-11 items-center justify-center rounded-full px-7 py-3 border border-[#ECEAE4] dark:border-border-strong text-[#1A1A1A] dark:text-foreground hover:bg-[#FAF9F7] dark:hover:bg-muted font-semibold text-sm transition-colors"
              >
                Sign in
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
