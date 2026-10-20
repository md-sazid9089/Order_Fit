export type TourStatus = "not_started" | "in_progress" | "completed" | "skipped";

export type PopoverPlacement = "top" | "bottom" | "left" | "right" | "center";

export interface TourStep {
  id: string;
  route: string;
  /** CSS selector or data attribute to target. If null or undefined, rendered as a centered modal. */
  selector?: string | null;
  title: string;
  description: string;
  /** Preferred placement of the popover relative to the target element */
  placement?: PopoverPlacement;
  /** Optional custom text for next button (default: "Next" or "Start Tour" on step 0) */
  nextLabel?: string;
  /** Optional custom text for back button (default: "Back") */
  backLabel?: string;
  /** If true, advancing this step triggers navigation to next step's route */
  isNavigationStep?: boolean;
}

export interface TourRecord {
  status: TourStatus;
  currentStepIndex: number;
  completedAt?: string;
  skippedAt?: string;
  updatedAt: string;
}

export interface OnboardingContextValue {
  isActive: boolean;
  status: TourStatus;
  currentStepIndex: number;
  currentStep: TourStep | null;
  totalSteps: number;
  isNavigating: boolean;
  targetRect: DOMRect | null;
  startTour: () => void;
  nextStep: () => void;
  prevStep: () => void;
  skipTour: () => void;
  completeTour: () => void;
  replayTour: () => void;
}
