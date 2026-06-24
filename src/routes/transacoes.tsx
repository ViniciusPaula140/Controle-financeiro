import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Utensils,
  Home,
  Car,
  Sparkles,
  HeartPulse,
  Wallet,
  Tag,
  SlidersHorizontal,
  Search,
  X,
  Pencil,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import { AppShell } from "@/components/finance/AppShell";
import { AddTransactionDialog } from "@/components/finance/AddTransactionDialog";
import { toast } from "sonner";
import { supabaseErrorMessage } from "@/lib/supabase/realtime-utils";
import {
  useTransactions,
  deleteTransaction,
  deleteTransactionsBulk,
  findReceivableByTransactionId,
  findReceivablesByTransactionIds,
  useCategoriesList,
  useAccountsList,
  BRL,
  MONTH_NAMES,
  type Category,
  type Account,
  type Transaction,
} from "@/lib/finance-store";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type ConfirmAction =
  | { type: "edit"; transaction: Transaction }
  | { type: "delete"; transaction: Transaction; itemName: string }
  | { type: "bulk-delete"; ids: string[]; linkedCount: number };

export const Route = createFileRoute("/transacoes")({
  head: () => ({ meta: [{ title: "Transações" }] }),
  component: TransacoesPage,
});

const icons: Record<Category, LucideIcon> = {
  Alimentação: Utensils,
  Moradia: Home,
  Transporte: Car,
  Lazer: Sparkles,
  Saúde: HeartPulse,
  Salário: Wallet,
  Outros: Tag,
};

type TypeFilter = "all" | "income" | "expense";

