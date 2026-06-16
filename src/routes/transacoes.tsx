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
import {
  useTransactions,
  deleteTransaction,
  useCategoriesList,
  useAccountsList,
  BRL,
  type Category,
  type Account,
  type Transaction,
} from "@/lib/finance-store";
import { Input } from "@/components/ui/input";
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
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Transaction | null>(null);
  const [editing, setEditing] = useState<Transaction | null>(null);

  const toggle = <T,>(value: T, list: T[], set: (v: T[]) => void) => {
    set(list.includes(value) ? list.filter((x) => x !== value) : [...list, value]);
  };

  const clearAll = () => {
    setQuery("");
    setTypeFilter("all");
    setSelectedCats([]);
    setSelectedAccs([]);
  };

  const activeCount =
    (typeFilter !== "all" ? 1 : 0) + selectedCats.length + selectedAccs.length;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return [...transactions]
      .filter((t) => {
        if (typeFilter !== "all" && t.type !== typeFilter) return false;
        if (selectedCats.length && !selectedCats.includes(t.category)) return false;
        if (selectedAccs.length && !selectedAccs.includes(t.account)) return false;
        if (q) {
          const hay = `${t.description ?? ""} ${t.category} ${t.account}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [transactions, query, typeFilter, selectedCats, selectedAccs]);

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
          <PopoverContent align="end" className="w-72 rounded-2xl p-4">
            <div className="space-y-4">
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Tipo
                </p>
                <div className="grid grid-cols-3 gap-1 rounded-xl bg-muted p-1">
                  {(["all", "income", "expense"] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => setTypeFilter(t)}
                      className={`rounded-lg py-1.5 text-xs font-medium transition ${
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
                        onClick={() => toggle(c, selectedCats, setSelectedCats)}
                        className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
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
                        onClick={() => toggle(a, selectedAccs, setSelectedAccs)}
                        className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
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

              <div className="flex items-center justify-between pt-1">
                <Button variant="ghost" size="sm" onClick={clearAll}>
                  Limpar
                </Button>
                <Button size="sm" onClick={() => setOpen(false)}>
                  Aplicar
                </Button>
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
        <ul className="space-y-2">
          {filtered.map((t) => {
          const Icon = icons[t.category as Category] ?? Tag;
          const isIncome = t.type === "income";
          return (
            <li key={t.id}>
              <button
                onClick={() => setSelected(t)}
                className="flex w-full items-center gap-3 rounded-2xl border border-border bg-card p-3 text-left transition active:scale-[0.99]"
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
      )}

      <TransactionDetailsDialog
        transaction={selected}
        onClose={() => setSelected(null)}
        onEdit={(t) => {
          setSelected(null);
          setEditing(t);
        }}
        onDelete={(t) => {
          deleteTransaction(t.id);
          setSelected(null);
        }}
      />

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
  onClose,
  onEdit,
  onDelete,
}: {
  transaction: Transaction | null;
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
              <Button variant="destructive" onClick={() => onDelete(t)}>
                <Trash2 className="h-4 w-4" /> Excluir
              </Button>
              <Button onClick={() => onEdit(t)}>
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