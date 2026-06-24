import { useMemo, useSyncExternalStore } from "react";
import { useTransactions as useSupabaseTransactions, addTransaction as addSupabaseTransaction, updateTransaction as updateSupabaseTransaction, deleteTransaction as deleteSupabaseTransaction } from "./supabase/transactions";
import { useBudgets as useSupabaseBudgets, addBudget as addSupabaseBudget, updateBudget as updateSupabaseBudget, deleteBudget as deleteSupabaseBudget } from "./supabase/budgets";
import { useAccountBalances as useSupabaseAccountBalances, addAccountBalance as addSupabaseAccountBalance, updateAccountBalance as updateSupabaseAccountBalance, deleteAccountBalance as deleteSupabaseAccountBalance } from "./supabase/account-balances";
import { useGoals as useSupabaseGoals, addGoal as addSupabaseGoal, updateGoal as updateSupabaseGoal, deleteGoal as deleteSupabaseGoal } from "./supabase/goals";
import { useFixedBills as useSupabaseFixedBills, addFixedBill as addSupabaseFixedBill, updateFixedBill as updateSupabaseFixedBill, deleteFixedBill as deleteSupabaseFixedBill, deleteFixedBills as deleteSupabaseFixedBills, markFixedBillPaid as markSupabaseFixedBillPaid, FIXED_BILL_ZERO_AMOUNT_MSG } from "./supabase/fixed-bills";
import { FIXED_BILL_CATEGORY, DEFAULT_PAYMENT_METHOD } from "./supabase/fixed-bill-sync";
import { useReceivables as useSupabaseReceivables, addReceivable as addSupabaseReceivable, updateReceivable as updateSupabaseReceivable, deleteReceivable as deleteSupabaseReceivable, markReceivableReceived as markSupabaseReceivableReceived, type Receivable as SupabaseReceivable } from "./supabase/receivables";

// Categories and accounts are dynamic strings so the user can create new ones.
export type Category = string;
export type Account = string;

const DEFAULT_CATEGORIES: Category[] = [
  "Alimentação",
  "Moradia",
  "Transporte",
  "Lazer",
  "Saúde",
  "Viagem",
  "Educação",
  "Salário",
  "Conta fixa",
  "Outros",
];

const DEFAULT_ACCOUNTS: Account[] = [
  "Dinheiro",
  "Nubank",
  "Itaú",
  "Inter",
  "XP",
  "Carteira",
  "PicPay",
  "Mercado Pago",
  "Caixa",
  "Banco do Brasil",
];

// Categories/accounts are derived from actual usage. A name only appears in the
// option list while at least one transaction or budget references it
// (garbage-collected). addCategory/addAccountName are kept as no-ops because
// the value is persisted when the parent form (transaction/budget) is saved.
export function addCategory(_name: string) {}
export function addAccountName(_name: string) {}
/** @deprecated derived from data */
export const ALL_ACCOUNTS = DEFAULT_ACCOUNTS;

export { FIXED_BILL_CATEGORY, DEFAULT_PAYMENT_METHOD, FIXED_BILL_ZERO_AMOUNT_MSG };

export interface Transaction {
  id: string;
  amount: number;
  type: "income" | "expense";
  category: Category;
  account: Account;
  date: string; // ISO
  description?: string;
  note?: string;
  recurring?: boolean;
  /** Linked fixed bill id (when created from Contas fixas). */
  fixedBillId?: string;
}

export interface Budget {
  id: string;
  category: Category; // matched against transaction.category exactly
  limit: number;
  name?: string; // user nomenclature / nickname
}

export interface AccountBalance {
  id: string;
  account: Account;
  balance: number;
  note?: string;
}

export interface Investment {
  id: string;
  institution: "Nubank" | "XP" | "Itaú" | "Inter" | "Binance";
  assetClass: "Renda Fixa" | "Renda Variável" | "Cripto";
  name: string;
  invested: number;
  current: number;
}

export interface Receivable {
  id: string;
  name: string;
  amount: number;
  year: number;
  month: number; // 0-11
  received: boolean;
  receivedAt?: string; // ISO date
  /** Linked auto-generated transaction id (when marked received). */
  txId?: string;
}

