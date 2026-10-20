"use client"

import * as React from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { SESSION_EXPIRED_EVENT } from "@/lib/orderfit-api"
import { expiryRedirect } from "@/lib/session-expiry"
import { resetSessionState } from "@/lib/session-reset"
import { Toaster } from "@/components/ui/sonner"
import { SmoothScrollProvider } from "@/components/layout/smooth-scroll-provider"
import { ThemeProvider } from "@/components/theme-provider"

import { OnboardingProvider } from "@/components/onboarding/onboarding-context"
import { OnboardingTour } from "@/components/onboarding/onboarding-tour"

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = React.useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
          },
        },
      })
  )

  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="light"
      enableSystem={false}
      disableTransitionOnChange={false}
    >
      <QueryClientProvider client={queryClient}>
        <SessionExpiryHandler queryClient={queryClient} />
        <SmoothScrollProvider>
          <OnboardingProvider>
            {children}
            <OnboardingTour />
          </OnboardingProvider>
        </SmoothScrollProvider>
        <Toaster />
      </QueryClientProvider>
    </ThemeProvider>
  )
}

/**
 * The single place a 401 is handled after a page has mounted. lib/orderfit-api.ts fires one event for any rejected
 * request (a wrong password excluded), so pages that catch errors themselves need no wiring: the shared reset runs
 * and the user lands on sign-in with a notice. Public pages are left alone, which prevents a redirect loop.
 */
function SessionExpiryHandler({ queryClient }: { queryClient: QueryClient }) {
  const router = useRouter()
  React.useEffect(() => {
    function expired() {
      const target = expiryRedirect(window.location.pathname)
      if (!target) return
      resetSessionState(queryClient)
      router.replace(target)
    }
    window.addEventListener(SESSION_EXPIRED_EVENT, expired)
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, expired)
  }, [queryClient, router])
  return null
}
