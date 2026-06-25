import { useEffect, useState, type ReactNode } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { FAB_CLASS } from "@/components/finance/fab-styles";
import { localDateInputToISO, isoToLocalDateInput, localTodayDateInput } from "@/lib/date-utils";
import { supabaseErrorMessage } from "@/lib/supabase/realtime-utils";
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
import { sanitizeAmountInput } from "@/lib/amount-input";

type FieldErrors = {
  amount?: string;
  description?: string;
};

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
  const [date, setDate] = useState(() => localTodayDateInput());
  const [recurring, setRecurring] = useState(false);
  const [description, setDescription] = useState("");
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (transaction) {
      setAmount(String(transaction.amount).replace(".", ","));
      setType(transaction.type);
      setCategory(transaction.category);
      setAccount(transaction.account);
      setDate(isoToLocalDateInput(transaction.date));
      setRecurring(!!transaction.recurring);
      setDescription(transaction.description ?? "");
      setNote(transaction.note ?? "");
    } else {
      setAmount("");
      setType("expense");
      setCategory("Alimentação");
      setAccount("Nubank");
      setDate(localTodayDateInput());
      setRecurring(false);
      setDescription("");
      setNote("");
    }
    setErrors({});
  }, [open, transaction]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const nextErrors: FieldErrors = {};
    const desc = description.trim();

    if (!desc) {
      nextErrors.description = "Informe uma descrição.";
    }

    const value = parseFloat(amount.replace(",", "."));
    if (!amount.trim() || Number.isNaN(value)) {
      nextErrors.amount = "Informe um valor numérico válido.";
    } else if (value <= 0) {
      nextErrors.amount = "O valor deve ser maior que zero.";
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      toast.error(Object.values(nextErrors).join(" "));
      return;
    }

    setErrors({});
    setSaving(true);
    try {
      const payload = {
        amount: value,
        type,
        category,
        account,
        date: localDateInputToISO(date),
        recurring,
        description: desc,
        note: note.trim() || undefined,
      };
      if (transaction) await updateTransaction(transaction.id, payload);
      else await addTransaction(payload);
      toast.success(
        transaction ? "Transação atualizada com sucesso" : "Nova transação criada com sucesso",
      );
      setOpen(false);
    } catch (err) {
      toast.error(supabaseErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {openProp === undefined && (
        <DialogTrigger asChild>
          {trigger ?? (
            <button
              aria-label="Adicionar transação"
              className={FAB_CLASS}
            >
              <Plus className="h-6 w-6" />
            </button>
          )}
        </DialogTrigger>
      )}
      <DialogContent className="flex max-h-[90vh] max-w-sm flex-col gap-0 overflow-hidden rounded-2xl p-0">
        <DialogHeader className="shrink-0 px-6 pt-6">
          <DialogTitle>{transaction ? "Editar Transação" : "Nova Transação"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
          <div className="flex-1 space-y-4 overflow-y-auto p-6">
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
              onChange={(e) => {
                setAmount(sanitizeAmountInput(e.target.value));
                if (errors.amount) setErrors((prev) => ({ ...prev, amount: undefined }));
              }}
              className={`text-lg ${errors.amount ? "border-destructive" : ""}`}
              autoFocus
            />
            {errors.amount && <p className="text-xs text-destructive">{errors.amount}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="desc">Descrição</Label>
            <Input
              id="desc"
              placeholder="Ex: Mercado da semana"
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                if (errors.description) setErrors((prev) => ({ ...prev, description: undefined }));
              }}
              className={errors.description ? "border-destructive" : ""}
            />
            {errors.description && <p className="text-xs text-destructive">{errors.description}</p>}
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
          </div>
          <div className="shrink-0 space-y-3 border-t p-4">
          <label className="flex items-center gap-2 text-sm text-foreground">
            <Checkbox
              checked={recurring}
              onCheckedChange={(v) => setRecurring(v === true)}
            />
            Repetir mensalmente
          </label>

          <Button type="submit" className="w-full" size="lg" disabled={saving}>
            {saving ? "Salvando..." : transaction ? "Salvar alterações" : "Salvar"}
          </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}