export interface Goal {
  id: string;
  year: number;
  month: number; // 0-11
  amount: number;
  note?: string;
}

export interface FixedBill {
  id: string;
  year: number;
  month: number; // 0-11
  item: string;
  amount: number;
  dueDay: number; // 1-31
  separated: "ok" | "pendente";
  paid: boolean;
  paidAt?: string;
  account?: Account;
  /** Linked auto-generated transaction id (when marked paid). */
  txId?: string;
}

export interface AlertSettings {
  daysBefore: number; // 1,3,7
}

const today = new Date();
const d = (offset: number) => {
  const x = new Date(today);
  x.setDate(x.getDate() - offset);
  return x.toISOString();
};

let transactions: Transaction[] = [
  { id: "t1", amount: 6500, type: "income", category: "Salário", account: "Nubank", date: d(2), description: "Salário Mensal" },
  { id: "t2", amount: 1800, type: "expense", category: "Moradia", account: "Itaú", date: d(3), description: "Aluguel" },
  { id: "t3", amount: 320, type: "expense", category: "Alimentação", account: "Nubank", date: d(4), description: "Supermercado" },
  { id: "t4", amount: 89.9, type: "expense", category: "Lazer", account: "Nubank", date: d(5), description: "Cinema" },
  { id: "t5", amount: 210, type: "expense", category: "Transporte", account: "Nubank", date: d(6), description: "Combustível" },
  { id: "t6", amount: 45, type: "expense", category: "Alimentação", account: "Nubank", date: d(7), description: "iFood" },
  { id: "t7", amount: 150, type: "expense", category: "Saúde", account: "Itaú", date: d(8), description: "Farmácia" },
  { id: "t8", amount: 800, type: "income", category: "Outros", account: "Inter", date: d(9), description: "Freelance" },
  { id: "t9", amount: 75, type: "expense", category: "Transporte", account: "Nubank", date: d(10), description: "Uber" },
  { id: "t10", amount: 260, type: "expense", category: "Lazer", account: "Itaú", date: d(12), description: "Restaurante" },
];

let budgetsList: Budget[] = [
  { id: "b1", category: "Alimentação", limit: 800 },
  { id: "b2", category: "Moradia", limit: 2000 },
  { id: "b3", category: "Transporte", limit: 400 },
  { id: "b4", category: "Lazer", limit: 300 },
  { id: "b5", category: "Saúde", limit: 300 },
];
const budgetListeners = new Set<() => void>();
const subBudget = (cb: () => void) => { budgetListeners.add(cb); return () => budgetListeners.delete(cb); };
const emitBudget = () => budgetListeners.forEach((l) => l());
export function useBudgets() {
  const { budgets } = useSupabaseBudgets();
  return budgets ?? [];
}
export function addBudget(b: Omit<Budget, "id">) {
  const cat = b.category.trim();
  if (!cat) return;
  addCategory(cat);
  return addSupabaseBudget(b);
}
export function updateBudget(id: string, patch: Partial<Omit<Budget, "id">>) {
  if (patch.category) addCategory(patch.category);
  return updateSupabaseBudget(id, patch);
}
export function deleteBudget(id: string) {
  return deleteSupabaseBudget(id);
}
/** @deprecated use useBudgets() */
export const budgets = budgetsList;

let accountBalances: AccountBalance[] = [
  { id: "a1", account: "Nubank", balance: 4820.5 },
  { id: "a2", account: "Itaú", balance: 2310.0 },
  { id: "a3", account: "Inter", balance: 1240.75 },
  { id: "a4", account: "Carteira", balance: 180 },
  { id: "a5", account: "PicPay", balance: 420.3 },
  { id: "a6", account: "Mercado Pago", balance: 760.0 },
  { id: "a7", account: "Caixa", balance: 1530.9 },
];

