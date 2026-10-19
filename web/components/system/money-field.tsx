"use client";

import { useId, useState } from "react";
import { cn } from "cn";
import { toMajorText, toMinorUnits } from "@/lib/money-input";

export const fieldControl =
  "h-10 w-full rounded-lg border border-input bg-card px-3 text-sm text-foreground placeholder:text-muted-foreground transition-colors hover:border-border-strong focus-visible:border-ring disabled:opacity-60";

/**
 * Money is typed in the business currency ("50,000.00") and handed to the API as an exact minor-unit string.
 * `onChangeMinor` receives "" while the text is empty or ambiguous; the visible hint explains why.
 * With `name`, a hidden input carries the minor-unit value for native form submission.
 */
export function MoneyField({
  label,
  currency,
  exponent = 2,
  valueMinor,
  onChangeMinor,
  name,
  required,
  hint,
  allowZero = true,
  allowNegative = false,
  className,
}: {
  label: string;
  currency: string;
  exponent?: number;
  valueMinor?: string | null;
  onChangeMinor?: (minor: string) => void;
  name?: string;
  required?: boolean;
  hint?: string;
  allowZero?: boolean;
  allowNegative?: boolean;
  className?: string;
}) {
  const id = useId();
  const [text, setText] = useState(() => toMajorText(valueMinor, exponent));
  const [syncedValue, setSyncedValue] = useState(valueMinor);
  // When the value is replaced from outside (a policy default, a reload), show it; typing is never overwritten.
  if (valueMinor !== syncedValue) {
    setSyncedValue(valueMinor);
    if ((toMinorUnits(text, exponent, allowNegative) ?? "") !== (valueMinor ?? "")) setText(toMajorText(valueMinor, exponent));
  }
  const minor = toMinorUnits(text, exponent, allowNegative);
  const invalid = text.trim() !== "" && (minor === null || (!allowZero && minor === "0"));
  const message = invalid
    ? minor === "0"
      ? "Enter an amount greater than zero."
      : `Enter an amount like 25,000.50 (up to ${exponent} decimal places).`
    : hint;
  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={id} className="block text-sm font-medium text-foreground">
        {label} <span className="font-normal text-muted-foreground">({currency})</span>
      </label>
      <input
        id={id}
        inputMode="decimal"
        autoComplete="off"
        required={required}
        aria-invalid={invalid || undefined}
        aria-describedby={message ? `${id}-hint` : undefined}
        className={cn(fieldControl, "tabular", invalid && "border-danger")}
        placeholder={exponent ? `0.${"0".repeat(exponent)}` : "0"}
        value={text}
        onChange={(e) => {
          const next = e.target.value;
          setText(next);
          const parsed = toMinorUnits(next, exponent, allowNegative);
          onChangeMinor?.(parsed !== null && (allowZero || parsed !== "0") ? parsed : "");
        }}
      />
      {name && <input type="hidden" name={name} value={invalid || minor === null ? "" : minor} />}
      {message && (
        <p id={`${id}-hint`} className={cn("text-xs leading-5", invalid ? "text-danger" : "text-muted-foreground")}>
          {message}
        </p>
      )}
    </div>
  );
}
