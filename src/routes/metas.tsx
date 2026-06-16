import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Plus, Pencil, Trash2, Trophy } from "lucide-react";
import { z } from "zod";
import { AppShell } from "@/components/finance/AppShell";
import { ProtectedRoute } from "@/components/finance/ProtectedRoute";
import {
  useGoals,
  addGoal,
  updateGoal,
  deleteGoal,
  BRL,
  MONTH_NAMES,
  type Goal,
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

const search = z.object({ ym: z.string().optional() });

export const Route = createFileRoute("/metas")({
  head: () => ({ meta: [{ title: "Metas" }] }),
  validateSearch: (s) => search.parse(s),
  component: MetasPage,
});

function MetasPage() {
  const goals = useGoals();
  const navigate = useNavigate({ from: "/metas" });
  const { ym } = Route.useSearch();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Goal | null>(null);

  useEffect(() => {
    if (!ym) return;
    const [y, m] = ym.split("-").map(Number);
    if (!y || Number.isNaN(m)) return;
    const existing = goals.find((g) => g.year === y && g.month === m - 1);
    if (existing) setEditing(existing);
    else {
      setEditing({ id: "__new__", year: y, month: m - 1, amount: 0 });
      setCreating(true);
    }
    navigate({ search: {}, replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ym]);

  const grouped = useMemo(() => {
    const map = new Map<number, Goal[]>();
    [...goals]
      .sort((a, b) => b.year - a.year || b.month - a.month)
      .forEach((g) => {
        if (!map.has(g.year)) map.set(g.year, []);
        map.get(g.year)!.push(g);
      });
    return map;
  }, [goals]);

  return (
    <ProtectedRoute>
      <AppShell
        title="Metas"
        action={
          <button
            aria-label="Nova meta"
            onClick={() => { setEditing(null); setCreating(true); }}
            className="fixed bottom-4 left-4 z-30 grid h-14 w-14 place-items-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 transition-transform active:scale-95 md:left-auto md:right-8 md:bottom-8"
          >
            <Plus className="h-6 w-6" />
          </button>
        }
      >
        {grouped.size === 0 ? (
          <p className="mt-10 text-center text-sm text-muted-foreground">
            Nenhuma meta cadastrada.
          </p>
        ) : (
          <div className="space-y-5">
            {[...grouped.entries()].map(([year, list]) => (
              <div key={year}>
                <h3 className="mb-2 text-sm font-bold tracking-tight text-foreground">{year}</h3>
                <ul className="space-y-2">
                  {list.map((g) => (
                    <li key={g.id} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3">
                      <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-accent text-primary">
                        <Trophy className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-foreground">{MONTH_NAMES[g.month]}</p>
                        <p className="text-xs text-muted-foreground">{g.note ?? "Meta mensal"}</p>
                      </div>
                      <p className="shrink-0 text-sm font-semibold text-primary">{BRL(g.amount)}</p>
                      <button onClick={() => setEditing(g)} aria-label="Editar" className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground hover:bg-accent">
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button onClick={() => deleteGoal(g.id)} aria-label="Excluir" className="grid h-8 w-8 place-items-center rounded-md text-destructive hover:bg-destructive/10">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
        <GoalDialog
          open={creating}
          onOpenChange={(v) => { setCreating(v); if (!v) setEditing(null); }}
          initial={editing && editing.id === "__new__" ? editing : undefined}
          onSubmit={(d) => { addGoal(d); setCreating(false); setEditing(null); }}
        />
        <GoalDialog
          key={editing?.id ?? "none-edit"}
          open={!!editing && editing.id !== "__new__"}
          onOpenChange={(v) => !v && setEditing(null)}
          initial={editing && editing.id !== "__new__" ? editing : undefined}
          onSubmit={(d) => {
            if (editing && editing.id !== "__new__") updateGoal(editing.id, d);
            setEditing(null);
          }}
        />
      </AppShell>
    </ProtectedRoute>
  );
}

function GoalDialog({
  open,
  onOpenChange,
  initial,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial?: Goal;
  onSubmit: (d: Omit<Goal, "id">) => void;
}) {
  const today = new Date();
  const [year, setYear] = useState(initial?.year ?? today.getFullYear());
  const [month, setMonth] = useState(initial?.month ?? today.getMonth());
  const [amount, setAmount] = useState(
    initial && initial.amount ? String(initial.amount).replace(".", ",") : "",
  );
  const [note, setNote] = useState(initial?.note ?? "");

  useEffect(() => {
    if (!open) return;
    setYear(initial?.year ?? today.getFullYear());
    setMonth(initial?.month ?? today.getMonth());
    setAmount(initial && initial.amount ? String(initial.amount).replace(".", ",") : "");
    setNote(initial?.note ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initial]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const v = parseFloat(amount.replace(",", "."));
    if (!v) return;
    onSubmit({ year, month, amount: v, note: note || undefined });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm rounded-2xl">
        <DialogHeader>
          <DialogTitle>{initial && initial.id !== "__new__" ? "Editar meta" : "Nova meta"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Mês</Label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                value={month}
                onChange={(e) => setMonth(Number(e.target.value))}
              >
                {MONTH_NAMES.map((n, i) => (<option key={n} value={i}>{n}</option>))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Ano</Label>
              <Input type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="gamt">Valor da meta (R$)</Label>
            <Input id="gamt" inputMode="decimal" placeholder="0,00" value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="gnote">Observação</Label>
            <Input id="gnote" placeholder="Opcional" value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          <DialogFooter>
            <Button type="submit" className="w-full">Salvar</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}