import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Trophy, Pencil, X } from "lucide-react";
import { toast } from "sonner";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as ReTooltip } from "recharts";
import { AppShell } from "@/components/finance/AppShell";
import { AddTransactionDialog } from "@/components/finance/AddTransactionDialog";
import {
  useTransactions,
  useAccountBalances,
  useGoals,
  useFixedBills,
  useAlertSettings,
  BRL,
  categoryColors,
  MONTH_NAMES,
} from "@/lib/finance-store";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Início — Finanças" },
      { name: "description", content: "Visão geral do seu patrimônio e gastos." },
    ],
  }),
  component: Index,
});

function Index() {
  const transactions = useTransactions();
  const accounts = useAccountBalances();
  const goals = useGoals();
  const fixedBills = useFixedBills();
  const alerts = useAlertSettings();
  const accountsTotal = accounts.reduce((s, a) => s + a.balance, 0);

  const now = new Date();
  const [monthFilter, setMonthFilter] = useState<string>("all"); // "all" | "0".."11"
  const [yearFilter, setYearFilter] = useState<string>("all"); // "all" | "2026"

  const yearOptions = useMemo(() => {
    const set = new Set<number>([now.getFullYear()]);
    transactions.forEach((t) => set.add(new Date(t.date).getFullYear()));
    return [...set].sort((a, b) => b - a);
  }, [transactions, now]);

  const periodTx = useMemo(() => {
    return transactions.filter((t) => {
      const d = new Date(t.date);
      if (yearFilter !== "all" && d.getFullYear() !== Number(yearFilter)) return false;
      if (monthFilter !== "all" && d.getMonth() !== Number(monthFilter)) return false;
      return true;
    });
  }, [transactions, monthFilter, yearFilter]);

  const matchingGoals = goals.filter((g) => {
    if (yearFilter !== "all" && g.year !== Number(yearFilter)) return false;
    if (monthFilter !== "all" && g.month !== Number(monthFilter)) return false;
    return true;
  });
  const totalGoal = matchingGoals.reduce((s, g) => s + g.amount, 0);

  const income = periodTx.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
  const expenses = periodTx.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
  const saved = Math.max(0, income - expenses);
  const goalPct = totalGoal > 0 ? Math.min(100, (saved / totalGoal) * 100) : 0;

  const periodLabel =
    monthFilter === "all" && yearFilter === "all"
      ? "Todos"
      : `${monthFilter === "all" ? "Todos meses" : MONTH_NAMES[Number(monthFilter)]} / ${
          yearFilter === "all" ? "Todos anos" : yearFilter
        }`;
  const editGoalYM = `${yearFilter === "all" ? now.getFullYear() : yearFilter}-${String(
    (monthFilter === "all" ? now.getMonth() : Number(monthFilter)) + 1,
  ).padStart(2, "0")}`;

  const alertedRef = useRef(false);
  useEffect(() => {
    if (alertedRef.current) return;
    alertedRef.current = true;
    const today = new Date();
    const limit = new Date();
    limit.setDate(today.getDate() + alerts.daysBefore);
    const upcoming = fixedBills.filter((b) => {
      if (b.paid) return false;
      const due = new Date(b.year, b.month, b.dueDay);
      return due >= today && due <= limit;
    });
    upcoming.slice(0, 3).forEach((b) => {
      const due = new Date(b.year, b.month, b.dueDay);
      toast.warning(`Vence em breve: ${b.item}`, {
        description: `${BRL(b.amount)} • ${due.toLocaleDateString("pt-BR")}`,
      });
    });
  }, [fixedBills, alerts]);

  const byCategory = useMemo(() => {
    const map = new Map<string, number>();
    periodTx
      .filter((t) => t.type === "expense")
      .forEach((t) => map.set(t.category, (map.get(t.category) ?? 0) + t.amount));
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  }, [periodTx]);
  const byCategoryTotal = byCategory.reduce((s, c) => s + c.value, 0);

  return (
    <AppShell title="Início" action={<AddTransactionDialog />}>
      <div className="mb-5 flex flex-col gap-3 rounded-2xl border border-border bg-card p-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Período</span>
        <div className="flex flex-wrap items-center gap-2">
        <Select value={monthFilter} onValueChange={setMonthFilter}>
          <SelectTrigger className="h-9 w-full min-w-[140px] sm:w-[140px]"><SelectValue placeholder="Mês" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os meses</SelectItem>
            {MONTH_NAMES.map((n, i) => (
              <SelectItem key={n} value={String(i)}>{n}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={yearFilter} onValueChange={setYearFilter}>
          <SelectTrigger className="h-9 w-full min-w-[120px] sm:w-[120px]"><SelectValue placeholder="Ano" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os anos</SelectItem>
            {yearOptions.map((y) => (
              <SelectItem key={y} value={String(y)}>{y}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => { setMonthFilter("all"); setYearFilter("all"); }}
          className="text-xs"
        >
          <X className="h-3.5 w-3.5" /> Limpar filtros
        </Button>
        </div>
      </div>

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        <section className="rounded-3xl bg-gradient-to-br from-primary to-emerald-600 p-5 text-primary-foreground shadow-lg shadow-primary/20 md:col-span-2 xl:col-span-1">
          <p className="text-xs font-medium uppercase tracking-wider opacity-80">Investimento em contas</p>
          <p className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">{BRL(accountsTotal)}</p>
          <p className="mt-2 text-xs opacity-80">
            {accounts.length} {accounts.length === 1 ? "conta" : "contas"} cadastradas
          </p>
          <p className="mt-3 text-[10px] uppercase opacity-70">Valor global — não filtrado</p>
        </section>

        <section className="grid grid-cols-2 gap-3 md:col-span-2 xl:col-span-2">
          <div className="rounded-2xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">Receitas ({periodLabel})</p>
            <p className="mt-1 text-base font-semibold text-primary sm:text-lg">{BRL(income)}</p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">Despesas ({periodLabel})</p>
            <p className="mt-1 text-base font-semibold text-destructive sm:text-lg">{BRL(expenses)}</p>
          </div>
          <div className="col-span-2 rounded-2xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">Saldo do período</p>
            <p className={`mt-1 text-lg font-bold sm:text-xl ${income - expenses >= 0 ? "text-primary" : "text-destructive"}`}>
              {BRL(income - expenses)}
            </p>
          </div>
        </section>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <section className="rounded-2xl border border-border bg-card p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-accent text-primary">
                <Trophy className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Meta ({periodLabel})</p>
                <p className="text-base font-semibold text-foreground">
                  {totalGoal > 0 ? BRL(totalGoal) : "Sem meta definida"}
                </p>
              </div>
            </div>
            <Link
              to="/metas"
              search={{ ym: editGoalYM }}
              className="inline-flex w-fit items-center gap-1 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground transition hover:bg-accent"
            >
              <Pencil className="h-3.5 w-3.5" /> Editar Meta
            </Link>
          </div>
          {totalGoal > 0 && (
            <>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${goalPct}%` }} />
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Economizado: <span className="font-semibold text-foreground">{BRL(saved)}</span> ({Math.round(goalPct)}%)
              </p>
            </>
          )}
        </section>

        <section className="rounded-2xl border border-border bg-card p-4">
          <h2 className="text-sm font-semibold text-foreground">Gastos por categoria</h2>
          <p className="mt-1 text-xs text-muted-foreground">Top 5 categorias do período</p>
          {byCategory.length === 0 ? (
            <p className="mt-6 pb-6 text-center text-sm text-muted-foreground">
              Sem despesas neste período.
            </p>
          ) : (
            <div className="mt-3 flex flex-col items-center gap-4 sm:flex-row sm:items-center sm:gap-6">
              <div className="h-36 w-36 shrink-0 sm:h-40 sm:w-40">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={byCategory} dataKey="value" innerRadius={42} outerRadius={70} paddingAngle={2} stroke="none">
                      {byCategory.map((c) => (
                        <Cell key={c.name} fill={categoryColors[c.name]} />
                      ))}
                    </Pie>
                    <ReTooltip
                      formatter={(value: number, name: string) => {
                        const pct = byCategoryTotal > 0 ? Math.round((value / byCategoryTotal) * 100) : 0;
                        return [`${BRL(value)} (${pct}%)`, name];
                      }}
                      contentStyle={{ borderRadius: 8, fontSize: 12 }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <ul className="flex min-w-0 flex-1 flex-col gap-2 text-sm">
                {byCategory.map((c) => (
                  <li key={c.name} className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: categoryColors[c.name] }} />
                    <span className="min-w-0 flex-1 truncate text-muted-foreground">{c.name}</span>
                    <span className="shrink-0 font-medium text-foreground">{BRL(c.value)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}