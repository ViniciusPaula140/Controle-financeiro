import { useEffect, useId, useMemo, useState } from "react";
import { Plus, Pencil, Trash2, Inbox, Loader2 } from "lucide-react";
import { toast } from "sonner";
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
  markReceivableReceived,
  deleteReceivable,
  BRL,
  MONTH_NAMES,
  type Receivable,
} from "@/lib/finance-store";
import { supabaseErrorMessage } from "@/lib/supabase/realtime-utils";
import { RECEIVABLE_ALREADY_RECEIVED_DELETE_MSG } from "@/lib/supabase/receivables";
import { sanitizeAmountInput } from "@/lib/amount-input";

export function ReceivablesSheet() {
  const items = useReceivables();
  const [editing, setEditing] = useState<Receivable | null>(null);
  const [creating, setCreating] = useState(false);
  const [isProcessing, setIsProcessing] = useState<string | null>(null);

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

  const totalPending = useMemo(
    () => items.filter((r) => !r.received).reduce((s, r) => s + (r.amount ?? 0), 0),
    [items],
  );

  const handleToggleReceived = async (r: Receivable, received: boolean) => {
    if (isProcessing !== null) return;
    setIsProcessing(r.id);
    try {
      await markReceivableReceived(r, received);
      if (received) {
        toast.success(`Recebimento registrado: ${r.name}`, { closeButton: true });
      } else {
        toast.success(`Recebimento desmarcado: ${r.name}`, { closeButton: true });
      }
    } catch (err) {
      toast.error(supabaseErrorMessage(err));
    } finally {
      setIsProcessing(null);
    }
  };

  const handleDelete = async (r: Receivable) => {
    if (isProcessing !== null) return;
    if (r.received) {
      toast.error(RECEIVABLE_ALREADY_RECEIVED_DELETE_MSG);
      return;
    }
    setIsProcessing(r.id);
    try {
      await deleteReceivable(r.id);
      toast.success("Recebível excluído com sucesso");
    } catch (err) {
      toast.error(supabaseErrorMessage(err));
    } finally {
      setIsProcessing(null);
    }
  };

  return (
    <>
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
          <SheetTitle>Dinheiro a receber</SheetTitle>
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
                                {isProcessing === r.id ? (
                                  <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
                                ) : r.received && r.receivedAt ? (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <span>
                                        <Checkbox
                                          checked
                                          disabled={isProcessing !== null}
                                          onCheckedChange={(v) => handleToggleReceived(r, v === true)}
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
                                    disabled={isProcessing !== null}
                                    onCheckedChange={(v) => handleToggleReceived(r, v === true)}
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
                                  disabled={isProcessing !== null}
                                  aria-label="Editar"
                                  className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-accent disabled:pointer-events-none disabled:opacity-50"
                                >
                                  <Pencil className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={() => handleDelete(r)}
                                  disabled={r.received || isProcessing !== null}
                                  aria-label="Excluir"
                                  className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-destructive hover:bg-destructive/10 disabled:pointer-events-none disabled:opacity-50"
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
      </SheetContent>
    </Sheet>

    <ReceivableDialog
      open={creating}
      onOpenChange={setCreating}
      onSubmit={async (d) => {
        try {
          await addReceivable(d);
          setCreating(false);
          toast.success("Recebimento criado com sucesso", { closeButton: true });
        } catch (err) {
          toast.error(supabaseErrorMessage(err));
        }
      }}
    />
    <ReceivableDialog
      key={editing?.id ?? "none"}
      open={!!editing}
      onOpenChange={(v) => !v && setEditing(null)}
      initial={editing ?? undefined}
      onSubmit={async (d) => {
        if (!editing) return;
        try {
          await updateReceivable(editing.id, d);
          setEditing(null);
          toast.success("Recebimento atualizado com sucesso", { closeButton: true });
        } catch (err) {
          toast.error(supabaseErrorMessage(err));
        }
      }}
    />
    </>
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
  onSubmit: (data: Omit<Receivable, "id">) => void | Promise<void>;
}) {
  const formId = useId();
  const [name, setName] = useState(initial?.name ?? "");
  const [amount, setAmount] = useState(initial ? String(initial.amount).replace(".", ",") : "");
  const [year, setYear] = useState(() => initial?.year ?? new Date().getFullYear());
  const [month, setMonth] = useState(() => initial?.month ?? new Date().getMonth());
  const [received, setReceived] = useState(initial?.received ?? false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    const now = new Date();
    setName(initial?.name ?? "");
    setAmount(initial ? String(initial.amount).replace(".", ",") : "");
    setYear(initial?.year ?? now.getFullYear());
    setMonth(initial?.month ?? now.getMonth());
    setReceived(initial?.received ?? false);
    setSaving(false);
  }, [open, initial]);

  const validateAndBuild = () => {
    const trimmedName = name.trim();
    const v = parseFloat(amount.replace(",", "."));
    if (!trimmedName) {
      toast.error("Informe o nome do recebimento.");
      return null;
    }
    if (!amount.trim() || Number.isNaN(v) || v <= 0) {
      toast.error("Informe um valor válido maior que zero.");
      return null;
    }
    return {
      name: trimmedName,
      amount: v,
      year,
      month,
      received,
      receivedAt: received ? initial?.receivedAt ?? new Date().toISOString() : undefined,
    } satisfies Omit<Receivable, "id">;
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = validateAndBuild();
    if (!payload) return;
    setSaving(true);
    try {
      await onSubmit(payload);
    } catch (err) {
      toast.error(supabaseErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="z-[100] flex max-h-[min(90dvh,100svh)] w-[calc(100vw-2rem)] max-w-sm flex-col overflow-hidden rounded-2xl p-0 sm:max-h-[85vh]">
        <DialogHeader className="shrink-0 px-6 pt-6 text-left">
          <DialogTitle>{initial ? "Editar recebimento" : "Novo recebimento"}</DialogTitle>
        </DialogHeader>
        <form
          id={formId}
          onSubmit={submit}
          className="flex min-h-0 flex-1 flex-col"
        >
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-6 pb-4">
            <div className="space-y-1.5">
              <Label htmlFor="rname">Nome</Label>
              <Input
                id="rname"
                placeholder="Ex: Salário 1"
                value={name}
                onChange={(e) => setName(e.target.value)}
                enterKeyHint="next"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ramt">Valor (R$)</Label>
              <Input
                id="ramt"
                inputMode="decimal"
                placeholder="0,00"
                value={amount}
                onChange={(e) => setAmount(sanitizeAmountInput(e.target.value))}
                enterKeyHint="done"
              />
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
          </div>
          <DialogFooter className="relative z-50 shrink-0 border-t border-border bg-background px-6 py-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
            <Button
              type="submit"
              className="relative z-50 w-full touch-manipulation"
              disabled={saving}
            >
              {saving ? "Salvando..." : initial ? "Salvar" : "Adicionar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