export const investments: Investment[] = [
  { id: "i1", institution: "XP", assetClass: "Renda Fixa", name: "Tesouro Selic 2029", invested: 8000, current: 8650 },
  { id: "i2", institution: "XP", assetClass: "Renda Fixa", name: "CDB Banco Master", invested: 5000, current: 5320 },
  { id: "i3", institution: "Nubank", assetClass: "Renda Variável", name: "BOVA11", invested: 4000, current: 4380 },
  { id: "i4", institution: "Itaú", assetClass: "Renda Variável", name: "ITSA4", invested: 3000, current: 2870 },
  { id: "i5", institution: "Inter", assetClass: "Renda Fixa", name: "LCI Inter", invested: 6000, current: 6240 },
  { id: "i6", institution: "Binance", assetClass: "Cripto", name: "Bitcoin", invested: 2500, current: 3120 },
  { id: "i7", institution: "Binance", assetClass: "Cripto", name: "Ethereum", invested: 1500, current: 1680 },
];

const txListeners = new Set<() => void>();
const subTx = (cb: () => void) => {
  txListeners.add(cb);
  return () => txListeners.delete(cb);
};
const emitTx = () => txListeners.forEach((l) => l());

export function useTransactions() {
  const { transactions, loading, error } = useSupabaseTransactions();
  return transactions ?? [];
}
export function useTransactionsState() {
  return useSupabaseTransactions();
}
export function addTransaction(t: Omit<Transaction, "id">) {
  if (t.category) addCategory(t.category);
  if (t.account) addAccountName(t.account);
  return addSupabaseTransaction(t);
}
export function updateTransaction(id: string, patch: Partial<Omit<Transaction, "id">>) {
  if (patch.category) addCategory(patch.category);
  if (patch.account) addAccountName(patch.account);
  return updateSupabaseTransaction(id, patch);
}
export function deleteTransaction(id: string) {
  return deleteSupabaseTransaction(id);
}

const accListeners = new Set<() => void>();
const subAcc = (cb: () => void) => {
  accListeners.add(cb);
  return () => accListeners.delete(cb);
};
const emitAcc = () => accListeners.forEach((l) => l());

export function useAccountBalances() {
  const { accounts } = useSupabaseAccountBalances();
  return accounts ?? [];
}
export function addAccountBalance(a: Omit<AccountBalance, "id">) {
  if (a.account) addAccountName(a.account);
  return addSupabaseAccountBalance(a);
}
export function updateAccountBalance(id: string, patch: Partial<Omit<AccountBalance, "id">>) {
  if (patch.account) addAccountName(patch.account);
  return updateSupabaseAccountBalance(id, patch);
}
export function deleteAccountBalance(id: string) {
  return deleteSupabaseAccountBalance(id);
}

export { accountBalances };

// ---------- Receivables ----------
const now0 = new Date();
let receivables: Receivable[] = [
  { id: "r1", name: "Salário 1", amount: 3250, year: now0.getFullYear(), month: now0.getMonth(), received: true, receivedAt: new Date().toISOString() },
  { id: "r2", name: "Salário 2", amount: 3250, year: now0.getFullYear(), month: now0.getMonth(), received: false },
  { id: "r3", name: "Freelance", amount: 800, year: now0.getFullYear(), month: (now0.getMonth() + 1) % 12, received: false },
];
const rcvListeners = new Set<() => void>();
const subRcv = (cb: () => void) => { rcvListeners.add(cb); return () => rcvListeners.delete(cb); };
const emitRcv = () => rcvListeners.forEach((l) => l());
export function useReceivables() {
  const { receivables } = useSupabaseReceivables();
  return receivables ?? [];
}
export async function addReceivable(r: Omit<Receivable, "id">) {
  const created = await addSupabaseReceivable({
    ...r,
    received: false,
    receivedAt: undefined,
    txId: undefined,
  });
  if (r.received) {
    await markReceivableReceived(created, true);
  }
  return created;
}

export async function updateReceivable(id: string, patch: Partial<Omit<Receivable, "id">>) {
  return updateSupabaseReceivable(id, patch);
}

export async function markReceivableReceived(receivable: Receivable, received: boolean) {
  return markSupabaseReceivableReceived(receivable as SupabaseReceivable, received);
}