function txLocalParts(iso: string) {
  const d = new Date(iso);
  return { year: d.getFullYear(), month: d.getMonth() };
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

function TransacoesPage() {
  const transactions = useTransactions();
  const allCategories = useCategoriesList();
  const allAccounts = useAccountsList();

  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [selectedCats, setSelectedCats] = useState<Category[]>([]);
  const [selectedAccs, setSelectedAccs] = useState<Account[]>([]);
  const [selectedYears, setSelectedYears] = useState<number[]>([]);
  const [selectedMonths, setSelectedMonths] = useState<number[]>([]);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Transaction | null>(null);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectionMode, setSelectionMode] = useState(false);

  const uiLocked = isProcessing || !!confirmAction;

  const handleSelectTransaction = (t: Transaction) => {
    if (uiLocked) return;
    setSelected(t);
  };

  const toggleRowSelect = (id: string, checked: boolean) => {
    if (uiLocked) return;
    setSelectedIds((prev) =>
      checked ? (prev.includes(id) ? prev : [...prev, id]) : prev.filter((x) => x !== id),
    );
  };

  const handleBulkDeleteRequest = async () => {
    if (uiLocked || selectedIds.length === 0) return;
    setIsProcessing(true);
    try {
      const linked = await findReceivablesByTransactionIds(selectedIds);
      setConfirmAction({
        type: "bulk-delete",
        ids: selectedIds,
        linkedCount: linked.length,
      });
    } catch (err) {
      toast.error(supabaseErrorMessage(err));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConfirmBulkDelete = async () => {
    if (confirmAction?.type !== "bulk-delete" || isProcessing) return;
    setIsProcessing(true);
    try {
      await deleteTransactionsBulk(confirmAction.ids);
      toast.success("Transações excluídas com sucesso");
      setSelectedIds([]);
      setSelected(null);
      setConfirmAction(null);
    } catch (err) {
      toast.error(supabaseErrorMessage(err));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleEditRequest = async (t: Transaction) => {
    if (isProcessing || confirmAction) return;
    setIsProcessing(true);
    try {
      const receivable = await findReceivableByTransactionId(t.id);
      if (receivable) {
        setSelected(null);
        setConfirmAction({ type: "edit", transaction: t });
      } else {
        setSelected(null);
        setEditing(t);
      }
    } catch (err) {
      toast.error(supabaseErrorMessage(err));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteRequest = async (t: Transaction) => {
    if (isProcessing || confirmAction) return;
    setIsProcessing(true);
    try {
      const receivable = await findReceivableByTransactionId(t.id);
      if (receivable) {
        const itemName = t.description?.trim() || receivable.name || t.category;
        setSelected(null);
        setConfirmAction({ type: "delete", transaction: t, itemName });
      } else {
        await deleteTransaction(t.id);
        toast.success("Transação excluída com sucesso");
        setSelected(null);
      }
    } catch (err) {
      toast.error(supabaseErrorMessage(err));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConfirmEdit = () => {
    if (confirmAction?.type !== "edit") return;
    setEditing(confirmAction.transaction);
    setConfirmAction(null);
  };

  const handleConfirmDelete = async () => {
    if (confirmAction?.type !== "delete" || isProcessing) return;
    const { transaction } = confirmAction;
    setIsProcessing(true);
    try {
      await deleteTransaction(transaction.id);
      toast.success("Transação excluída com sucesso");
      setSelected(null);
      setConfirmAction(null);
    } catch (err) {
      toast.error(supabaseErrorMessage(err));
    } finally {
      setIsProcessing(false);
    }
  };

  const availableYears = useMemo(
    () =>
      [...new Set(transactions.map((t) => txLocalParts(t.date).year))].sort((a, b) => b - a),
    [transactions],
  );

  const availableMonths = useMemo(() => {
    const source =
      selectedYears.length > 0
        ? transactions.filter((t) => selectedYears.includes(txLocalParts(t.date).year))
        : transactions;
    return [...new Set(source.map((t) => txLocalParts(t.date).month))].sort((a, b) => a - b);
  }, [transactions, selectedYears]);

  const toggle = <T,>(value: T, list: T[], set: (v: T[]) => void) => {
    set(list.includes(value) ? list.filter((x) => x !== value) : [...list, value]);
  };

  const clearFilterSelections = () => {
    setTypeFilter("all");
    setSelectedCats([]);
    setSelectedAccs([]);
    setSelectedYears([]);
    setSelectedMonths([]);
  };

  const activeCount =
    (typeFilter !== "all" ? 1 : 0) +
    selectedCats.length +
    selectedAccs.length +
    selectedYears.length +
    selectedMonths.length;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return [...transactions]
      .filter((t) => {
        if (typeFilter !== "all" && t.type !== typeFilter) return false;
        if (selectedCats.length && !selectedCats.includes(t.category)) return false;
        if (selectedAccs.length && !selectedAccs.includes(t.account)) return false;
        const { year, month } = txLocalParts(t.date);
        if (selectedYears.length && !selectedYears.includes(year)) return false;
        if (selectedMonths.length && !selectedMonths.includes(month)) return false;
        if (q) {
          const hay = `${t.description ?? ""} ${t.category} ${t.account}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [transactions, query, typeFilter, selectedCats, selectedAccs, selectedYears, selectedMonths]);

  const filteredIds = useMemo(() => filtered.map((t) => t.id), [filtered]);

  const handleSelectAllVisible = () => {
    if (uiLocked) return;
    setSelectedIds(filteredIds);
  };

  const handleClearSelection = () => {
    if (uiLocked) return;
    setSelectedIds([]);
  };

  const handleCloseSelection = () => {
    if (uiLocked) return;
    setSelectionMode(false);
    setSelectedIds([]);
  };

  return (
    <AppShell title="Transações" action={<AddTransactionDialog />}>
      <div className="mb-3 flex items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar..."
            className="pl-9"
          />
        </div>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <button
              aria-label="Filtros"
              className="relative grid h-10 w-10 shrink-0 place-items-center rounded-md border border-input bg-card text-foreground"
            >
              <SlidersHorizontal className="h-4 w-4" />
              {activeCount > 0 && (
                <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                  {activeCount}
                </span>
              )}
            </button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-72 overflow-hidden rounded-2xl p-0">
            <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
              <Button
                variant="outline"
                size="sm"
                className="h-9 px-3 font-semibold touch-manipulation"
                onClick={clearFilterSelections}
              >
                Limpar
              </Button>
              <button
                type="button"
                aria-label="Fechar filtros"
                className="grid h-9 w-9 shrink-0 place-items-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground touch-manipulation"
                onClick={() => setOpen(false)}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="max-h-[60vh] space-y-4 overflow-y-auto overscroll-contain p-4 touch-pan-y">
              {availableYears.length > 0 && (
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Ano
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {availableYears.map((y) => {
                      const on = selectedYears.includes(y);
                      return (
                        <button
                          key={y}
                          type="button"
                          onClick={() => toggle(y, selectedYears, setSelectedYears)}
                          className={`rounded-full border px-3 py-1.5 text-xs font-medium transition touch-manipulation ${
                            on
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-border bg-card text-foreground"
                          }`}
                        >
                          {y}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {availableMonths.length > 0 && (
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Mês
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {availableMonths.map((m) => {
                      const on = selectedMonths.includes(m);
                      return (
                        <button
                          key={m}
                          type="button"
                          onClick={() => toggle(m, selectedMonths, setSelectedMonths)}
                          className={`rounded-full border px-3 py-1.5 text-xs font-medium transition touch-manipulation ${
                            on
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-border bg-card text-foreground"
                          }`}
                        >
                          {MONTH_NAMES[m]}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Tipo
                </p>
                <div className="grid grid-cols-3 gap-1 rounded-xl bg-muted p-1">
                  {(["all", "income", "expense"] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setTypeFilter(t)}
                      className={`rounded-lg py-1.5 text-xs font-medium transition touch-manipulation ${
                        typeFilter === t
                          ? "bg-card text-foreground shadow-sm"
                          : "text-muted-foreground"
                      }`}
                    >
                      {t === "all" ? "Todos" : t === "income" ? "Receita" : "Despesa"}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Categorias
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {allCategories.map((c) => {
                    const on = selectedCats.includes(c);
                    return (
                      <button
                        key={c}
                        type="button"
                        onClick={() => toggle(c, selectedCats, setSelectedCats)}
                        className={`rounded-full border px-3 py-1.5 text-xs font-medium transition touch-manipulation ${
                          on
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border bg-card text-foreground"
                        }`}
                      >
                        {c}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Contas
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {allAccounts.map((a) => {
                    const on = selectedAccs.includes(a);
                    return (
                      <button
                        key={a}
                        type="button"
                        onClick={() => toggle(a, selectedAccs, setSelectedAccs)}
                        className={`rounded-full border px-3 py-1.5 text-xs font-medium transition touch-manipulation ${
                          on
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border bg-card text-foreground"
                        }`}
                      >
                        {a}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {activeCount > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-1.5">
          {typeFilter !== "all" && (
            <FilterChip
              label={typeFilter === "income" ? "Receitas" : "Despesas"}
              onClear={() => setTypeFilter("all")}
            />
          )}
          {selectedCats.map((c) => (
            <FilterChip
              key={c}
              label={c}
              onClear={() => toggle(c, selectedCats, setSelectedCats)}
            />
          ))}
          {selectedYears.map((y) => (
            <FilterChip
              key={`y-${y}`}
              label={String(y)}
              onClear={() => toggle(y, selectedYears, setSelectedYears)}
            />
          ))}
          {selectedMonths.map((m) => (
            <FilterChip
              key={`m-${m}`}
              label={MONTH_NAMES[m]}
              onClear={() => toggle(m, selectedMonths, setSelectedMonths)}
            />
          ))}
          {selectedAccs.map((a) => (
            <FilterChip
              key={a}
              label={a}
              onClear={() => toggle(a, selectedAccs, setSelectedAccs)}
            />
          ))}
        </div>
      )}

      {filtered.length === 0 ? (
        <p className="mt-10 text-center text-sm text-muted-foreground">
          Nenhuma transação encontrada.
        </p>
      ) : (
        <>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            {!selectionMode ? (
              <Button
                variant="outline"
                size="sm"
                disabled={uiLocked}
                onClick={() => setSelectionMode(true)}
              >
                Selecionar itens
              </Button>
            ) : (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={uiLocked}
                  onClick={handleSelectAllVisible}
                >
                  Selecionar todos os itens
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={uiLocked}
                  onClick={handleClearSelection}
                >
                  Limpar seleção
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={uiLocked}
                  onClick={handleCloseSelection}
                >
                  Fechar seleção de itens
                </Button>
              </>
            )}
          </div>

          {selectionMode && selectedIds.length > 0 && (
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3">
              <span className="text-sm font-medium text-foreground">
                {selectedIds.length}{" "}
                {selectedIds.length === 1 ? "item selecionado" : "itens selecionados"}
              </span>
              <Button
                variant="destructive"
                size="sm"
                disabled={uiLocked}
                onClick={() => void handleBulkDeleteRequest()}
              >
                Excluir Selecionados
              </Button>
            </div>
          )}

          <ul className="space-y-2">
          {filtered.map((t) => {
          const Icon = icons[t.category as Category] ?? Tag;
          const isIncome = t.type === "income";
          const isRowSelected = selectedIds.includes(t.id);
          return (
            <li key={t.id} className="flex items-stretch gap-2">
              {selectionMode && (
                <div
                  className="flex shrink-0 items-center pl-1"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Checkbox
                    checked={isRowSelected}
                    disabled={uiLocked}
                    onCheckedChange={(v) => toggleRowSelect(t.id, v === true)}
                    aria-label={`Selecionar ${t.description ?? t.category}`}
                  />
                </div>
              )}
              <button
                onClick={() => handleSelectTransaction(t)}
                disabled={uiLocked}
                className={`flex min-w-0 flex-1 items-center gap-3 rounded-2xl border bg-card p-3 text-left transition active:scale-[0.99] disabled:pointer-events-none disabled:opacity-60 ${
                  selectionMode && isRowSelected
                    ? "border-primary/50 ring-1 ring-primary/20"
                    : "border-border"
                }`}
              >
                <div
                className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${
                  isIncome ? "bg-accent text-primary" : "bg-secondary text-foreground"
                }`}
                >
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">
                    {t.description ?? t.category}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t.category} • {t.account} • {formatDate(t.date)}
                  </p>
                </div>
                <p
                  className={`shrink-0 text-sm font-semibold ${
                    isIncome ? "text-primary" : "text-destructive"
                  }`}
                >
                  {isIncome ? "+" : "−"} {BRL(t.amount)}
                </p>
              </button>
            </li>
          );
          })}
          </ul>
        </>
      )}

      <TransactionDetailsDialog
        transaction={selected}
        disabled={uiLocked}
        onClose={() => {
          if (isProcessing) return;
          setSelected(null);
        }}
        onEdit={handleEditRequest}
        onDelete={handleDeleteRequest}
      />

      <AlertDialog
        open={confirmAction?.type === "edit"}
        onOpenChange={(open) => {
          if (!open && !isProcessing) setConfirmAction(null);
        }}
      >
        <AlertDialogContent className="z-[110] rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Deseja alterar?</AlertDialogTitle>
            <AlertDialogDescription>
              Irá ser alterado em receber dinheiro...
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isProcessing}>Cancelar</AlertDialogCancel>
            <AlertDialogAction disabled={isProcessing} onClick={handleConfirmEdit}>
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={confirmAction?.type === "delete"}
        onOpenChange={(open) => {
          if (!open && !isProcessing) setConfirmAction(null);
        }}
      >
        <AlertDialogContent className="z-[110] rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir transação</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction?.type === "delete"
                ? `Realmente deseja excluir o item ${confirmAction.itemName}? O item não será excluído de 'Receber dinheiro', apenas desmarcado.`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isProcessing}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={isProcessing}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault();
                void handleConfirmDelete();
              }}
            >
              {isProcessing ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={confirmAction?.type === "bulk-delete"}
        onOpenChange={(open) => {
          if (!open && !isProcessing) setConfirmAction(null);
        }}
      >
        <AlertDialogContent className="z-[110] rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir transações</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction?.type === "bulk-delete" &&
                (confirmAction.linkedCount > 0
                  ? `Atenção: Você selecionou ${confirmAction.ids.length} transações, mas ${confirmAction.linkedCount} delas vieram de 'Receber dinheiro'. Elas não serão excluídas de lá, apenas desmarcadas. Deseja continuar?`
                  : `Tem certeza que deseja excluir ${confirmAction.ids.length} transações permanentemente?`)}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isProcessing}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={isProcessing}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault();
                void handleConfirmBulkDelete();
              }}
            >
              {isProcessing ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {editing && (
        <AddTransactionDialog
          transaction={editing}
          open
          onOpenChange={(v) => !v && setEditing(null)}
        />
      )}
    </AppShell>
  );
}

