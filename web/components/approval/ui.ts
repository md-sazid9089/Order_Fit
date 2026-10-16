export const panel = "space-y-3 rounded-xl border bg-white p-5";
export const button = "rounded border border-neutral-400 px-3 py-2 text-sm disabled:opacity-40";
export const primary = "rounded bg-neutral-900 px-3 py-2 text-sm text-white disabled:opacity-40";
export const field = "block w-full rounded border border-neutral-300 bg-white p-2 text-sm";
export const sandboxBanner = "Nothing leaves the system: sandbox only. No email, bank, payment or lender is contacted.";
export const when = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleString() : "not yet");
