import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Plus, Trash2, Landmark } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/finance/AppShell";
import { FAB_CLASS } from "@/components/finance/fab-styles";
import { sanitizeAmountInput } from "@/lib/amount-input";
import { supabaseErrorMessage } from "@/lib/supabase/realtime-utils";
import {
  useAccountBalances,
  addAccountBalance,
  updateAccountBalance,
  deleteAccountBalance,
  useAccountsList,
  addAccountName,
  BRL,
  type Account,
  type AccountBalance,
} from "@/lib/finance-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { CreatableSelect } from "@/components/finance/CreatableSelect";

export const Route = createFileRoute("/investimentos")({
  head: () => ({ meta: [{ title: "Contas" }] }),
  component: ContasPage,
});

function ContasPage() {
  const accounts = useAccountBalances();
  const total = accounts.reduce((s, a) => s + a.balance, 0);
  const [editing, setEditing] = useState<AccountBalance | null>(null);
  const [creating, setCreating] = useState(false);

  return (
    <AppShell
      title="Contas"
      action={
      <button
        aria-label="Adicionar conta"
        onClick={() => setCreating(true)}
        className={FAB_CLASS}
      >
        <Plus className="h-6 w-6" />
      </button>
    }
  >
      <section className="rounded-3xl bg-gradient-to-br from-slate-900 to-slate-700 p-5 text-white shadow-lg">
        <p className="text-xs font-medium uppercase tracking-wider opacity-70">
          Saldo total
        </p>
        <p className="mt-2 text-3xl font-bold tracking-tight">{BRL(total)}</p>
        <p className="mt-1 text-xs opacity-70">
          Somando {accounts.length} {accounts.length === 1 ? "conta" : "contas"}
        </p>
      </section>

      {accounts.length === 0 ? (
        <p className="mt-10 text-center text-sm text-muted-foreground">
          Nenhuma conta cadastrada.
        </p>
      ) : (
        <ul className="mt-5 space-y-2">
          {accounts.map((a) => (
            <li key={a.id}>
              <button
                onClick={() => setEditing(a)}
                className="flex w-full items-center gap-3 rounded-2xl border border-border bg-card p-3 text-left transition active:scale-[0.99]"
              >
                <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-accent text-primary">
                  <Landmark className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">
                    {a.account}
                  </p>
                  {a.note && (
                    <p className="truncate text-xs text-muted-foreground">{a.note}</p>
                  )}
                </div>
                <p className="shrink-0 text-sm font-semibold text-foreground">
                  {BRL(a.balance)}
                </p>
              </button>
            </li>
          ))}
        </ul>
      )}

      <AccountDialog
        open={creating}
        onOpenChange={setCreating}
        onSubmit={async (data) => {
          try {
            await addAccountBalance(data);
            toast.success("Conta criada com sucesso");
            setCreating(false);
          } catch (err) {
            toast.error(supabaseErrorMessage(err));
            throw err;
          }
        }}
      />
      <AccountDialog
        key={editing?.id ?? "none"}
        open={!!editing}
        onOpenChange={(v) => !v && setEditing(null)}
        initial={editing ?? undefined}
        onSubmit={async (data) => {
          if (!editing) return;
          try {
            await updateAccountBalance(editing.id, data);
            toast.success("Conta atualizada com sucesso");
            setEditing(null);
          } catch (err) {
            toast.error(supabaseErrorMessage(err));
            throw err;
          }
        }}
        onDelete={
          editing
            ? async () => {
                try {
                  await deleteAccountBalance(editing.id);
                  toast.success("Conta excluída com sucesso");
                  setEditing(null);
                } catch (err) {
                  toast.error(supabaseErrorMessage(err));
                }
              }
            : undefined
        }
      />
    </AppShell>
  );
}

function AccountDialog({
  open,
  onOpenChange,
  initial,
  onSubmit,
  onDelete,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial?: AccountBalance;
  onSubmit: (data: Omit<AccountBalance, "id">) => void | Promise<void>;
  onDelete?: () => void | Promise<void>;
}) {
  const allAccounts = useAccountsList();
  const [account, setAccount] = useState<Account>(initial?.account ?? "Nubank");
  const [balance, setBalance] = useState(
    initial ? String(initial.balance).replace(".", ",") : "",
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
    setAccount(initial?.account ?? "Nubank");
    setBalance(initial ? String(initial.balance).replace(".", ",") : "");
    setNote(initial?.note ?? "");
    isSubmittingRef.current = false;
    setIsSubmitting(false);
  }, [open, initial]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    setIsSubmitting(true);
    const v = parseFloat(balance.replace(",", "."));
    if (!account.trim() || !balance.trim() || Number.isNaN(v)) {
      toast.error("O campo de saldo atual deve conter um valor válido.");
      isSubmittingRef.current = false;
      setIsSubmitting(false);
      return;
    }
    try {
      await onSubmit({ account, balance: v, note: note || undefined });
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
          <DialogTitle>{initial ? "Editar Conta" : "Nova Conta"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Banco</Label>
            <CreatableSelect
              value={account}
              options={allAccounts}
              onChange={(v) => setAccount(v as Account)}
              onCreate={(v) => addAccountName(v)}
              placeholder="Banco"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="balance">Saldo atual (R$)</Label>
            <Input
              id="balance"
              inputMode="decimal"
              placeholder="0,00"
              value={balance}
              onChange={(e) => setBalance(sanitizeAmountInput(e.target.value))}
              className="text-lg"
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="acc-note">Observação</Label>
            <Textarea
              id="acc-note"
              placeholder="Ex: conta salário, reserva..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
            />
          </div>
          <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-between">
            {onDelete ? (
              <Button type="button" variant="destructive" onClick={onDelete}>
                <Trash2 className="h-4 w-4" /> Excluir
              </Button>
            ) : (
              <span />
            )}
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Salvando..." : initial ? "Salvar" : "Adicionar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}