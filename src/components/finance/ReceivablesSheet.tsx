import { useMemo, useState } from "react";
import { Plus, Pencil, Trash2, Inbox } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  useReceivables,
  addReceivable,
  updateReceivable,
  deleteReceivable,
  BRL,
  MONTH_NAMES,
  type Receivable,
} from "@/lib/finance-store";

export function ReceivablesSheet() {
  const items = useReceivables();
  const [editing, setEditing] = useState<Receivable | null>(null);
  const [creating, setCreating] = useState(false);

  const grouped = useMemo(() => {
    const map = new Map<number, Map<number, Receivable[]>>();
    [...items]
      .sort((a, b) => b.year - a.year || b.month - a.month || a.name.localeCompare(b.name))
      .forEach((r) => {
        if (!map.has(r.year)) map.set(r.year, new Map());
        const ym = map.get(r.year)!;
        if (!ym.has(r.month)) ym.set(r.month, []);
        ym.get(r.month)!.push(r);
      });
    return map;
  }, [items]);

  const totalPending = items.filter((r) => !r.received).reduce((s, r) => s + r.amount, 0);

  return (
    <Sheet>
      <TooltipProvider delayDuration={200}>
        <Tooltip>
          <TooltipTrigger asChild>
            <SheetTrigger asChild>
              <button
                aria-label="Dinheiro a receber"
                className="relative grid h-9 w-9 place-items-center rounded-full bg-accent text-accent-foreground transition active:scale-95"
              >
                <Inbox className="h-4 w-4" />
                {items.some((r) => !r.received) && (
                  <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-primary ring-2 ring-background" />
                )}
              </button>
            </SheetTrigger>
          </TooltipTrigger>
          <TooltipContent>Dinheiro a receber</TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <SheetContent side="right" className="w-full max-w-md overflow-y-auto p-0">
        <SheetHeader className="border-b border-border p-5 text-left">
          <SheetTitle>Dinheiro a Receber</SheetTitle>
          <p className="text-xs text-muted-foreground">
            Pendente: <span className="font-semibold text-primary">{BRL(totalPending)}</span>
          </p>
        </SheetHeader>

        <div className="p-5">
          <Button className="mb-4 w-full" onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" /> Novo recebimento
          </Button>

          {grouped.size === 0 ? (
            <p className="mt-10 text-center text-sm text-muted-foreground">
              Nenhum recebimento cadastrado.
            </p>
          ) : (
            <TooltipProvider delayDuration={200}>
              <Accordion type="multiple" defaultValue={[...grouped.keys()].slice(0, 1).map(String)}>
                {[...grouped.entries()].map(([year, ym]) => (
                  <AccordionItem key={year} value={String(year)} className="border-none">
                    <AccordionTrigger className="rounded-lg bg-muted/40 px-3 py-2 text-sm font-bold no-underline hover:no-underline">
                      {year}
                    </AccordionTrigger>
                    <AccordionContent>
                      <Accordion type="multiple" defaultValue={[...ym.keys()].slice(0, 1).map(String)}>
                        {[...ym.entries()].map(([m, list]) => (
                          <AccordionItem key={m} value={String(m)} className="border-none">
                            <AccordionTrigger className="px-2 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground no-underline hover:no-underline">
                              {MONTH_NAMES[m]}
                            </AccordionTrigger>
                            <AccordionContent>
                              <ul className="space-y-1.5">
                            {list.map((r) => (
                              <li
                                key={r.id}
                                className="flex items-center gap-2 rounded-xl border border-border bg-card p-3"
                              >
                                {r.received && r.receivedAt ? (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <span>
                                        <Checkbox
                                          checked
                                          onCheckedChange={(v) =>
                                            updateReceivable(r.id, {
                                              received: v === true,
                                              receivedAt: v === true ? r.receivedAt : undefined,
                                            })
                                          }
                                        />
                                      </span>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      Checklist marcado dia{" "}
                                      {new Date(r.receivedAt).toLocaleDateString("pt-BR")}
                                    </TooltipContent>
                                  </Tooltip>
                                ) : (
                                  <Checkbox
                                    checked={r.received}
                                    onCheckedChange={(v) =>
                                      updateReceivable(r.id, {
                                        received: v === true,
                                        receivedAt:
                                          v === true ? new Date().toISOString() : undefined,
                                      })
                                    }
                                  />
                                )}
                                <div className="min-w-0 flex-1">
                                  <p
                                    className={`truncate text-sm font-medium ${
                                      r.received ? "text-muted-foreground line-through" : "text-foreground"
                                    }`}
                                  >
                                    {r.name}
                                  </p>
                                  <p className="text-xs font-semibold text-primary">{BRL(r.amount)}</p>
                                </div>
                                <button
                                  onClick={() => setEditing(r)}
                                  aria-label="Editar"
                                  className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground hover:bg-accent"
                                >
                                  <Pencil className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={() => deleteReceivable(r.id)}
                                  aria-label="Excluir"
                                  className="grid h-8 w-8 place-items-center rounded-md text-destructive hover:bg-destructive/10"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </li>
                            ))}
                              </ul>
                            </AccordionContent>
                          </AccordionItem>
                        ))}
                      </Accordion>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </TooltipProvider>
          )}
        </div>

        <ReceivableDialog
          open={creating}
          onOpenChange={setCreating}
          onSubmit={(d) => {
            addReceivable(d);
            setCreating(false);
          }}
        />
        <ReceivableDialog
          key={editing?.id ?? "none"}
          open={!!editing}
          onOpenChange={(v) => !v && setEditing(null)}
          initial={editing ?? undefined}
          onSubmit={(d) => {
            if (editing) updateReceivable(editing.id, d);
            setEditing(null);
          }}
        />
      </SheetContent>
    </Sheet>
  );
}

function ReceivableDialog({
  open,
  onOpenChange,
  initial,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial?: Receivable;
  onSubmit: (data: Omit<Receivable, "id">) => void;
}) {
  const today = new Date();
  const [name, setName] = useState(initial?.name ?? "");
  const [amount, setAmount] = useState(initial ? String(initial.amount).replace(".", ",") : "");
  const [year, setYear] = useState(initial?.year ?? today.getFullYear());
  const [month, setMonth] = useState(initial?.month ?? today.getMonth());
  const [received, setReceived] = useState(initial?.received ?? false);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const v = parseFloat(amount.replace(",", "."));
    if (!name.trim() || !v) return;
    onSubmit({
      name: name.trim(),
      amount: v,
      year,
      month,
      received,
      receivedAt: received ? initial?.receivedAt ?? new Date().toISOString() : undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm rounded-2xl">
        <DialogHeader>
          <DialogTitle>{initial ? "Editar recebimento" : "Novo recebimento"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="rname">Nome</Label>
            <Input id="rname" placeholder="Ex: Salário 1" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ramt">Valor (R$)</Label>
            <Input id="ramt" inputMode="decimal" placeholder="0,00" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Mês</Label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                value={month}
                onChange={(e) => setMonth(Number(e.target.value))}
              >
                {MONTH_NAMES.map((n, i) => (
                  <option key={n} value={i}>{n}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Ano</Label>
              <Input type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={received} onCheckedChange={(v) => setReceived(v === true)} />
            Já recebido
          </label>
          <DialogFooter>
            <Button type="submit" className="w-full">{initial ? "Salvar" : "Adicionar"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}