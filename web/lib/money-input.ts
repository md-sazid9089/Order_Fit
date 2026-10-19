// Parsing typed money into the API's integer minor-unit strings, and back for editing.
// Pure string handling: no Number/float arithmetic, so values beyond 2^53 stay exact.
// This is input formatting only; every calculation remains in the deterministic engine.

/**
 * "50,000.50" → "5000050" (exponent 2). Returns null when the text is not an unambiguous amount.
 * A leading minus is accepted only with `allowNegative` (for example an overdrawn opening balance).
 */
export function toMinorUnits(text: string, exponent: number, allowNegative = false): string | null {
  const trimmed = text.trim().replace(/^−/, "-");
  const negative = trimmed.startsWith("-");
  if (negative && !allowNegative) return null;
  const body = negative ? trimmed.slice(1) : trimmed;
  if (/[-−]/.test(body)) return null; // a sign anywhere else is ambiguous, never guessed
  const cleaned = body.replace(/[\s,]/g, "").replace(/^[^\d.]+/, "");
  if (!cleaned || !/^\d*(\.\d*)?$/.test(cleaned) || cleaned === ".") return null;
  const [whole = "", fraction = ""] = cleaned.split(".");
  if (fraction.length > exponent) return null;
  if (!whole && !fraction) return null;
  const digits = `${whole || "0"}${fraction.padEnd(exponent, "0")}`.replace(/^0+(?=\d)/, "");
  return negative && digits !== "0" ? `-${digits}` : digits;
}

/** "5000050" → "50000.50" (exponent 2). Empty string for missing or malformed values. */
export function toMajorText(minor: string | null | undefined, exponent: number): string {
  if (minor === null || minor === undefined || !/^-?\d+$/.test(minor)) return "";
  const negative = minor.startsWith("-");
  const padded = (negative ? minor.slice(1) : minor).padStart(exponent + 1, "0");
  const whole = padded.slice(0, padded.length - exponent).replace(/^0+(?=\d)/, "");
  return `${negative ? "-" : ""}${exponent ? `${whole}.${padded.slice(padded.length - exponent)}` : whole}`;
}
