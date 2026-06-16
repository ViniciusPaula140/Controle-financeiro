import { useEffect, useState, type ReactNode } from "react";
import { Plus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import {
  addTransaction,
  updateTransaction,
  useCategoriesList,
  useAccountsList,
  addCategory,
  addAccountName,
  type Category,
  type Account,
  type Transaction,
} from "@/lib/finance-store";
import { CreatableSelect } from "./CreatableSelect";

export function AddTransactionDialog({
  trigger,
  transaction,
  open: openProp,
  onOpenChange,
}: {
  trigger?: ReactNode;
  transaction?: Transaction;
  open?: boolean;
  onOpenChange?: (v: boolean) => void;
}) {
  const categories = useCategoriesList();
  const accounts = useAccountsList();
  const [internalOpen, setInternalOpen] = useState(false);
  const open = openProp ?? internalOpen;
  const setOpen = (v: boolean) => {
    onOpenChange?.(v);
    if (openProp === undefined) setInternalOpen(v);
  };

  const [amount, setAmount] = useState("");
  const [type, setType] = useState<"income" | "expense">("expense");
  const [category, setCategory] = useState<Category>("Alimentação");
  const [account, setAccount] = useState<Account>("Nubank");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [recurring, setRecurring] = useState(false);
  const [description, setDescription] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    if (!open) return;
    if (transaction) {
      setAmount(String(transaction.amount).replace(".", ","));
      setType(transaction.type);
      setCategory(transaction.category);
      setAccount(transaction.account);
      setDate(new Date(transaction.date).toISOString().slice(0, 10));
      setRecurring(!!transaction.recurring);
      setDescription(transaction.description ?? "");
      setNote(transaction.note ?? "");
    } else {
      setAmount("");
      setType("expense");
      setCategory("Alimentação");
      setAccount("Nubank");
      setDate(new Date().toISOString().slice(0, 10));
      setRecurring(false);
      setDescription("");
      setNote("");
    }
  }, [open, transaction]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const value = parseFloat(amount.replace(",", "."));
    if (!value || value <= 0) return;
    const payload = {
      amount: value,
      type,
      category,
      account,
      date: new Date(date).toISOString(),
      recurring,
      description: description || category,
      note: note || undefined,
    };
    if (transaction) updateTransaction(transaction.id, payload);
    else addTransaction(payload);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {openProp === undefined && (
        <DialogTrigger asChild>
          {trigger ?? (
            <button
              aria-label="Adicionar transação"
              className="fixed right-5 bottom-24 z-30 grid h-14 w-14 place-items-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 transition-transform active:scale-95 lg:right-8 lg:bottom-8"
            >
              <Plus className="h-6 w-6" />
            </button>
          )}
        </DialogTrigger>
      )}
      <DialogContent className="max-w-sm rounded-2xl">
        <DialogHeader>
          <DialogTitle>{transaction ? "Editar Transação" : "Nova Transação"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
          <div className="grid grid-cols-2 gap-2 rounded-xl bg-muted p-1">
            <button
              type="button"
              onClick={() => setType("expense")}
              className={`rounded-lg py-2 text-sm font-medium transition ${
                type === "expense"
                  ? "bg-card text-destructive shadow-sm"
                  : "text-muted-foreground"
              }`}
            >
              Despesa
            </button>
            <button
              type="button"
              onClick={() => setType("income")}
              className={`rounded-lg py-2 text-sm font-medium transition ${
                type === "income" ? "bg-card text-primary shadow-sm" : "text-muted-foreground"
              }`}
            >
              Receita
            </button>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="amount">Valor (R$)</Label>
            <Input
              id="amount"
              inputMode="decimal"
              placeholder="0,00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="text-lg"
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="desc">Descrição</Label>
            <Input
              id="desc"
              placeholder="Ex: Mercado da semana"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Categoria</Label>
              <CreatableSelect
                value={category}
                options={categories}
                onChange={(v) => setCategory(v as Category)}
                onCreate={(v) => addCategory(v)}
                placeholder="Categoria"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Conta</Label>
              <CreatableSelect
                value={account}
                options={accounts}
                onChange={(v) => setAccount(v as Account)}
                onCreate={(v) => addAccountName(v)}
                placeholder="Conta"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="date">Data</Label>
            <Input
              id="date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="note">Observação</Label>
            <Textarea
              id="note"
              placeholder="Comentário opcional..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
            />
          </div>

          <label className="flex items-center gap-2 text-sm text-foreground">
            <Checkbox
              checked={recurring}
              onCheckedChange={(v) => setRecurring(v === true)}
            />
            Repetir mensalmente
          </label>

          <Button type="submit" className="w-full" size="lg">
            {transaction ? "Salvar alterações" : "Salvar"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}