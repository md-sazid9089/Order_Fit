import type { TourRecord, TourStatus } from "./tour-types";

const STORAGE_PREFIX = "orderfit_onboarding_v1_";

export function getStorageKey(userId?: string | null): string {
  const safeId = userId && userId.trim() ? userId.trim() : "anonymous";
  return `${STORAGE_PREFIX}${safeId}`;
}

export function loadTourRecord(userId?: string | null): TourRecord | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(getStorageKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as TourRecord;
    if (parsed && typeof parsed.status === "string" && typeof parsed.currentStepIndex === "number") {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

export function saveTourRecord(userId: string | null | undefined, patch: Partial<TourRecord> & { status: TourStatus }): TourRecord {
  const existing = loadTourRecord(userId);
  const now = new Date().toISOString();
  const record: TourRecord = {
    status: patch.status,
    currentStepIndex: patch.currentStepIndex ?? existing?.currentStepIndex ?? 0,
    completedAt: patch.status === "completed" ? now : existing?.completedAt,
    skippedAt: patch.status === "skipped" ? now : existing?.skippedAt,
    updatedAt: now,
  };

  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(getStorageKey(userId), JSON.stringify(record));
    } catch {
      // Storage unavailable / quota exceeded
    }
  }

  return record;
}

export function resetTourRecord(userId?: string | null): TourRecord {
  return saveTourRecord(userId, { status: "in_progress", currentStepIndex: 0 });
}
