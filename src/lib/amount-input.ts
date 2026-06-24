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
