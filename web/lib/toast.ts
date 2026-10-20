import { toast as sonnerToast, type ExternalToast } from "sonner";
import { ApiError, NetworkError } from "./orderfit-api";

export interface ToastOptions extends Omit<ExternalToast, "description"> {
  description?: React.ReactNode;
}

// In-memory cache to deduplicate identical toasts fired in rapid succession (e.g. parallel requests or duplicate events)
const recentToasts = new Map<string, number>();
const DEDUPLICATION_WINDOW_MS = 1500;

function shouldDeduplicate(key: string): boolean {
  const now = Date.now();
  const lastTime = recentToasts.get(key);

  // Periodically clean up entries older than 30 seconds
  if (recentToasts.size > 50) {
    for (const [k, time] of recentToasts.entries()) {
      if (now - time > 30_000) {
        recentToasts.delete(k);
      }
    }
  }

  if (lastTime && now - lastTime < DEDUPLICATION_WINDOW_MS) {
    return true;
  }

  recentToasts.set(key, now);
  return false;
}

/**
 * Normalizes backend, network, and unexpected runtime errors into clean, truthful, user-safe messages.
 * Never leaks database details, stack traces, credentials, or private URLs.
 */
export function normalizeErrorMessage(
  error: unknown,
  fallback = "Something went wrong. Please try again."
): { message: string; description?: string } {
  if (!error) return { message: fallback };

  if (error instanceof ApiError) {
    if (error.code === "INVALID_CREDENTIALS" || error.status === 401) {
      return { message: "Invalid email or password." };
    }
    if (error.code === "SESSION_REAUTH_REQUIRED") {
      return { message: "Your role or session changed.", description: "Please sign in again to continue." };
    }
    if (error.status === 403) {
      return { message: "Permission denied.", description: "You do not have permission to perform this action." };
    }
    if (error.status === 404) {
      return { message: error.message || "The requested resource was not found." };
    }
    if (error.status === 409) {
      return { message: "Update conflict.", description: error.message || "This record was updated by another change. Please reload." };
    }
    if (error.status === 503 || error.code === "DEPENDENCY_UNAVAILABLE" || error.code === "DATABASE_CAPACITY") {
      return { message: "Service temporarily unavailable.", description: "Please retry in a few moments." };
    }
    if (error.message && error.message.trim()) {
      return { message: error.message.trim() };
    }
  }

  if (
    error instanceof NetworkError ||
    (error instanceof Error && (error.name === "NetworkError" || error.message.includes("fetch failed") || error.message.includes("Failed to fetch")))
  ) {
    return {
      message: "Network connection issue.",
      description: "Unable to reach the server. Check your connection and retry.",
    };
  }

  if (typeof error === "string" && error.trim()) {
    return { message: error.trim() };
  }

  if (error instanceof Error) {
    const msg = error.message;
    const isSensitiveOrStack =
      !msg ||
      msg.includes("Traceback") ||
      msg.includes("traceback") ||
      /\bat\s+[\w.<>]+/i.test(msg) ||
      /\.py:\d+/i.test(msg) ||
      /\.tsx?:\d+/i.test(msg) ||
      /\bSELECT\b/i.test(msg) ||
      /\bINSERT\s+INTO\b/i.test(msg) ||
      /\bUPDATE\s+.*\s+SET\b/i.test(msg) ||
      /\bDELETE\s+FROM\b/i.test(msg) ||
      /psycopg/i.test(msg) ||
      /sqlalchemy/i.test(msg) ||
      /token=/i.test(msg) ||
      /password=/i.test(msg);

    if (!isSensitiveOrStack) {
      return { message: msg.trim() };
    }
  }

  return { message: fallback };
}

/**
 * Production-ready Global Toast Notification interface for OrderFit.
 * Provides unified, accessible, debounced notifications across the entire application.
 */
export const toast = {
  /**
   * Show a success notification (green accent, check icon, ~3s duration)
   */
  success(message: string, options?: ToastOptions) {
    const key = `success:${message}:${String(options?.description ?? "")}`;
    if (!options?.id && shouldDeduplicate(key)) return key;

    return sonnerToast.success(message, {
      duration: 3000,
      ...options,
    });
  },

  /**
   * Show an error notification (red accent, alert icon, ~5s duration)
   */
  error(message: string, options?: ToastOptions) {
    const key = `error:${message}:${String(options?.description ?? "")}`;
    if (!options?.id && shouldDeduplicate(key)) return key;

    return sonnerToast.error(message, {
      duration: 5000,
      ...options,
    });
  },

  /**
   * Show a warning notification (amber accent, warning icon, ~4.5s duration)
   */
  warning(message: string, options?: ToastOptions) {
    const key = `warning:${message}:${String(options?.description ?? "")}`;
    if (!options?.id && shouldDeduplicate(key)) return key;

    return sonnerToast.warning(message, {
      duration: 4500,
      ...options,
    });
  },

  /**
   * Show an informational notification (neutral/blue accent, info icon, ~3.5s duration)
   */
  info(message: string, options?: ToastOptions) {
    const key = `info:${message}:${String(options?.description ?? "")}`;
    if (!options?.id && shouldDeduplicate(key)) return key;

    return sonnerToast.info(message, {
      duration: 3500,
      ...options,
    });
  },

  /**
   * Show a loading notification (spinner, persistent until resolved or dismissed)
   */
  loading(message: string, options?: ToastOptions) {
    return sonnerToast.loading(message, options);
  },

  /**
   * Handle an error object by normalizing it safely and presenting a clean error toast.
   */
  fromError(error: unknown, fallbackMessage?: string, options?: ToastOptions) {
    const normalized = normalizeErrorMessage(error, fallbackMessage);
    return toast.error(normalized.message, {
      description: normalized.description,
      ...options,
    });
  },

  /**
   * Dismiss a specific toast by ID, or all toasts if no ID is passed.
   */
  dismiss(id?: string | number) {
    return sonnerToast.dismiss(id);
  },

  /**
   * Wrap an async promise with loading, success, and error states.
   */
  promise<T>(
    promise: Promise<T> | (() => Promise<T>),
    data: {
      loading: string;
      success: string | ((data: T) => string);
      error: string | ((error: unknown) => string);
      description?: React.ReactNode | ((data: T) => React.ReactNode);
    }
  ) {
    return sonnerToast.promise(promise, data);
  },
};
