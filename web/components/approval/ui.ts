export const panel = "space-y-4 rounded-2xl border border-[#E8E6E1] dark:border-[#2A2C2D] bg-white dark:bg-[#181A1B] p-5 shadow-xs";
export const button = "px-3.5 py-2 rounded-xl border border-[#E8E6E1] dark:border-[#2A2C2D] bg-[#FAF9F7] dark:bg-[#222425] hover:bg-white dark:hover:bg-[#2A2C2D] text-xs font-medium text-[#1E2021] dark:text-white transition-colors disabled:opacity-40";
export const primary = "px-4 py-2 rounded-xl bg-[#1E2021] hover:bg-black text-white dark:bg-white dark:text-[#1E2021] dark:hover:bg-neutral-200 text-xs font-semibold shadow-xs disabled:opacity-40 transition-colors";
export const field = "block w-full text-xs px-3.5 py-2.5 rounded-xl border border-[#E8E6E1] dark:border-[#2A2C2D] bg-[#FAF9F7] dark:bg-[#222425] text-[#1E2021] dark:text-white focus:outline-hidden focus:ring-1 focus:ring-[#1E2021]";
export const sandboxBanner = "Sandbox only: simulated records are kept for audit. No live email, bank, or payment system is contacted.";
export const when = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleString() : "not yet");