export async function deleteReceivable(id: string) {
  return deleteSupabaseReceivable(id);
}

// ---------- Goals ----------
let goals: Goal[] = [
  { id: "g1", year: now0.getFullYear(), month: now0.getMonth(), amount: 4500, note: "Economizar para viagem" },
];
const goalListeners = new Set<() => void>();
const subGoal = (cb: () => void) => { goalListeners.add(cb); return () => goalListeners.delete(cb); };
const emitGoal = () => goalListeners.forEach((l) => l());
export function useGoals() {
  const { goals } = useSupabaseGoals();
  return goals ?? [];
}
export function addGoal(g: Omit<Goal, "id">) {
  return addSupabaseGoal(g);
}
export function updateGoal(id: string, patch: Partial<Omit<Goal, "id">>) {
  return updateSupabaseGoal(id, patch);
}
export function deleteGoal(id: string) {
  return deleteSupabaseGoal(id);
}

// ---------- Fixed Bills ----------
export const FIXED_BILL_TEMPLATES = [
  "Aluguel",
  "Energia",
  "Internet",
  "Faculdade",
  "TV assinat.",
  "Tim",
  "Seguro Chico",
  "Reserva de emergência",
  "Desafio 01",
  "Desafio 02",
  "Desafio 03",
  "Desafio 04",
  "IPVA - compensar reserva de emergência",
];

let fixedBills: FixedBill[] = [
  { id: "fb1", year: now0.getFullYear(), month: now0.getMonth(), item: "Aluguel", amount: 1800, dueDay: 5, separated: "ok", paid: true, paidAt: new Date().toISOString(), account: "Nubank" },
  { id: "fb2", year: now0.getFullYear(), month: now0.getMonth(), item: "Energia", amount: 220, dueDay: Math.min(28, now0.getDate() + 2), separated: "pendente", paid: false },
  { id: "fb3", year: now0.getFullYear(), month: now0.getMonth(), item: "Internet", amount: 120, dueDay: Math.min(28, now0.getDate() + 5), separated: "ok", paid: false },
  { id: "fb4", year: now0.getFullYear(), month: now0.getMonth(), item: "Faculdade", amount: 980, dueDay: 15, separated: "pendente", paid: false },
];
const fbListeners = new Set<() => void>();
const subFb = (cb: () => void) => { fbListeners.add(cb); return () => fbListeners.delete(cb); };
const emitFb = () => fbListeners.forEach((l) => l());
export function useFixedBills() {
  const { bills } = useSupabaseFixedBills();
  return bills ?? [];
}
export async function addFixedBill(b: Omit<FixedBill, "id">) {
  return addSupabaseFixedBill(b);
}
export async function updateFixedBill(id: string, patch: Partial<Omit<FixedBill, "id">>) {
  return updateSupabaseFixedBill(id, patch);
}
export async function deleteFixedBill(id: string) {
  return deleteSupabaseFixedBill(id);
}

export async function deleteFixedBills(ids: string[]) {
  return deleteSupabaseFixedBills(ids);
}

/** Returns true if any bill exists for the given year+month (uses live Supabase data). */
export function fixedBillsExistInMonth(bills: FixedBill[], year: number, month: number): boolean {
  if (!bills.length) return false;
  return bills.some((b) => b.year === year && b.month === month);
}

/** Returns the most recent (year, month) before the given one that has bills. */
export function lastMonthWithBills(
  bills: FixedBill[],
  year: number,
  month: number,
): { year: number; month: number } | null {
  if (!bills.length) return null;
  const candidates = bills
    .filter((b) => b.year < year || (b.year === year && b.month < month))
    .map((b) => b.year * 12 + b.month)
    .sort((a, b) => b - a);
  if (!candidates.length) return null;
  const k = candidates[0];
  return { year: Math.floor(k / 12), month: k % 12 };
}

