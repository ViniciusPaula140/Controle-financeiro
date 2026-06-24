import type { FixedBill } from "@/lib/finance-store";

export function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function getFixedBillDueDate(bill: Pick<FixedBill, "year" | "month" | "dueDay">) {
  const lastDay = new Date(bill.year, bill.month + 1, 0).getDate();
  const day = Math.min(Math.max(1, bill.dueDay), lastDay);
  return new Date(bill.year, bill.month, day);
}

export function formatFixedBillDueDate(bill: Pick<FixedBill, "year" | "month" | "dueDay">) {
  const lastDay = new Date(bill.year, bill.month + 1, 0).getDate();
  const day = Math.min(Math.max(1, bill.dueDay), lastDay);
  const dd = String(day).padStart(2, "0");
  const mm = String(bill.month + 1).padStart(2, "0");
  return `${dd}/${mm}/${bill.year}`;
}
