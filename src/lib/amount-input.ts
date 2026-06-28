import type { FocusEvent } from "react";

/** Allows digits and at most one decimal separator (comma or dot). */
export function sanitizeAmountInput(value: string): string {
  let cleaned = value.replace(/[^0-9.,]/g, "");
  const sepIndex = cleaned.search(/[.,]/);
  if (sepIndex !== -1) {
    const before = cleaned.slice(0, sepIndex + 1);
    const after = cleaned.slice(sepIndex + 1).replace(/[.,]/g, "");
    cleaned = before + after;
  }
  return cleaned;
}

export const EMPTY_AMOUNT_FALLBACK = "0,00";

/** True when the string is only zero (0, 0,00, 0.00, etc.). */
export function isZeroAmount(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  const n = parseFloat(trimmed.replace(",", "."));
  return !Number.isNaN(n) && n === 0;
}

export function amountInputFocusProps(
  setValue: (value: string) => void,
  fallback = EMPTY_AMOUNT_FALLBACK,
) {
  return {
    onFocus: (e: FocusEvent<HTMLInputElement>) => {
      if (isZeroAmount(e.target.value)) setValue("");
    },
    onBlur: (e: FocusEvent<HTMLInputElement>) => {
      if (e.target.value.trim() === "") setValue(fallback);
    },
  };
}
