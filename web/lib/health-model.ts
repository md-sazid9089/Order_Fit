// Liveness versus readiness, kept honest. /health only says the API process answers HTTP. /ready says the restricted
// database login, current schema and private storage are usable. The indicator must never present liveness as readiness.
export type Probe = { connected: boolean; ready: boolean | null; database?: boolean | null };
export type HealthState = "checking" | "ready" | "not_ready" | "readiness_unknown" | "unreachable";

/** Interprets the two HTTP statuses seen by the server-side probe (null means no response). */
export function probeFrom(liveStatus: number | null, readyStatus: number | null, database?: boolean | null): Probe {
  const connected = liveStatus !== null && liveStatus >= 200 && liveStatus < 300;
  if (!connected) return { connected: false, ready: false, ...(database !== undefined ? { database: false } : {}) };
  if (readyStatus === 200) return { connected: true, ready: true, ...(database !== undefined ? { database: database ?? true } : {}) };
  // An API without a readiness route answers 404: readiness is unknown, not failed.
  if (readyStatus === 404 || readyStatus === 405) return { connected: true, ready: null, ...(database !== undefined ? { database: null } : {}) };
  return { connected: true, ready: false, ...(database !== undefined ? { database: database ?? false } : {}) };
}

export function healthState(probe: Probe | null): HealthState {
  if (!probe) return "checking";
  if (!probe.connected) return "unreachable";
  if (probe.ready === true) return "ready";
  return probe.ready === false ? "not_ready" : "readiness_unknown";
}

export const HEALTH_TEXT: Record<HealthState, { label: string; detail: string }> = {
  checking: { label: "Checking API...", detail: "Waiting for the first answer." },
  ready: { label: "API ready", detail: "Liveness and readiness checks both passed." },
  not_ready: { label: "API reachable, not ready", detail: "The process answers, but database, schema, storage or worker capacity is unavailable. Saving or background work may not work." },
  readiness_unknown: { label: "API reachable, readiness unknown", detail: "The process answers (liveness only). This API reports no readiness check." },
  unreachable: { label: "API unreachable", detail: "No answer from the API." },
};

/** Parses the same-origin probe response, treating anything malformed as unreachable rather than healthy. */
export function parseProbe(status: number, body: unknown): Probe {
  const b = body as { connected?: unknown; ready?: unknown; database?: unknown } | null;
  if (status < 200 || status >= 300 || !b || b.connected !== true) return { connected: false, ready: false, database: false };
  const database = typeof b.database === "boolean" ? b.database : (b.ready === true ? true : b.ready === false ? false : null);
  return {
    connected: true,
    ready: b.ready === true ? true : b.ready === false ? false : null,
    database,
  };
}
