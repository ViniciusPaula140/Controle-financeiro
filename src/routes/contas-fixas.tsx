import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Plus, Pencil, Trash2, Copy, Table as TableIcon, CheckSquare, X } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/finance/AppShell";
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
  BRL,
  MONTH_NAMES,
  FIXED_BILL_TEMPLATES,
  type FixedBill,
} from "@/lib/finance-store";
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

export const Route = createFileRoute("/contas-fixas")({
  head: () => ({ meta: [{ title: "Contas Fixas" }] }),
  component: ContasFixasPage,
});

type MonthKey = string; // `${year}-${month}`
const mkKey = (y: number, m: number) => `${y}-${m}`;

function ContasFixasPage() {
  const bills = useFixedBills();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<FixedBill | null>(null);
  const [bulkEditMonth, setBulkEditMonth] = useState<MonthKey | null>(null);
  const [deleteMode, setDeleteMode] = useState<MonthKey | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const grouped = useMemo(() => {
    const map = new Map<number, Map<number, FixedBill[]>>();
    [...bills]
      .sort((a, b) => b.year - a.year || b.month - a.month || a.dueDay - b.dueDay)
      .forEach((b) => {
        if (!map.has(b.year)) map.set(b.year, new Map());
        const ym = map.get(b.year)!;
        if (!ym.has(b.month)) ym.set(b.month, []);
        ym.get(b.month)!.push(b);
      });
    return map;
  }, [bills]);

  const yearKeys = [...grouped.keys()];

  return (
    <AppShell
      title="Contas Fixas"
      action={
        <button
          aria-label="Adicionar conta fixa"
          onClick={() => setCreating(true)}
          className="fixed bottom-24 left-[max(1.25rem,calc(50vw-13.5rem))] z-30 grid h-14 w-14 place-items-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 active:scale-95"
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
                      const total = list.reduce((s, b) => s + b.amount, 0);
                      const key = mkKey(year, m);
                      const isDeleting = deleteMode === key;
                      return (
                        <AccordionItem key={m} value={String(m)} className="border-none">
                          <AccordionTrigger className="px-2 py-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground no-underline hover:no-underline">
                            <span className="flex-1 text-left">
                              {MONTH_NAMES[m]} <span className="ml-2 text-xs font-medium text-foreground">— {BRL(total)}</span>
                            </span>
                          </AccordionTrigger>
                          <AccordionContent>
                            <div className="mb-3 flex flex-wrap items-center gap-2">
                              <Button size="sm" variant="outline" onClick={() => setBulkEditMonth(key)}>
                                <TableIcon className="h-3.5 w-3.5" /> Editar Valores
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
                                        selectedIds.length === list.length ? [] : list.map((b) => b.id),
                                      )
                                    }
                                  >
                                    <CheckSquare className="h-3.5 w-3.5" />
                                    {selectedIds.length === list.length ? "Desmarcar tudo" : "Selecionar tudo"}
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
                                    <TableHead className="text-center">Sep.</TableHead>
                                    <TableHead className="text-center">Pago</TableHead>
                                    <TableHead className="w-10" />
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {list.map((b) => (
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
                                                  onCheckedChange={(v) => markFixedBillPaid(b.id, v === true)}
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
                                            onCheckedChange={(v) => markFixedBillPaid(b.id, v === true)}
                                          />
                                        )}
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
                                  ))}
                                  <TableRow className="bg-muted/40">
                                    {isDeleting && <TableCell />}
                                    <TableCell className="text-xs font-semibold uppercase text-muted-foreground">
                                      Total custo fixo
                                    </TableCell>
                                    <TableCell className="text-right font-bold">{BRL(total)}</TableCell>
                                    <TableCell colSpan={4} />
                                  </TableRow>
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

      {creating && <AddFixedBillsDialog open onOpenChange={setCreating} />}
      {editing && (
        <EditFixedBillDialog
          open
          onOpenChange={(v) => !v && setEditing(null)}
          initial={editing}
          onClose={() => setEditing(null)}
        />
      )}
      {bulkEditMonth && (
        <BulkEditDialog
          monthKey={bulkEditMonth}
          onClose={() => setBulkEditMonth(null)}
          bills={bills.filter((b) => mkKey(b.year, b.month) === bulkEditMonth)}
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
              onClick={() => {
                deleteFixedBills(selectedIds);
                setSelectedIds([]);
                setDeleteMode(null);
                setConfirmDelete(false);
                toast.success("Itens excluídos");
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

function AddFixedBillsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [items, setItems] = useState<string[]>([]);
  const [customItem, setCustomItem] = useState("");

  const exists = fixedBillsExistInMonth(year, month);
  const prev = lastMonthWithBills(year, month);
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

  const submit = () => {
    if (exists) {
      toast.error("Já existem contas fixas criadas para este mês");
      return;
    }
    items.forEach((item) => {
      addFixedBill({
        year, month, item,
        amount: 0, dueDay: 5,
        separated: "pendente", paid: false,
      });
    });
    onOpenChange(false);
    setItems([]);
    toast.success(`${items.length} conta(s) adicionada(s)`);
  };

  const copyFromPrev = () => {
    if (!prev) return;
    copyFixedBillsFromMonth(prev, { year, month });
    toast.success(`Valores copiados de ${MONTH_NAMES[prev.month]}/${prev.year}`);
    onOpenChange(false);
  };

  const allTemplates = useMemo(() => {
    const set = new Set([...FIXED_BILL_TEMPLATES, ...items]);
    return [...set];
  }, [items]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle>Adicionar contas fixas</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
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

          {exists && (
            <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive">
              Já existem contas fixas criadas para este mês.
            </p>
          )}

          {!exists && prev && (
            <Button type="button" variant="outline" className="w-full" onClick={copyFromPrev}>
              <Copy className="h-4 w-4" />
              Deseja usar os valores usados no último mês? ({MONTH_NAMES[prev.month]}/{prev.year})
            </Button>
          )}

          <div className="flex gap-2">
            <Input
              placeholder="Novo item (ex: Academia)"
              value={customItem}
              onChange={(e) => setCustomItem(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustom(); } }}
            />
            <Button type="button" variant="secondary" onClick={addCustom}>
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

          <div className="max-h-60 space-y-1 overflow-y-auto rounded-xl border border-border p-2">
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
                  <span className="flex-1">{item}</span>
                </label>
              );
            })}
          </div>
        </div>
        <DialogFooter>
          <Button className="w-full" onClick={submit} disabled={items.length === 0 || exists}>
            Adicionar {items.length > 0 && `(${items.length})`}
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
  onClose,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial: FixedBill;
  onClose: () => void;
}) {
  const [item, setItem] = useState(initial.item);
  const [amount, setAmount] = useState(String(initial.amount).replace(".", ","));
  const [dueDay, setDueDay] = useState(initial.dueDay);
  const [separated, setSeparated] = useState<FixedBill["separated"]>(initial.separated);

  useEffect(() => {
    setItem(initial.item);
    setAmount(String(initial.amount).replace(".", ","));
    setDueDay(initial.dueDay);
    setSeparated(initial.separated);
  }, [initial]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const v = parseFloat(amount.replace(",", "."));
    updateFixedBill(initial.id, {
      item: item.trim() || initial.item,
      amount: Number.isNaN(v) ? 0 : v,
      dueDay: Math.max(1, Math.min(31, dueDay || 1)),
      separated,
    });
    onClose();
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
            <Button type="button" variant="destructive" onClick={() => { deleteFixedBill(initial.id); onClose(); }}>
              <Trash2 className="h-4 w-4" /> Excluir
            </Button>
            <Button type="submit">Salvar</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function BulkEditDialog({
  monthKey,
  bills,
  onClose,
}: {
  monthKey: string;
  bills: FixedBill[];
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<Record<string, { item: string; amount: string; dueDay: string }>>(() =>
    Object.fromEntries(
      bills.map((b) => [b.id, { item: b.item, amount: String(b.amount).replace(".", ","), dueDay: String(b.dueDay) }]),
    ),
  );

  const save = () => {
    Object.entries(draft).forEach(([id, d]) => {
      const amt = parseFloat(d.amount.replace(",", "."));
      const due = parseInt(d.dueDay, 10);
      updateFixedBill(id, {
        item: d.item.trim() || "—",
        amount: Number.isNaN(amt) ? 0 : amt,
        dueDay: Number.isNaN(due) ? 1 : Math.max(1, Math.min(31, due)),
      });
    });
    toast.success("Valores atualizados");
    onClose();
  };

  const [y, m] = monthKey.split("-").map(Number);

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl rounded-2xl">
        <DialogHeader>
          <DialogTitle>Editar valores — {MONTH_NAMES[m]}/{y}</DialogTitle>
        </DialogHeader>
        <div className="max-h-[60vh] overflow-y-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead className="w-32">Valor (R$)</TableHead>
                <TableHead className="w-20">Dia</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {bills.map((b) => (
                <TableRow key={b.id}>
                  <TableCell>
                    <Input
                      value={draft[b.id].item}
                      onChange={(e) => setDraft({ ...draft, [b.id]: { ...draft[b.id], item: e.target.value } })}
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      inputMode="decimal"
                      value={draft[b.id].amount}
                      onChange={(e) => setDraft({ ...draft, [b.id]: { ...draft[b.id], amount: e.target.value } })}
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      min={1}
                      max={31}
                      value={draft[b.id].dueDay}
                      onChange={(e) => setDraft({ ...draft, [b.id]: { ...draft[b.id], dueDay: e.target.value } })}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={save}>Salvar tudo</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}