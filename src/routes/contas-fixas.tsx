import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Plus, Pencil, Trash2, Copy, CheckSquare, X, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/finance/AppShell";
import { FAB_CLASS } from "@/components/finance/fab-styles";
import {
  useFixedBills,
  addFixedBill,
  updateFixedBill,
  deleteFixedBill,
  deleteFixedBills,
  markFixedBillPaid,
  fixedBillsExistInMonth,
  lastMonthWithBills,
  copyFixedBillsFromMonth,
  useAccountsList,
  DEFAULT_PAYMENT_METHOD,
  BRL,
  MONTH_NAMES,
  FIXED_BILL_TEMPLATES,
  type FixedBill,
  type Account,
} from "@/lib/finance-store";
import { supabaseErrorMessage } from "@/lib/supabase/realtime-utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export const Route = createFileRoute("/contas-fixas")({
  head: () => ({ meta: [{ title: "Contas Fixas" }] }),
  component: ContasFixasPage,
});

type MonthKey = string; // `${year}-${month}`
const mkKey = (y: number, m: number) => `${y}-${m}`;

function paymentLabel(bill: FixedBill) {
  return bill.account?.trim() || DEFAULT_PAYMENT_METHOD;
}

type SituationFilter = "all" | "vencidos" | "a_vencer";
type PaymentFilter = "all" | "pago" | "pendente";
type SeparationFilter = "all" | "separado" | "nao_separado";

type FixedBillFilters = {
  situation: SituationFilter;
  payment: PaymentFilter;
  separation: SeparationFilter;
  paymentMethods: string[];
};

const DEFAULT_FIXED_BILL_FILTERS: FixedBillFilters = {
  situation: "all",
  payment: "all",
  separation: "all",
  paymentMethods: [],
};

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function getDueDate(bill: FixedBill) {
  const lastDay = new Date(bill.year, bill.month + 1, 0).getDate();
  const day = Math.min(Math.max(1, bill.dueDay), lastDay);
  return new Date(bill.year, bill.month, day);
}

function daysUntilDue(bill: FixedBill) {
  const due = startOfDay(getDueDate(bill));
  const today = startOfDay(new Date());
  return Math.round((due.getTime() - today.getTime()) / 86_400_000);
}

function isBillOverdue(bill: FixedBill) {
  return !bill.paid && daysUntilDue(bill) < 0;
}

function isBillUpcoming(bill: FixedBill) {
  return !bill.paid && daysUntilDue(bill) >= 0;
}

function applyFixedBillFilters(list: FixedBill[], filters: FixedBillFilters) {
  return list
    .filter((bill) => {
      if (filters.situation === "vencidos" && !isBillOverdue(bill)) return false;
      if (filters.situation === "a_vencer" && !isBillUpcoming(bill)) return false;
      if (filters.payment === "pago" && !bill.paid) return false;
      if (filters.payment === "pendente" && bill.paid) return false;
      if (filters.separation === "separado" && bill.separated !== "ok") return false;
      if (filters.separation === "nao_separado" && bill.separated !== "pendente") return false;
      if (
        filters.paymentMethods.length > 0 &&
        !filters.paymentMethods.includes(paymentLabel(bill))
      ) {
        return false;
      }
      return true;
    })
    .sort((a, b) => a.item.localeCompare(b.item, "pt-BR"));
}

function countActiveFilters(filters: FixedBillFilters) {
  return (
    (filters.situation !== "all" ? 1 : 0) +
    (filters.payment !== "all" ? 1 : 0) +
    (filters.separation !== "all" ? 1 : 0) +
    filters.paymentMethods.length
  );
}

