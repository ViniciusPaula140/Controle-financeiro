/** YYYY-MM-DD for the current local calendar day (avoids UTC shift from toISOString). */
export function localTodayDateInput(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Converts an ISO / DB timestamp to YYYY-MM-DD in local time. */
export function isoToLocalDateInput(iso: string): string {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Converts a date input (YYYY-MM-DD) to ISO at local noon to prevent timezone day rollback. */
export function localDateInputToISO(dateInput: string): string {
  const [y, m, d] = dateInput.split("-").map(Number);
  if (!y || !m || !d) return new Date().toISOString();
  return new Date(y, m - 1, d, 12, 0, 0, 0).toISOString();
}