/** Copy items from a source month into target month (skips if target already has bills). */
export async function copyFixedBillsFromMonth(
  bills: FixedBill[],
  src: { year: number; month: number },
  dst: { year: number; month: number },
) {
  if (fixedBillsExistInMonth(bills, dst.year, dst.month)) return;
  const items = bills.filter((b) => b.year === src.year && b.month === src.month);
  for (const item of items) {
    await addSupabaseFixedBill({
      ...item,
      year: dst.year,
      month: dst.month,
      paid: false,
      paidAt: undefined,
      txId: undefined,
    });
  }
}

/** Marks a bill paid (or unpaid). Syncs with linked transaction. */
export async function markFixedBillPaid(bill: FixedBill, paid: boolean) {
  return markSupabaseFixedBillPaid(bill, paid);
}

// ---------- Alert Settings ----------
let alertSettings: AlertSettings = { daysBefore: 7 };
const alertListeners = new Set<() => void>();
const subAlert = (cb: () => void) => { alertListeners.add(cb); return () => alertListeners.delete(cb); };
const emitAlert = () => alertListeners.forEach((l) => l());
export function useAlertSettings() {
  return useSyncExternalStore(subAlert, () => alertSettings, () => alertSettings);
}
export function setAlertSettings(s: AlertSettings) {
  alertSettings = s;
  emitAlert();
}

export const MONTH_NAMES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

export const BRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

// ---------- Derived option lists (garbage-collected) ----------
/** Categories shown in selectors = union of categories currently in use. */
export function useCategoriesList(): Category[] {
  const txs = useTransactions();
  const bs = useBudgets();
  return useMemo(() => {
    const s = new Set<string>(DEFAULT_CATEGORIES);
    txs.forEach((t) => t.category && s.add(t.category));
    bs.forEach((b) => b.category && s.add(b.category));
    return [...s].sort((a, b) => a.localeCompare(b));
  }, [txs, bs]);
}
/** Accounts shown in selectors = union of accounts in use (tx, balances, bills). */
export function useAccountsList(): Account[] {
  const txs = useTransactions();
  const bals = useAccountBalances();
  const bills = useFixedBills();
  return useMemo(() => {
    const s = new Set<string>();
    DEFAULT_ACCOUNTS.forEach((a) => s.add(a));
    txs.forEach((t) => t.account && s.add(t.account));
    bals.forEach((b) => b.account && s.add(b.account));
    bills.forEach((b) => b.account && s.add(b.account));
    return [...s].sort((a, b) => a.localeCompare(b));
  }, [txs, bals, bills]);
}

const STATIC_CATEGORY_COLORS: Record<string, string> = {
  Alimentação: "oklch(0.62 0.18 25)",
  Moradia: "oklch(0.65 0.15 245)",
  Transporte: "oklch(0.78 0.15 85)",
  Lazer: "oklch(0.6 0.18 305)",
  Saúde: "oklch(0.62 0.18 155)",
  Viagem: "oklch(0.68 0.16 220)",
  Educação: "oklch(0.66 0.14 280)",
  Salário: "oklch(0.62 0.18 155)",
  "Conta fixa": "oklch(0.55 0.12 200)",
  Outros: "oklch(0.5 0.02 250)",
};
const PALETTE = [
  "oklch(0.62 0.18 25)",
  "oklch(0.65 0.15 245)",
  "oklch(0.78 0.15 85)",
  "oklch(0.6 0.18 305)",
  "oklch(0.62 0.18 155)",
  "oklch(0.7 0.16 200)",
  "oklch(0.65 0.18 60)",
  "oklch(0.55 0.18 350)",
];
/** Backwards-compatible Proxy: lookup returns a stable color for any string. */
export const categoryColors: Record<string, string> = new Proxy(
  {},
  {
    get(_t, prop: string) {
      if (typeof prop !== "string") return undefined;
      if (STATIC_CATEGORY_COLORS[prop]) return STATIC_CATEGORY_COLORS[prop];
      let h = 0;
      for (let i = 0; i < prop.length; i++) h = (h * 31 + prop.charCodeAt(i)) >>> 0;
      return PALETTE[h % PALETTE.length];
    },
  },
) as Record<string, string>;