"use client";

import React, { createContext, useContext, useEffect, useState, useSyncExternalStore } from "react";
import { ReactLenis, useLenis } from "lenis/react";
import type Lenis from "lenis";
import gsap from "gsap";
import "lenis/dist/lenis.css";

interface SmoothScrollContextType {
  scrollTo: (
    target: number | string | HTMLElement,
    options?: {
      offset?: number;
      duration?: number;
      immediate?: boolean;
      lock?: boolean;
    }
  ) => void;
  scrollToTop: (duration?: number) => void;
  progress: number;
}

const SmoothScrollContext = createContext<SmoothScrollContextType>({
  scrollTo: () => {},
  scrollToTop: () => {},
  progress: 0,
});

export const useSmoothScroll = () => useContext(SmoothScrollContext);

/**
 * Internal listener for anchor clicks, GSAP ticker sync, and scroll progress tracking
 */
function SmoothScrollTelemetry({
  onProgressChange,
}: {
  onProgressChange: (progress: number) => void;
}) {
  const lenis = useLenis((lenisInstance) => {
    onProgressChange(lenisInstance.progress);
  });

  // Sync Lenis with GSAP ticker for 60/120fps hardware-accelerated animations
  useEffect(() => {
    if (!lenis) return;

    const updateGsap = (time: number) => {
      lenis.raf(time * 1000);
    };

    gsap.ticker.add(updateGsap);
    gsap.ticker.lagSmoothing(0);

    return () => {
      gsap.ticker.remove(updateGsap);
    };
  }, [lenis]);

  // Intercept all in-page anchor links (#products, #customers, etc.) for silky smooth scrolling
  useEffect(() => {
    if (!lenis) return;

    const handleAnchorClick = (event: MouseEvent) => {
      const target = (event.target as HTMLElement).closest("a");
      if (!target) return;

      const href = target.getAttribute("href");
      if (!href) return;

      // Check if it's an on-page hash link
      if (href.startsWith("#") && href.length > 1) {
        const targetElement = document.querySelector(href);
        if (targetElement) {
          event.preventDefault();
          lenis.scrollTo(targetElement as HTMLElement, {
            offset: -84, // Account for sticky navbar height + padding
            duration: 1.2,
            easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
          });
        }
      }
    };

    document.addEventListener("click", handleAnchorClick);
    return () => document.removeEventListener("click", handleAnchorClick);
  }, [lenis]);

  // Handle URL hash on initial page load
  useEffect(() => {
    if (!lenis || typeof window === "undefined") return;

    if (window.location.hash) {
      const hash = window.location.hash;
      const targetElement = document.querySelector(hash);
      if (targetElement) {
        const timeoutId = setTimeout(() => {
          lenis.scrollTo(targetElement as HTMLElement, {
            offset: -84,
            duration: 1.2,
            easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
          });
        }, 300);
        return () => clearTimeout(timeoutId);
      }
    }
  }, [lenis]);

  return null;
}

/**
 * Top slim progress bar that indicates scroll depth across the entire page
 */
export function ScrollProgressBar({ progress }: { progress: number }) {
  return (
    <div
      className="fixed top-0 left-0 right-0 h-[3px] z-[60] pointer-events-none bg-transparent"
      aria-hidden="true"
    >
      <div
        className="h-full bg-gradient-to-r from-[#004D3B] via-[#529A86] to-[#B5F2C6] transition-transform duration-75 ease-out origin-left shadow-[0_0_8px_rgba(181,242,198,0.6)]"
        style={{
          transform: `scaleX(${progress})`,
        }}
      />
    </div>
  );
}


/**
 * Root Smooth Scroll Provider using Lenis
 * Integrates momentum scrolling, anchor interception, GSAP synchronization,
 * and customizable controls across the entire website.
 */
function getReducedMotionSnapshot(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function subscribeReducedMotion(callback: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  mediaQuery.addEventListener("change", callback);
  return () => mediaQuery.removeEventListener("change", callback);
}

export function SmoothScrollProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [scrollProgress, setScrollProgress] = useState(0);
  const reducedMotion = useSyncExternalStore(
    subscribeReducedMotion,
    getReducedMotionSnapshot,
    () => false
  );

  const lenisInstanceRef = React.useRef<Lenis | null>(null);

  const scrollTo = (
    target: number | string | HTMLElement,
    options?: {
      offset?: number;
      duration?: number;
      immediate?: boolean;
      lock?: boolean;
    }
  ) => {
    if (lenisInstanceRef.current) {
      lenisInstanceRef.current.scrollTo(target, {
        offset: options?.offset ?? -84,
        duration: options?.duration ?? 1.2,
        immediate: options?.immediate ?? false,
        lock: options?.lock ?? false,
        easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      });
    } else if (typeof window !== "undefined") {
      if (typeof target === "number") {
        window.scrollTo({ top: target, behavior: "smooth" });
      } else if (typeof target === "string") {
        const el = document.querySelector(target);
        el?.scrollIntoView({ behavior: "smooth" });
      } else if (target instanceof HTMLElement) {
        target.scrollIntoView({ behavior: "smooth" });
      }
    }
  };

  const scrollToTop = (duration = 1.2) => {
    scrollTo(0, { duration, offset: 0 });
  };

  return (
    <ReactLenis
      root
      ref={(ref) => {
        if (ref?.lenis) {
          lenisInstanceRef.current = ref.lenis;
        }
      }}
      options={{
        lerp: 0.09,
        duration: 1.2,
        smoothWheel: !reducedMotion,
        wheelMultiplier: 1.05,
        touchMultiplier: 1.5,
        autoRaf: false, // Managed in sync with GSAP ticker
        easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      }}
    >
      <SmoothScrollContext.Provider
        value={{
          scrollTo,
          scrollToTop,
          progress: scrollProgress,
        }}
      >
        <SmoothScrollTelemetry onProgressChange={setScrollProgress} />
        <ScrollProgressBar progress={scrollProgress} />
        {children}
      </SmoothScrollContext.Provider>
    </ReactLenis>
  );
}