function FixedBillStatusBadge({ bill }: { bill: FixedBill }) {
  if (bill.paid) {
    return (
      <Badge className="rounded-full border-emerald-200 bg-emerald-50 px-2 py-0 text-[10px] font-semibold text-emerald-700 hover:bg-emerald-50">
        Pago
      </Badge>
    );
  }

  const diff = daysUntilDue(bill);

  if (diff < 0) {
    return (
      <Badge
        variant="destructive"
        className="rounded-full px-2 py-0 text-[10px] font-semibold hover:bg-destructive"
      >
        Vencido
      </Badge>
    );
  }

  if (diff === 0) {
    return (
      <Badge className="rounded-full border-orange-200 bg-orange-50 px-2 py-0 text-[10px] font-semibold text-orange-700 hover:bg-orange-50">
        Vence hoje
      </Badge>
    );
  }

  return (
    <Badge className="rounded-full border-amber-200 bg-amber-50 px-2 py-0 text-[10px] font-semibold text-amber-800 hover:bg-amber-50">
      Vence em {diff} dias
    </Badge>
  );
}

function FixedBillsFiltersPopover({
  paymentMethods,
  filters,
  onChange,
}: {
  paymentMethods: string[];
  filters: FixedBillFilters;
  onChange: (filters: FixedBillFilters) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<FixedBillFilters>(filters);

  useEffect(() => {
    if (open) setDraft(filters);
  }, [open, filters]);

  const toggleMethod = (method: string) => {
    setDraft((prev) => ({
      ...prev,
      paymentMethods: prev.paymentMethods.includes(method)
        ? prev.paymentMethods.filter((m) => m !== method)
        : [...prev.paymentMethods, method],
    }));
  };

  const clearAll = () => {
    setDraft(DEFAULT_FIXED_BILL_FILTERS);
    onChange(DEFAULT_FIXED_BILL_FILTERS);
  };

  const apply = () => {
    onChange(draft);
    setOpen(false);
  };

  const activeCount = countActiveFilters(filters);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button size="sm" variant="outline" className="relative">
          <SlidersHorizontal className="h-3.5 w-3.5" /> Filtros
          {activeCount > 0 && (
            <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
              {activeCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 rounded-2xl p-4">
        <div className="space-y-4">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Situação
            </p>
            <div className="grid grid-cols-3 gap-1 rounded-xl bg-muted p-1">
              {(
                [
                  ["all", "Todos"],
                  ["vencidos", "Vencidos"],
                  ["a_vencer", "À vencer"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setDraft((prev) => ({ ...prev, situation: value }))}
                  className={`rounded-lg py-1.5 text-xs font-medium transition ${
                    draft.situation === value
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Pagamento
            </p>
            <div className="grid grid-cols-3 gap-1 rounded-xl bg-muted p-1">
              {(
                [
                  ["all", "Todos"],
                  ["pago", "Pago"],
                  ["pendente", "Pendente"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setDraft((prev) => ({ ...prev, payment: value }))}
                  className={`rounded-lg py-1.5 text-xs font-medium transition ${
                    draft.payment === value
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Separação
            </p>
            <div className="grid grid-cols-3 gap-1 rounded-xl bg-muted p-1">
              {(
                [
                  ["all", "Todos"],
                  ["separado", "Separado"],
                  ["nao_separado", "Não separado"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setDraft((prev) => ({ ...prev, separation: value }))}
                  className={`rounded-lg py-1.5 text-xs font-medium transition ${
                    draft.separation === value
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {paymentMethods.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Método / Conta
              </p>
              <div className="flex flex-wrap gap-1.5">
                {paymentMethods.map((method) => {
                  const on = draft.paymentMethods.includes(method);
                  return (
                    <button
                      key={method}
                      type="button"
                      onClick={() => toggleMethod(method)}
                      className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                        on
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-card text-foreground"
                      }`}
                    >
                      {method}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between pt-1">
            <Button variant="ghost" size="sm" onClick={clearAll}>
              Limpar
            </Button>
            <Button size="sm" onClick={apply}>
              Aplicar
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function ContasFixasPage() {
  const bills = useFixedBills();
  const accounts = useAccountsList();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<FixedBill | null>(null);
  const [bulkEdit, setBulkEdit] = useState<{ monthKey: MonthKey; focusCreate?: boolean } | null>(null);
  const [deleteMode, setDeleteMode] = useState<MonthKey | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [filters, setFilters] = useState<FixedBillFilters>(DEFAULT_FIXED_BILL_FILTERS);
  const [processingBillId, setProcessingBillId] = useState<string | null>(null);

  const grouped = useMemo(() => {
    const map = new Map<number, Map<number, FixedBill[]>>();
    [...bills]
      .sort((a, b) => b.year - a.year || b.month - a.month || a.item.localeCompare(b.item, "pt-BR"))
      .forEach((b) => {
        if (!map.has(b.year)) map.set(b.year, new Map());
        const ym = map.get(b.year)!;
        if (!ym.has(b.month)) ym.set(b.month, []);
        ym.get(b.month)!.push(b);
      });
    return map;
  }, [bills]);

  const yearKeys = useMemo(() => [...grouped.keys()], [grouped]);

  const handleMarkPaid = async (bill: FixedBill, paid: boolean) => {
    if (processingBillId !== null) return;
    setProcessingBillId(bill.id);
    try {
      await markFixedBillPaid(bill, paid);
      if (paid) toast.success(`${bill.item} marcado como pago`);
      else toast.success(`${bill.item} desmarcado`);
    } catch (err) {
      toast.error(supabaseErrorMessage(err));
    } finally {
      setProcessingBillId(null);
    }
  };

  return (
    <AppShell
      title="Contas Fixas"
      action={
      <button
        aria-label="Adicionar conta fixa"
        onClick={() => setCreating(true)}
        className={FAB_CLASS}
      >
        <Plus className="h-6 w-6" />
      </button>
    }
  >
      {grouped.size === 0 ? (
        <p className="mt-10 text-center text-sm text-muted-foreground">
          Nenhuma conta fixa cadastrada.
        </p>
      ) : (
        <TooltipProvider delayDuration={200}>
          <Accordion type="multiple" defaultValue={yearKeys.slice(0, 1).map(String)}>
            {[...grouped.entries()].map(([year, ym]) => (
              <AccordionItem key={year} value={String(year)} className="border-none mb-2">
                <AccordionTrigger className="rounded-lg bg-muted/40 px-3 py-2 text-base font-bold no-underline hover:no-underline">
                  {year}
                </AccordionTrigger>
                <AccordionContent>
                  <Accordion type="multiple" defaultValue={[...ym.keys()].slice(0, 1).map(String)}>
                    {[...ym.entries()].map(([m, list]) => {
                      const key = mkKey(year, m);
                      const isDeleting = deleteMode === key;
                      const monthPaymentMethods = [
                        ...new Set(list.map((b) => paymentLabel(b))),
                      ].sort((a, b) => a.localeCompare(b, "pt-BR"));
                      const filteredList = applyFixedBillFilters(list, filters);
                      const total = filteredList.reduce((s, b) => s + (b.amount ?? 0), 0);
                      return (
                        <AccordionItem key={m} value={String(m)} className="border-none">
                          <AccordionTrigger className="px-2 py-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground no-underline hover:no-underline">
                            <span className="flex-1 text-left">
                              {MONTH_NAMES[m]} <span className="ml-2 text-xs font-medium text-foreground">— {BRL(total)}</span>
                            </span>
                          </AccordionTrigger>
                          <AccordionContent>
                            <div className="mb-3 flex flex-wrap items-center gap-2">
                              <FixedBillsFiltersPopover
                                paymentMethods={monthPaymentMethods}
                                filters={filters}
                                onChange={setFilters}
                              />
                              <Button size="sm" variant="outline" onClick={() => setBulkEdit({ monthKey: key })}>
                                <Pencil className="h-3.5 w-3.5" /> Editar valores
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setBulkEdit({ monthKey: key, focusCreate: true })}
                              >
                                <Plus className="h-3.5 w-3.5" /> Adicionar novo custo
                              </Button>
                              {!isDeleting ? (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => { setDeleteMode(key); setSelectedIds([]); }}
                                >
                                  <Trash2 className="h-3.5 w-3.5" /> Excluir itens
                                </Button>
                              ) : (
                                <>
                                  <Button
                                    size="sm"
                                    variant="secondary"
                                    onClick={() =>
                                      setSelectedIds(
                                        selectedIds.length === filteredList.length
                                          ? []
                                          : filteredList.map((b) => b.id),
                                      )
                                    }
                                  >
                                    <CheckSquare className="h-3.5 w-3.5" />
                                    {selectedIds.length === filteredList.length && filteredList.length > 0
                                      ? "Desmarcar tudo"
                                      : "Selecionar tudo"}
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    disabled={selectedIds.length === 0}
                                    onClick={() => setConfirmDelete(true)}
                                  >
                                    <Trash2 className="h-3.5 w-3.5" /> Excluir selecionados ({selectedIds.length})
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => { setDeleteMode(null); setSelectedIds([]); }}
                                  >
                                    <X className="h-3.5 w-3.5" /> Cancelar
                                  </Button>
                                </>
                              )}
                            </div>
                            <div className="overflow-hidden rounded-2xl border border-border bg-card">
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    {isDeleting && <TableHead className="w-10" />}
                                    <TableHead>Item</TableHead>
                                    <TableHead className="text-right">Valor</TableHead>
                                    <TableHead className="text-center">Vence</TableHead>
                                    <TableHead className="text-center">Status</TableHead>
                                    <TableHead className="text-center">Sep.</TableHead>
                                    <TableHead className="text-center">Pago</TableHead>
                                    <TableHead>Pagamento</TableHead>
                                    <TableHead className="w-10" />
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {filteredList.length === 0 ? (
                                    <TableRow>
                                      <TableCell
                                        colSpan={isDeleting ? 9 : 8}
                                        className="py-8 text-center text-sm text-muted-foreground"
                                      >
                                        Nenhuma conta corresponde aos filtros selecionados.
                                      </TableCell>
                                    </TableRow>
                                  ) : (
                                    filteredList.map((b) => (
                                    <TableRow
                                      key={b.id}
                                      className={b.paid ? "bg-primary/5" : "bg-destructive/5"}
                                    >
                                      {isDeleting && (
                                        <TableCell>
                                          <Checkbox
                                            checked={selectedIds.includes(b.id)}
                                            onCheckedChange={(v) =>
                                              setSelectedIds((prev) =>
                                                v === true ? [...prev, b.id] : prev.filter((x) => x !== b.id),
                                              )
                                            }
                                          />
                                        </TableCell>
                                      )}
                                      <TableCell className="font-medium">{b.item}</TableCell>
                                      <TableCell
                                        className={`text-right font-semibold ${b.paid ? "text-primary" : "text-destructive"}`}
                                      >
                                        {BRL(b.amount)}
                                      </TableCell>
                                      <TableCell className="text-center text-xs text-muted-foreground">
                                        dia {String(b.dueDay).padStart(2, "0")}
                                      </TableCell>
                                      <TableCell className="text-center">
                                        <FixedBillStatusBadge bill={b} />
                                      </TableCell>
                                      <TableCell className="text-center">
                                        <span
                                          className={`text-[10px] font-semibold uppercase ${
                                            b.separated === "ok" ? "text-primary" : "text-amber-600"
                                          }`}
                                        >
                                          {b.separated === "ok" ? "OK" : "Pend."}
                                        </span>
                                      </TableCell>
                                      <TableCell className="text-center">
                                        {b.paid && b.paidAt ? (
                                          <Tooltip>
                                            <TooltipTrigger asChild>
                                              <span>
                                                <Checkbox
                                                  checked
                                                  disabled={processingBillId !== null}
                                                  onCheckedChange={(v) => handleMarkPaid(b, v === true)}
                                                />
                                              </span>
                                            </TooltipTrigger>
                                            <TooltipContent>
                                              Pago em {new Date(b.paidAt).toLocaleDateString("pt-BR")}
                                            </TooltipContent>
                                          </Tooltip>
                                        ) : (
                                          <Checkbox
                                            checked={b.paid}
                                            disabled={processingBillId !== null}
                                            onCheckedChange={(v) => handleMarkPaid(b, v === true)}
                                          />
                                        )}
                                      </TableCell>
                                      <TableCell className="text-xs text-muted-foreground">
                                        {paymentLabel(b)}
                                      </TableCell>
                                      <TableCell className="text-right">
                                        <button
                                          onClick={() => setEditing(b)}
                                          aria-label="Editar"
                                          className="grid h-7 w-7 place-items-center rounded text-muted-foreground hover:bg-accent"
                                        >
                                          <Pencil className="h-3.5 w-3.5" />
                                        </button>
                                      </TableCell>
                                    </TableRow>
                                  ))
                                  )}
                                  {filteredList.length > 0 && (
                                  <TableRow className="bg-muted/40">
                                    {isDeleting && <TableCell />}
                                    <TableCell className="text-xs font-semibold uppercase text-muted-foreground">
                                      Total custo fixo
                                    </TableCell>
                                    <TableCell className="text-right font-bold">{BRL(total)}</TableCell>
                                    <TableCell colSpan={6} />
                                  </TableRow>
                                  )}
                                </TableBody>
                              </Table>
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      );
                    })}
                  </Accordion>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </TooltipProvider>
      )}

      {creating && <AddFixedBillsDialog bills={bills} open onOpenChange={setCreating} />}
      {editing && (
        <EditFixedBillDialog
          open
          onOpenChange={(v) => !v && setEditing(null)}
          initial={editing}
          accounts={accounts}
          onClose={() => setEditing(null)}
        />
      )}
      {bulkEdit && (
        <BulkEditDialog
          monthKey={bulkEdit.monthKey}
          focusCreate={bulkEdit.focusCreate}
          onClose={() => setBulkEdit(null)}
          accounts={accounts}
          bills={bills.filter((b) => mkKey(b.year, b.month) === bulkEdit.monthKey)}
        />
      )}

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent className="max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle>Excluir itens?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Deseja realmente excluir esses {selectedIds.length} itens? Esta ação não pode ser desfeita.
          </p>
          <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-between">
            <Button variant="ghost" onClick={() => setConfirmDelete(false)}>Cancelar</Button>
            <Button
              variant="destructive"
              onClick={async () => {
                try {
                  await deleteFixedBills(selectedIds);
                  setSelectedIds([]);
                  setDeleteMode(null);
                  setConfirmDelete(false);
                  toast.success("Itens excluídos");
                } catch (err) {
                  toast.error(supabaseErrorMessage(err));
                }
              }}
            >
              <Trash2 className="h-4 w-4" /> Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

function AddFixedBillsDialog({
  bills,
  open,
  onOpenChange,
}: {
  bills: FixedBill[];
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [items, setItems] = useState<string[]>([]);
  const [customItem, setCustomItem] = useState("");
  const [saving, setSaving] = useState(false);

  const exists = useMemo(
    () => fixedBillsExistInMonth(bills, year, month),
    [bills, year, month],
  );
  const prev = useMemo(
    () => lastMonthWithBills(bills, year, month),
    [bills, year, month],
  );
  const allOn = items.length === FIXED_BILL_TEMPLATES.length && FIXED_BILL_TEMPLATES.every((t) => items.includes(t));

  const toggle = (item: string) => {
    setItems((prev) => prev.includes(item) ? prev.filter((i) => i !== item) : [...prev, item]);
  };

  const addCustom = () => {
    const v = customItem.trim();
    if (!v) return;
    if (!items.includes(v)) setItems([...items, v]);
    setCustomItem("");
  };

  const submit = async () => {
    if (items.length === 0) return;

    setSaving(true);
    try {
      for (const item of items) {
        await addFixedBill({
          year,
          month,
          item,
          amount: 0,
          dueDay: 5,
          separated: "pendente",
          paid: false,
          account: DEFAULT_PAYMENT_METHOD,
        });
      }
      onOpenChange(false);
      setItems([]);
      toast.success(`${items.length} conta(s) adicionada(s)`);
    } catch (err) {
      toast.error(supabaseErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const copyFromPrev = async () => {
    if (!prev) return;
    setSaving(true);
    try {
      await copyFixedBillsFromMonth(bills, prev, { year, month });
      toast.success(`Valores copiados de ${MONTH_NAMES[prev.month]}/${prev.year}`);
      onOpenChange(false);
    } catch (err) {
      toast.error(supabaseErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const allTemplates = useMemo(() => {
    const set = new Set([...FIXED_BILL_TEMPLATES, ...items]);
    return [...set];
  }, [items]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] w-[calc(100vw-2rem)] max-w-md flex-col overflow-hidden rounded-2xl p-0">
        <DialogHeader className="shrink-0 px-6 pt-6">
          <DialogTitle>Adicionar contas fixas</DialogTitle>
        </DialogHeader>
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-6 pb-2">
          <div className="grid w-full grid-cols-2 gap-3">
            <div className="min-w-0 space-y-1.5">
              <Label>Mês</Label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                value={month}
                onChange={(e) => setMonth(Number(e.target.value))}
              >
                {MONTH_NAMES.map((n, i) => (<option key={n} value={i}>{n}</option>))}
              </select>
            </div>
            <div className="min-w-0 space-y-1.5">
              <Label>Ano</Label>
              <Input type="number" className="w-full" value={year} onChange={(e) => setYear(Number(e.target.value))} />
            </div>
          </div>

          {exists && (
            <p className="break-words rounded-lg bg-muted px-3 py-2 text-xs font-medium text-muted-foreground">
              Este mês já possui contas. Novos itens serão adicionados à lista existente.
            </p>
          )}

          {!exists && prev && (
            <Button type="button" variant="outline" className="h-auto w-full whitespace-normal py-2 text-left" onClick={copyFromPrev} disabled={saving}>
              <Copy className="h-4 w-4 shrink-0" />
              <span className="break-words">
                Deseja usar os valores usados no último mês? ({MONTH_NAMES[prev.month]}/{prev.year})
              </span>
            </Button>
          )}

          <div className="flex w-full gap-2">
            <Input
              className="min-w-0 flex-1"
              placeholder="Novo item (ex: Academia)"
              value={customItem}
              onChange={(e) => setCustomItem(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustom(); } }}
            />
            <Button type="button" variant="secondary" className="shrink-0" onClick={addCustom}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          <button
            type="button"
            onClick={() => setItems(allOn ? [] : [...allTemplates])}
            className="w-full rounded-lg border border-border bg-card py-2 text-sm font-medium text-foreground transition hover:bg-accent"
          >
            {allOn ? "Desmarcar tudo" : "Selecionar tudo"}
          </button>

          <div className="max-h-[40vh] space-y-1 overflow-y-auto rounded-xl border border-border p-2">
            {allTemplates.map((item) => {
              const on = items.includes(item);
              return (
                <label
                  key={item}
                  className={`flex cursor-pointer items-center gap-2 rounded-lg p-2 text-sm transition ${
                    on ? "bg-accent text-foreground" : "text-foreground hover:bg-muted"
                  }`}
                >
                  <Checkbox checked={on} onCheckedChange={() => toggle(item)} />
                  <span className="min-w-0 flex-1 break-words">{item}</span>
                </label>
              );
            })}
          </div>
        </div>
        <DialogFooter className="shrink-0 border-t border-border px-6 py-4">
          <Button className="w-full" onClick={submit} disabled={items.length === 0 || saving}>
            {saving ? "Salvando..." : `Adicionar${items.length > 0 ? ` (${items.length})` : ""}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditFixedBillDialog({
  open,
  onOpenChange,
  initial,
  accounts,
  onClose,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial: FixedBill;
  accounts: Account[];
  onClose: () => void;
}) {
  const [item, setItem] = useState(initial.item);
  const [amount, setAmount] = useState(String(initial.amount).replace(".", ","));
  const [dueDay, setDueDay] = useState(initial.dueDay);
  const [separated, setSeparated] = useState<FixedBill["separated"]>(initial.separated);
  const [account, setAccount] = useState(initial.account ?? DEFAULT_PAYMENT_METHOD);

  useEffect(() => {
    setItem(initial.item);
    setAmount(String(initial.amount).replace(".", ","));
    setDueDay(initial.dueDay);
    setSeparated(initial.separated);
    setAccount(initial.account ?? DEFAULT_PAYMENT_METHOD);
  }, [initial]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const v = parseFloat(amount.replace(",", "."));
    try {
      await updateFixedBill(initial.id, {
        item: item.trim() || initial.item,
        amount: Number.isNaN(v) ? 0 : v,
        dueDay: Math.max(1, Math.min(31, dueDay || 1)),
        separated,
        account: account.trim() || DEFAULT_PAYMENT_METHOD,
      });
      toast.success("Conta fixa atualizada");
      onClose();
    } catch (err) {
      toast.error(supabaseErrorMessage(err));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm rounded-2xl">
        <DialogHeader>
          <DialogTitle>Editar conta fixa</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1.5">
            <Label>Item</Label>
            <Input value={item} onChange={(e) => setItem(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Valor (R$)</Label>
              <Input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Dia venc.</Label>
              <Input type="number" min={1} max={31} value={dueDay} onChange={(e) => setDueDay(Number(e.target.value))} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Método de pagamento</Label>
            <select
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
              value={account}
              onChange={(e) => setAccount(e.target.value)}
            >
              {accounts.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>Separado</Label>
            <div className="grid grid-cols-2 gap-1 rounded-xl bg-muted p-1">
              {(["ok", "pendente"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSeparated(s)}
                  className={`rounded-lg py-1.5 text-xs font-medium uppercase transition ${
                    separated === s ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
          <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-between">
            <Button type="button" variant="destructive" onClick={async () => {
              try {
                await deleteFixedBill(initial.id);
                toast.success("Conta fixa excluída");
                onClose();
              } catch (err) {
                toast.error(supabaseErrorMessage(err));
              }
            }}>
              <Trash2 className="h-4 w-4" /> Excluir
            </Button>
            <Button type="submit">Salvar</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function billToDraftEntry(b: FixedBill) {
  return {
    item: b.item,
    amount: String(b.amount).replace(".", ","),
    dueDay: String(b.dueDay),
    account: b.account ?? DEFAULT_PAYMENT_METHOD,
  };
}

function BulkEditDialog({
  monthKey,
  bills,
  accounts,
  focusCreate,
  onClose,
}: {
  monthKey: string;
  bills: FixedBill[];
  accounts: Account[];
  focusCreate?: boolean;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<
    Record<string, { item: string; amount: string; dueDay: string; account: string }>
  >(() => Object.fromEntries(bills.map((b) => [b.id, billToDraftEntry(b)])));

  const [showCreateForm, setShowCreateForm] = useState(focusCreate ?? false);
  const [newItem, setNewItem] = useState("");
  const [newAmount, setNewAmount] = useState("");
  const [newAccount, setNewAccount] = useState(DEFAULT_PAYMENT_METHOD);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    setDraft((prev) => {
      const next = { ...prev };
      for (const b of bills) {
        if (!next[b.id]) next[b.id] = billToDraftEntry(b);
      }
      for (const id of Object.keys(next)) {
        if (!bills.some((b) => b.id === id)) delete next[id];
      }
      return next;
    });
  }, [bills]);

  const [y, m] = monthKey.split("-").map(Number);

  const handleCreateCost = async () => {
    const name = newItem.trim();
    if (!name) {
      toast.error("Informe o nome do custo");
      return;
    }
    const amt = parseFloat(newAmount.replace(",", "."));
    setCreating(true);
    try {
      const created = await addFixedBill({
        year: y,
        month: m,
        item: name,
        amount: Number.isNaN(amt) ? 0 : amt,
        dueDay: 5,
        separated: "pendente",
        paid: false,
        account: newAccount.trim() || DEFAULT_PAYMENT_METHOD,
      });
      setDraft((prev) => ({ ...prev, [created.id]: billToDraftEntry(created) }));
      setNewItem("");
      setNewAmount("");
      setNewAccount(DEFAULT_PAYMENT_METHOD);
      toast.success(`"${name}" adicionado`);
    } catch (err) {
      toast.error(supabaseErrorMessage(err));
    } finally {
      setCreating(false);
    }
  };

  const save = async () => {
    try {
      await Promise.all(
        Object.entries(draft).map(([id, d]) => {
          const amt = parseFloat(d.amount.replace(",", "."));
          const due = parseInt(d.dueDay, 10);
          return updateFixedBill(id, {
            item: d.item.trim() || "—",
            amount: Number.isNaN(amt) ? 0 : amt,
            dueDay: Number.isNaN(due) ? 1 : Math.max(1, Math.min(31, due)),
            account: d.account.trim() || DEFAULT_PAYMENT_METHOD,
          });
        }),
      );
      toast.success("Valores atualizados");
      onClose();
    } catch (err) {
      toast.error(supabaseErrorMessage(err));
    }
  };

  const sortedBills = useMemo(
    () => [...bills].sort((a, b) => a.item.localeCompare(b.item, "pt-BR")),
    [bills],
  );

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="flex max-h-[90vh] w-[calc(100vw-2rem)] max-w-2xl flex-col overflow-hidden rounded-2xl p-0">
        <DialogHeader className="shrink-0 px-6 pt-6">
          <DialogTitle>Contas fixas — {MONTH_NAMES[m]}/{y}</DialogTitle>
        </DialogHeader>

        <div className="shrink-0 space-y-3 border-b border-border px-6 pb-4">
          {!showCreateForm ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => setShowCreateForm(true)}
            >
              <Plus className="h-3.5 w-3.5" /> Criar novo custo
            </Button>
          ) : (
            <div className="space-y-3 rounded-xl border border-border bg-muted/30 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Criar novo custo
              </p>
              <div className="space-y-1.5">
                <Label>Nome</Label>
                <Input
                  placeholder="Ex: Academia"
                  value={newItem}
                  onChange={(e) => setNewItem(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleCreateCost();
                    }
                  }}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Valor (R$)</Label>
                  <Input
                    inputMode="decimal"
                    placeholder="0,00"
                    value={newAmount}
                    onChange={(e) => setNewAmount(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Método de pagamento</Label>
                  <select
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                    value={newAccount}
                    onChange={(e) => setNewAccount(e.target.value)}
                  >
                    {accounts.map((a) => (
                      <option key={a} value={a}>
                        {a}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setShowCreateForm(false);
                    setNewItem("");
                    setNewAmount("");
                    setNewAccount(DEFAULT_PAYMENT_METHOD);
                  }}
                >
                  Cancelar
                </Button>
                <Button
                  type="button"
                  size="sm"
                  className="flex-1"
                  disabled={creating || !newItem.trim()}
                  onClick={handleCreateCost}
                >
                  {creating ? "Adicionando..." : "Adicionar à lista"}
                </Button>
              </div>
            </div>
          )}
        </div>

        <ScrollArea className="min-h-0 flex-1 px-6">
          <div className="py-4">
            {sortedBills.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Nenhuma conta neste mês. Use &quot;Criar novo custo&quot; acima para adicionar.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead className="w-32">Valor (R$)</TableHead>
                    <TableHead className="w-20">Dia</TableHead>
                    <TableHead className="w-36">Pagamento</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedBills.map((b) =>
                    draft[b.id] ? (
                      <TableRow key={b.id}>
                        <TableCell>
                          <Input
                            value={draft[b.id].item}
                            onChange={(e) =>
                              setDraft({ ...draft, [b.id]: { ...draft[b.id], item: e.target.value } })
                            }
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            inputMode="decimal"
                            value={draft[b.id].amount}
                            onChange={(e) =>
                              setDraft({ ...draft, [b.id]: { ...draft[b.id], amount: e.target.value } })
                            }
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min={1}
                            max={31}
                            value={draft[b.id].dueDay}
                            onChange={(e) =>
                              setDraft({ ...draft, [b.id]: { ...draft[b.id], dueDay: e.target.value } })
                            }
                          />
                        </TableCell>
                        <TableCell>
                          <select
                            className="flex h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm"
                            value={draft[b.id].account}
                            onChange={(e) =>
                              setDraft({ ...draft, [b.id]: { ...draft[b.id], account: e.target.value } })
                            }
                          >
                            {accounts.map((a) => (
                              <option key={a} value={a}>
                                {a}
                              </option>
                            ))}
                          </select>
                        </TableCell>
                      </TableRow>
                    ) : null,
                  )}
                </TableBody>
              </Table>
            )}
          </div>
        </ScrollArea>

        <DialogFooter className="shrink-0 border-t border-border px-6 py-4">
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={save} disabled={sortedBills.length === 0}>
            Salvar tudo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}