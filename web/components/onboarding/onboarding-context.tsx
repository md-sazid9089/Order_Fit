"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import type {
  OnboardingContextValue,
  TourStatus,
  TourStep,
} from "./tour-types";
import { ONBOARDING_STEPS } from "./tour-steps";
import {
  loadTourRecord,
  resetTourRecord,
  saveTourRecord,
} from "./onboarding-storage";
import { getCachedSession } from "@/lib/session-store";

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

export function useOnboarding(): OnboardingContextValue {
  const ctx = useContext(OnboardingContext);
  if (!ctx) {
    throw new Error("useOnboarding must be used within an OnboardingProvider");
  }
  return ctx;
}

export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  const [isActive, setIsActive] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [status, setStatus] = useState<TourStatus>("not_started");
  const [isNavigating, setIsNavigating] = useState(false);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);

  const observerRef = useRef<MutationObserver | null>(null);
  const pollTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Get current active user identifier for user-isolated state
  const getUserId = useCallback((): string => {
    const session = getCachedSession();
    return (
      session?.user_id ||
      session?.email ||
      (typeof window !== "undefined"
        ? sessionStorage.getItem("orderfit.business")
        : null) ||
      "guest"
    );
  }, []);

  const currentStep: TourStep | null =
    isActive && currentStepIndex >= 0 && currentStepIndex < ONBOARDING_STEPS.length
      ? ONBOARDING_STEPS[currentStepIndex]
      : null;

  // Cleanup pending observer or timer
  const cleanupWatchers = useCallback(() => {
    if (observerRef.current) {
      observerRef.current.disconnect();
      observerRef.current = null;
    }
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  // Update target rect based on active selector
  const updateTargetRect = useCallback(() => {
    if (!currentStep || !currentStep.selector) {
      setTargetRect(null);
      return;
    }
    const el = document.querySelector(currentStep.selector);
    if (el) {
      const rect = el.getBoundingClientRect();
      setTargetRect(rect);
    } else {
      setTargetRect(null);
    }
  }, [currentStep]);

  // Wait for the target element to be present and rendered in DOM
  const waitForTargetElement = useCallback(
    (selector: string | null | undefined) => {
      cleanupWatchers();

      if (!selector) {
        queueMicrotask(() => {
          setTargetRect(null);
          setIsNavigating(false);
        });
        return;
      }

      // Check immediately
      const immediate = document.querySelector(selector);
      if (immediate) {
        immediate.scrollIntoView({ behavior: "smooth", block: "nearest" });
        const rect = immediate.getBoundingClientRect();
        queueMicrotask(() => {
          setTargetRect(rect);
          setIsNavigating(false);
        });
        return;
      }

      // Wait via MutationObserver + fallback interval polling up to 3000ms
      const startTime = Date.now();
      const maxWaitMs = 3000;

      const check = () => {
        const found = document.querySelector(selector);
        if (found) {
          cleanupWatchers();
          found.scrollIntoView({ behavior: "smooth", block: "nearest" });
          setTargetRect(found.getBoundingClientRect());
          setIsNavigating(false);
          return true;
        }
        if (Date.now() - startTime >= maxWaitMs) {
          cleanupWatchers();
          // Graceful fallback: show popover in center if selector missing
          setTargetRect(null);
          setIsNavigating(false);
          return true;
        }
        return false;
      };

      observerRef.current = new MutationObserver(() => {
        check();
      });

      if (typeof document !== "undefined" && document.body) {
        observerRef.current.observe(document.body, {
          childList: true,
          subtree: true,
          attributes: true,
        });
      }

      pollTimerRef.current = setInterval(check, 100);
    },
    [cleanupWatchers]
  );

  // Sync target rect when step changes or route changes
  useEffect(() => {
    let active = true;
    if (!isActive || !currentStep) {
      queueMicrotask(() => {
        if (active) setTargetRect(null);
      });
      cleanupWatchers();
      return;
    }

    // If step requires a specific route and we are on a different route, do not search yet
    if (currentStep.route && pathname && pathname !== currentStep.route) {
      return;
    }

    waitForTargetElement(currentStep.selector);

    return () => {
      active = false;
      cleanupWatchers();
    };
  }, [isActive, currentStep, pathname, waitForTargetElement, cleanupWatchers]);

  // Keep target rect updated on window resize or scroll
  useEffect(() => {
    if (!isActive || !currentStep?.selector) return;

    const handleReposition = () => {
      updateTargetRect();
    };

    window.addEventListener("resize", handleReposition);
    window.addEventListener("scroll", handleReposition, { passive: true });

    return () => {
      window.removeEventListener("resize", handleReposition);
      window.removeEventListener("scroll", handleReposition);
    };
  }, [isActive, currentStep, updateTargetRect]);

  // First-time user detection on /overview
  useEffect(() => {
    if (typeof window === "undefined") return;
    let active = true;
    const userId = getUserId();
    const record = loadTourRecord(userId);

    // Check for explicit query param trigger: ?onboarding=1 or ?onboarding=start
    const params = new URLSearchParams(window.location.search);
    const forceStart =
      params.get("onboarding") === "1" || params.get("onboarding") === "start";

    if (forceStart) {
      // Clear the query parameter cleanly without reloading
      const url = new URL(window.location.href);
      url.searchParams.delete("onboarding");
      window.history.replaceState(null, "", url.pathname + url.search);

      // Start the tour
      queueMicrotask(() => {
        if (!active) return;
        setCurrentStepIndex(0);
        setIsActive(true);
        setStatus("in_progress");
        saveTourRecord(userId, { status: "in_progress", currentStepIndex: 0 });
      });
      return;
    }

    if (!record) {
      // User has never had a record. If they land on /overview, prompt the Welcome step!
      if (pathname === "/overview") {
        queueMicrotask(() => {
          if (!active) return;
          setCurrentStepIndex(0);
          setIsActive(true);
          setStatus("not_started");
        });
      }
    } else {
      queueMicrotask(() => {
        if (!active) return;
        setStatus(record.status);
        if (record.status === "in_progress") {
          // If user was mid-tour, restore if on matching route
          const targetStep = ONBOARDING_STEPS[record.currentStepIndex];
          if (targetStep && pathname === targetStep.route) {
            setCurrentStepIndex(record.currentStepIndex);
            setIsActive(true);
          }
        }
      });
    }

    return () => {
      active = false;
    };
  }, [pathname, getUserId]);

  const startTour = useCallback(() => {
    const userId = getUserId();
    setCurrentStepIndex(0);
    setIsActive(true);
    setStatus("in_progress");
    saveTourRecord(userId, { status: "in_progress", currentStepIndex: 0 });
  }, [getUserId]);

  const skipTour = useCallback(() => {
    const userId = getUserId();
    setIsActive(false);
    setStatus("skipped");
    cleanupWatchers();
    setTargetRect(null);
    saveTourRecord(userId, { status: "skipped" });
  }, [getUserId, cleanupWatchers]);

  const completeTour = useCallback(() => {
    const userId = getUserId();
    setIsActive(false);
    setStatus("completed");
    cleanupWatchers();
    setTargetRect(null);
    saveTourRecord(userId, { status: "completed" });
  }, [getUserId, cleanupWatchers]);

  const replayTour = useCallback(() => {
    const userId = getUserId();
    resetTourRecord(userId);
    setStatus("in_progress");
    setCurrentStepIndex(0);
    setIsActive(true);

    if (pathname !== "/overview") {
      const search = typeof window !== "undefined" ? window.location.search : "";
      router.push(`/overview${search}`);
    }
  }, [getUserId, pathname, router]);

  const nextStep = useCallback(() => {
    if (currentStepIndex >= ONBOARDING_STEPS.length - 1) {
      completeTour();
      return;
    }

    const nextIdx = currentStepIndex + 1;
    const nextStepConfig = ONBOARDING_STEPS[nextIdx];
    const userId = getUserId();

    saveTourRecord(userId, { status: "in_progress", currentStepIndex: nextIdx });

    if (nextStepConfig.route !== pathname) {
      setIsNavigating(true);
      setCurrentStepIndex(nextIdx);
      const search = typeof window !== "undefined" ? window.location.search : "";
      router.push(`${nextStepConfig.route}${search}`);
    } else {
      setCurrentStepIndex(nextIdx);
    }
  }, [currentStepIndex, pathname, router, completeTour, getUserId]);

  const prevStep = useCallback(() => {
    if (currentStepIndex <= 0) return;

    const prevIdx = currentStepIndex - 1;
    const prevStepConfig = ONBOARDING_STEPS[prevIdx];
    const userId = getUserId();

    saveTourRecord(userId, { status: "in_progress", currentStepIndex: prevIdx });

    if (prevStepConfig.route !== pathname) {
      setIsNavigating(true);
      setCurrentStepIndex(prevIdx);
      const search = typeof window !== "undefined" ? window.location.search : "";
      router.push(`${prevStepConfig.route}${search}`);
    } else {
      setCurrentStepIndex(prevIdx);
    }
  }, [currentStepIndex, pathname, router, getUserId]);

  return (
    <OnboardingContext.Provider
      value={{
        isActive,
        status,
        currentStepIndex,
        currentStep,
        totalSteps: ONBOARDING_STEPS.length,
        isNavigating,
        targetRect,
        startTour,
        nextStep,
        prevStep,
        skipTour,
        completeTour,
        replayTour,
      }}
    >
      {children}
    </OnboardingContext.Provider>
  );
}