function TransactionDetailsDialog({
  transaction,
  disabled,
  onClose,
  onEdit,
  onDelete,
}: {
  transaction: Transaction | null;
  disabled?: boolean;
  onClose: () => void;
  onEdit: (t: Transaction) => void;
  onDelete: (t: Transaction) => void;
}) {
  const t = transaction;
  return (
    <Dialog open={!!t} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm rounded-2xl">
        {t && (
          <>
            <DialogHeader>
              <DialogTitle className="truncate">
                {t.description ?? t.category}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <p
                className={`text-2xl font-bold ${
                  t.type === "income" ? "text-primary" : "text-destructive"
                }`}
              >
                {t.type === "income" ? "+" : "−"} {BRL(t.amount)}
              </p>
              <dl className="grid grid-cols-3 gap-2 text-sm">
                <dt className="text-muted-foreground">Categoria</dt>
                <dd className="col-span-2 text-foreground">{t.category}</dd>
                <dt className="text-muted-foreground">Conta</dt>
                <dd className="col-span-2 text-foreground">{t.account}</dd>
                <dt className="text-muted-foreground">Data</dt>
                <dd className="col-span-2 text-foreground">
                  {new Date(t.date).toLocaleDateString("pt-BR", {
                    day: "2-digit",
                    month: "long",
                    year: "numeric",
                  })}
                </dd>
                {t.recurring && (
                  <>
                    <dt className="text-muted-foreground">Recorrência</dt>
                    <dd className="col-span-2 text-foreground">Mensal</dd>
                  </>
                )}
              </dl>
              <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Observação
                </p>
                <p className="whitespace-pre-wrap rounded-xl bg-muted p-3 text-sm text-foreground">
                  {t.note?.trim() ? t.note : "Sem observações."}
                </p>
              </div>
            </div>
            <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-between">
              <Button variant="destructive" disabled={disabled} onClick={() => onDelete(t)}>
                <Trash2 className="h-4 w-4" /> Excluir
              </Button>
              <Button disabled={disabled} onClick={() => onEdit(t)}>
                <Pencil className="h-4 w-4" /> Editar
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function FilterChip({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-accent px-2.5 py-1 text-xs font-medium text-accent-foreground">
      {label}
      <button
        onClick={onClear}
        aria-label={`Remover ${label}`}
        className="grid h-4 w-4 place-items-center rounded-full hover:bg-foreground/10"
      >
        <X className="h-3 w-3" />
      </button>
    </span>
  );
}