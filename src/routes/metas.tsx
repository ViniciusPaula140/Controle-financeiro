import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Plus, Pencil, Trash2, Trophy } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { AppShell } from "@/components/finance/AppShell";
import { FAB_CLASS } from "@/components/finance/fab-styles";
import { sanitizeAmountInput } from "@/lib/amount-input";
import { supabaseErrorMessage } from "@/lib/supabase/realtime-utils";
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
    <AppShell
      title="Metas"
      action={
        <button
          aria-label="Nova meta"
          onClick={() => { setEditing(null); setCreating(true); }}
          className={FAB_CLASS}
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
                      <button
                        onClick={async () => {
                          try {
                            await deleteGoal(g.id);
                            toast.success("Meta excluída com sucesso");
                          } catch (err) {
                            toast.error(supabaseErrorMessage(err));
                          }
                        }}
                        aria-label="Excluir"
                        className="grid h-8 w-8 place-items-center rounded-md text-destructive hover:bg-destructive/10"
                      >
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
          onSubmit={async (d) => {
            try {
              await addGoal(d);
              toast.success("Meta criada com sucesso");
              setCreating(false);
              setEditing(null);
            } catch (err) {
              toast.error(supabaseErrorMessage(err));
              throw err;
            }
          }}
        />
        <GoalDialog
          key={editing?.id ?? "none-edit"}
          open={!!editing && editing.id !== "__new__"}
          onOpenChange={(v) => !v && setEditing(null)}
          initial={editing && editing.id !== "__new__" ? editing : undefined}
          onSubmit={async (d) => {
            if (!editing || editing.id === "__new__") return;
            try {
              await updateGoal(editing.id, d);
              toast.success("Meta atualizada com sucesso");
              setEditing(null);
            } catch (err) {
              toast.error(supabaseErrorMessage(err));
              throw err;
            }
          }}
        />
      </AppShell>
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
  onSubmit: (d: Omit<Goal, "id">) => void | Promise<void>;
}) {
  const today = new Date();
  const [year, setYear] = useState(initial?.year ?? today.getFullYear());
  const [month, setMonth] = useState(initial?.month ?? today.getMonth());
  const [amount, setAmount] = useState(
    initial && initial.amount ? String(initial.amount).replace(".", ",") : "",
  );
  const [note, setNote] = useState(initial?.note ?? "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isSubmittingRef = useRef(false);

  useEffect(() => {
    if (!open) {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
      return;
    }
    setYear(initial?.year ?? today.getFullYear());
    setMonth(initial?.month ?? today.getMonth());
    setAmount(initial && initial.amount ? String(initial.amount).replace(".", ",") : "");
    setNote(initial?.note ?? "");
    isSubmittingRef.current = false;
    setIsSubmitting(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initial]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    setIsSubmitting(true);
    const v = parseFloat(amount.replace(",", "."));
    if (!amount.trim() || Number.isNaN(v) || v <= 0) {
      toast.error("Preencha todos os campos obrigatórios com valores válidos para criar a meta.");
      isSubmittingRef.current = false;
      setIsSubmitting(false);
      return;
    }
    try {
      await onSubmit({ year, month, amount: v, note: note.trim() || undefined });
    } catch {
      // erro exibido pelo handler pai
    } finally {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
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
            <Input id="gamt" inputMode="decimal" placeholder="0,00" value={amount} onChange={(e) => setAmount(sanitizeAmountInput(e.target.value))} autoFocus />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="gnote">Observação</Label>
            <Input id="gnote" placeholder="Opcional" value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          <DialogFooter>
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}