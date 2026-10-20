"use client";

import React, { useEffect, useRef, useState, useMemo } from "react";
import { useOnboarding } from "./onboarding-context";
import { X, ArrowRight, ArrowLeft, Check, Sparkles } from "lucide-react";

export function OnboardingTour() {
  const {
    isActive,
    currentStepIndex,
    currentStep,
    totalSteps,
    isNavigating,
    targetRect,
    startTour,
    nextStep,
    prevStep,
    skipTour,
  } = useOnboarding();

  const popoverRef = useRef<HTMLDivElement | null>(null);
  const [dimensions, setDimensions] = useState<{ width: number; height: number }>({
    width: 380,
    height: 220,
  });

  // Keep track of viewport dimensions
  const [viewport, setViewport] = useState({ width: 1200, height: 800 });
  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleResize = () => {
      setViewport({ width: window.innerWidth, height: window.innerHeight });
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Measure popover whenever step changes
  useEffect(() => {
    if (!popoverRef.current) return;
    const r = popoverRef.current.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) {
      setDimensions({ width: r.width, height: r.height });
    }
  }, [currentStepIndex, isActive]);

  // Keyboard navigation
  useEffect(() => {
    if (!isActive) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        skipTour();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        nextStep();
      } else if (e.key === "ArrowLeft") {
        if (currentStepIndex > 0) {
          e.preventDefault();
          prevStep();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isActive, currentStepIndex, nextStep, prevStep, skipTour]);

  // Compute popover position coordinates
  const popoverStyle = useMemo((): React.CSSProperties => {
    const isMobile = viewport.width < 640;
    const padding = 16;

    // Centered modal for steps with no target, no currentStep, or on mobile
    if (!currentStep || !targetRect || currentStep.placement === "center" || isMobile) {
      if (isMobile) {
        return {
          position: "fixed",
          left: padding,
          right: padding,
          bottom: padding + 8,
          maxWidth: "calc(100vw - 32px)",
          zIndex: 9999,
        };
      }
      return {
        position: "fixed",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        maxWidth: "460px",
        width: "90vw",
        zIndex: 9999,
      };
    }

    const { width: pW, height: pH } = dimensions;
    const placement = currentStep.placement || "bottom";

    let top = 0;
    let left = 0;

    const targetCenterX = targetRect.left + targetRect.width / 2;
    const targetCenterY = targetRect.top + targetRect.height / 2;

    switch (placement) {
      case "bottom":
        top = targetRect.bottom + 12;
        left = targetCenterX - pW / 2;
        break;
      case "top":
        top = targetRect.top - pH - 12;
        left = targetCenterX - pW / 2;
        break;
      case "right":
        top = targetCenterY - pH / 2;
        left = targetRect.right + 12;
        break;
      case "left":
        top = targetCenterY - pH / 2;
        left = targetRect.left - pW - 12;
        break;
      default:
        top = targetRect.bottom + 12;
        left = targetCenterX - pW / 2;
    }

    // Flip to top if bottom overflows
    if (placement === "bottom" && top + pH > viewport.height - padding) {
      if (targetRect.top - pH - 12 >= padding) {
        top = targetRect.top - pH - 12;
      }
    }

    // Flip to bottom if top overflows
    if (placement === "top" && top < padding) {
      if (targetRect.bottom + 12 + pH <= viewport.height - padding) {
        top = targetRect.bottom + 12;
      }
    }

    // Clamp horizontally to stay on screen
    left = Math.max(padding, Math.min(left, viewport.width - pW - padding));
    top = Math.max(padding, Math.min(top, viewport.height - pH - padding));

    return {
      position: "fixed",
      top: `${top}px`,
      left: `${left}px`,
      maxWidth: "420px",
      width: "90vw",
      zIndex: 9999,
    };
  }, [targetRect, currentStep, dimensions, viewport]);

  if (!isActive || !currentStep) return null;

  const isFirstStep = currentStepIndex === 0;
  const isLastStep = currentStepIndex === totalSteps - 1;

  // Cutout target coordinates with subtle padding
  const cutoutPadding = 6;
  const cutout = targetRect
    ? {
        x: Math.max(0, targetRect.left - cutoutPadding),
        y: Math.max(0, targetRect.top - cutoutPadding),
        width: targetRect.width + cutoutPadding * 2,
        height: targetRect.height + cutoutPadding * 2,
        rx: 12,
      }
    : null;

  return (
    <div
      className="fixed inset-0 z-[9990] overflow-hidden select-none pointer-events-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-tour-title"
      aria-describedby="onboarding-tour-desc"
    >
      {/* SVG Backdrop with Cutout Spotlight */}
      <svg
        className="fixed inset-0 w-full h-full pointer-events-none transition-all duration-300"
        aria-hidden="true"
      >
        <defs>
          <mask id="orderfit-tour-mask">
            {/* White covers entire viewport */}
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            {/* Black cutout reveals the target element */}
            {cutout && (
              <rect
                x={cutout.x}
                y={cutout.y}
                width={cutout.width}
                height={cutout.height}
                rx={cutout.rx}
                fill="black"
              />
            )}
          </mask>
        </defs>

        {/* Backdrop overlay filled with dark tone */}
        <rect
          x="0"
          y="0"
          width="100%"
          height="100%"
          fill="rgba(15, 17, 18, 0.65)"
          mask="url(#orderfit-tour-mask)"
        />
      </svg>

      {/* Target Focus Ring around cutout */}
      {cutout && (
        <div
          className="fixed pointer-events-none rounded-xl ring-2 ring-[#004D3B] dark:ring-[#B5F2C6] shadow-[0_0_20px_rgba(0,77,59,0.3)] dark:shadow-[0_0_20px_rgba(181,242,198,0.25)] transition-all duration-300"
          style={{
            left: `${cutout.x}px`,
            top: `${cutout.y}px`,
            width: `${cutout.width}px`,
            height: `${cutout.height}px`,
            zIndex: 9995,
          }}
        />
      )}

      {/* Floating Popover Tooltip Card */}
      <div
        ref={popoverRef}
        style={popoverStyle}
        className="bg-white dark:bg-[#181A1B] border border-[#E8E6E1] dark:border-[#2A2C2D] rounded-2xl p-5 sm:p-6 shadow-2xl transition-all duration-200"
      >
        {/* Header row: Badge, progress indicator, and Close button */}
        <div className="flex items-center justify-between gap-3 pb-3 border-b border-[#F4F2ED] dark:border-[#2A2C2D]">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-[#FAF9F7] dark:bg-[#222425] border border-[#E8E6E1] dark:border-[#2A2C2D] text-[#1E2021] dark:text-neutral-200">
              <Sparkles className="size-3 text-[#004D3B] dark:text-[#B5F2C6]" />
              <span>
                {isFirstStep
                  ? "Quick Tour"
                  : isLastStep
                  ? "Complete"
                  : `Step ${currentStepIndex + 1} of ${totalSteps}`}
              </span>
            </span>
          </div>

          <button
            type="button"
            onClick={skipTour}
            className="p-1.5 rounded-lg text-[#737373] dark:text-neutral-400 hover:text-[#1E2021] dark:hover:text-white hover:bg-[#F4F2ED] dark:hover:bg-[#222425] transition-colors cursor-pointer"
            title="Skip Tour"
            aria-label="Skip Tour"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Step Content */}
        <div className="py-4 space-y-2">
          <h2
            id="onboarding-tour-title"
            className="text-base sm:text-lg font-bold font-display tracking-tight text-[#1E2021] dark:text-white"
          >
            {currentStep.title}
          </h2>
          <p
            id="onboarding-tour-desc"
            className="text-xs sm:text-sm text-[#525252] dark:text-neutral-300 leading-relaxed"
          >
            {currentStep.description}
          </p>

          {isNavigating && (
            <div className="pt-2 flex items-center gap-2 text-xs text-[#004D3B] dark:text-[#B5F2C6] font-medium">
              <div className="size-3.5 border-2 border-[#004D3B] dark:border-[#B5F2C6] border-t-transparent animate-spin rounded-full" />
              <span>Loading page elements...</span>
            </div>
          )}
        </div>

        {/* Progress Dots */}
        <div className="flex items-center gap-1.5 py-2">
          {Array.from({ length: totalSteps }).map((_, idx) => (
            <div
              key={idx}
              className={`h-1.5 rounded-full transition-all duration-200 ${
                idx === currentStepIndex
                  ? "w-6 bg-[#1E2021] dark:bg-white"
                  : idx < currentStepIndex
                  ? "w-2 bg-[#004D3B] dark:bg-[#B5F2C6]"
                  : "w-2 bg-[#E8E6E1] dark:bg-[#2A2C2D]"
              }`}
            />
          ))}
        </div>

        {/* Footer Actions */}
        <div className="pt-3 border-t border-[#F4F2ED] dark:border-[#2A2C2D] flex items-center justify-between gap-3">
          {/* Skip button */}
          <button
            type="button"
            onClick={skipTour}
            className="text-xs font-semibold text-[#737373] dark:text-neutral-400 hover:text-[#1E2021] dark:hover:text-white transition-colors cursor-pointer"
          >
            Skip Tour
          </button>

          {/* Back & Next buttons */}
          <div className="flex items-center gap-2">
            {!isFirstStep && (
              <button
                type="button"
                onClick={prevStep}
                disabled={isNavigating}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-[#E8E6E1] dark:border-[#2A2C2D] bg-[#FAF9F7] dark:bg-[#222425] hover:bg-[#F4F2ED] dark:hover:bg-[#2A2C2D] text-xs font-semibold text-[#1E2021] dark:text-white transition-colors cursor-pointer disabled:opacity-50"
              >
                <ArrowLeft className="size-3.5" />
                <span>{currentStep.backLabel || "Back"}</span>
              </button>
            )}

            <button
              type="button"
              onClick={isFirstStep ? startTour : nextStep}
              disabled={isNavigating}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-[#1E2021] hover:bg-black text-white dark:bg-white dark:hover:bg-neutral-200 dark:text-[#1E2021] text-xs font-semibold transition-all cursor-pointer shadow-xs disabled:opacity-50"
            >
              <span>
                {currentStep.nextLabel ||
                  (isFirstStep ? "Start Tour" : isLastStep ? "Get Started" : "Next")}
              </span>
              {isLastStep ? (
                <Check className="size-3.5" />
              ) : (
                <ArrowRight className="size-3.5" />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
