import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { AppShell } from "@/components/finance/AppShell";
import { ProtectedRoute } from "@/components/finance/ProtectedRoute";
import { CreatableSelect } from "@/components/finance/CreatableSelect";
import {
  useTransactions,
  useBudgets,
  useCategoriesList,
  addBudget,
  updateBudget,
  deleteBudget,
  addCategory,
  BRL,
  type Budget,
} from "@/lib/finance-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/orcamentos")({
  head: () => ({ meta: [{ title: "Orçamentos" }] }),
  component: OrcamentosPage,
});

function OrcamentosPage() {
  const transactions = useTransactions();
  const budgets = useBudgets();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Budget | null>(null);

  const now = new Date();
  const spentByCat = new Map<string, number>();
  transactions
    .filter((t) => {
      const d = new Date(t.date);
      return (
        t.type === "expense" &&
        d.getMonth() === now.getMonth() &&
        d.getFullYear() === now.getFullYear()
      );
    })
    .forEach((t) =>
      spentByCat.set(t.category, (spentByCat.get(t.category) ?? 0) + t.amount),
    );

  return (
    <ProtectedRoute>
      <AppShell
        title="Orçamentos"
        action={
          <button
            aria-label="Criar orçamento"
            onClick={() => setCreating(true)}
            className="fixed bottom-4 left-4 z-30 grid h-14 w-14 place-items-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 transition-transform active:scale-95 md:left-auto md:right-8 md:bottom-8"
          >
            <Plus className="h-6 w-6" />
          </button>
        }
      >
      <div className="mb-4 flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Defina um limite por categoria. O total é calculado a partir das despesas do mês atual.
        </p>
        <Button size="sm" onClick={() => setCreating(true)} className="shrink-0">
          <Plus className="h-4 w-4" /> Criar Orçamento
        </Button>
      </div>

      {budgets.length === 0 ? (
        <p className="mt-10 text-center text-sm text-muted-foreground">
          Nenhum orçamento criado.
        </p>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {budgets.map((b) => {
            const spent = spentByCat.get(b.category) ?? 0;
            const pct = b.limit > 0 ? Math.min((spent / b.limit) * 100, 100) : 0;
            const over = spent > b.limit;
            const warn = !over && b.limit > 0 && spent / b.limit > 0.8;
            const barColor = over ? "bg-destructive" : warn ? "bg-[oklch(0.78_0.15_85)]" : "bg-primary";
            return (
              <li key={b.id} className="rounded-2xl border border-border bg-card p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">
                      {b.name?.trim() || b.category}
                    </p>
                    {b.name?.trim() && (
                      <p className="truncate text-[11px] text-muted-foreground">{b.category}</p>
                    )}
                    <p className={`mt-0.5 text-sm font-semibold ${over ? "text-destructive" : "text-foreground"}`}>
                      {BRL(spent)}{" "}
                      <span className="text-xs font-normal text-muted-foreground">/ {BRL(b.limit)}</span>
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-0.5">
                    <button
                      onClick={() => setEditing(b)}
                      aria-label="Editar"
                      className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground hover:bg-accent"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => deleteBudget(b.id)}
                      aria-label="Excluir"
                      className="grid h-8 w-8 place-items-center rounded-md text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                  <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
                </div>
                {over && (
                  <p className="mt-2 text-xs font-medium text-destructive">
                    Limite ultrapassado em {BRL(spent - b.limit)}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <BudgetDialog
        open={creating}
        onOpenChange={setCreating}
        onSubmit={(d) => {
          addBudget(d);
          setCreating(false);
        }}
      />
      <BudgetDialog
        key={editing?.id ?? "none"}
        open={!!editing}
        onOpenChange={(v) => !v && setEditing(null)}
        initial={editing ?? undefined}
        onSubmit={(d) => {
          if (editing) updateBudget(editing.id, d);
          setEditing(null);
        }}
      />
      </AppShell>
    </ProtectedRoute>
  );
}

function BudgetDialog({
  open,
  onOpenChange,
  initial,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial?: Budget;
  onSubmit: (d: Omit<Budget, "id">) => void;
}) {
  const categories = useCategoriesList();
  const [name, setName] = useState(initial?.name ?? "");
  const [category, setCategory] = useState(initial?.category ?? "");
  const [limit, setLimit] = useState(initial ? String(initial.limit).replace(".", ",") : "");

  useEffect(() => {
    if (!open) return;
    setName(initial?.name ?? "");
    setCategory(initial?.category ?? "");
    setLimit(initial ? String(initial.limit).replace(".", ",") : "");
  }, [open, initial]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const v = parseFloat(limit.replace(",", "."));
    if (!category.trim() || !v) return;
    onSubmit({ category: category.trim(), limit: v, name: name.trim() || undefined });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm rounded-2xl">
        <DialogHeader>
          <DialogTitle>{initial ? "Editar orçamento" : "Criar orçamento"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="bname">Nomenclatura</Label>
            <Input
              id="bname"
              placeholder="Ex: Mercado do mês"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label>Categoria</Label>
            <CreatableSelect
              value={category}
              options={categories}
              onChange={setCategory}
              onCreate={(v) => addCategory(v)}
              placeholder="Ex: Urgências para o Chico"
            />
            <p className="text-[10px] text-muted-foreground">
              O gasto será calculado pelas transações com este nome exato de categoria.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="lim">Limite (R$)</Label>
            <Input
              id="lim"
              inputMode="decimal"
              placeholder="0,00"
              value={limit}
              onChange={(e) => setLimit(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button type="submit" className="w-full">
              {initial ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}