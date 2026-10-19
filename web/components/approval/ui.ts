export const panel = "space-y-3 rounded-xl border bg-card p-5";
export const button = "rounded border border-border-strong px-3 py-2 text-sm disabled:opacity-40";
export const primary = "rounded bg-primary px-3 py-2 text-sm text-primary-foreground disabled:opacity-40";
export const field = "block w-full rounded border border-input bg-card p-2 text-sm";
export const sandboxBanner = "Nothing leaves the system: sandbox only. No email, bank, payment or lender is contacted.";
export const when = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleString() : "not yet");
