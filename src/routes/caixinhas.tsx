import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Plus, PiggyBank } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/finance/AppShell";
import { FAB_CLASS } from "@/components/finance/fab-styles";
import { amountInputFocusProps, sanitizeAmountInput } from "@/lib/amount-input";
import { supabaseErrorMessage } from "@/lib/supabase/realtime-utils";
import {
  useCaixinhas,
  useLiquidBalanceAvailable,
  addCaixinha,
  depositToCaixinha,
  withdrawFromCaixinha,
  BRL,
  type Caixinha,
} from "@/lib/finance-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/caixinhas")({
  head: () => ({ meta: [{ title: "Caixinhas" }] }),
  component: CaixinhasPage,
});

function CaixinhasPage() {
  const caixinhas = useCaixinhas();
  const liquidAvailable = useLiquidBalanceAvailable();
  const [creating, setCreating] = useState(false);
  const [moving, setMoving] = useState<Caixinha | null>(null);

  return (
    <AppShell
      title="Caixinhas"
      action={
        <button
          aria-label="Nova caixinha"
          onClick={() => setCreating(true)}
          className={FAB_CLASS}
        >
          <Plus className="h-6 w-6" />
        </button>
      }
    >
      <section className="rounded-2xl border border-primary/20 bg-primary/5 p-5">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Saldo Líquido Disponível
        </p>
        <p className="mt-1 text-2xl font-bold text-primary">{BRL(liquidAvailable)}</p>
        <p className="mt-2 text-xs text-muted-foreground">
          Receitas menos despesas, descontando o que já está guardado nas caixinhas.
        </p>
      </section>

      {caixinhas.length === 0 ? (
        <p className="mt-10 text-center text-sm text-muted-foreground">
          Nenhuma caixinha criada. Toque no + para começar a separar seu dinheiro.
        </p>
      ) : (
        <ul className="mt-5 grid gap-3 sm:grid-cols-2">
          {caixinhas.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => setMoving(c)}
                className="flex w-full items-center gap-3 rounded-2xl border border-border bg-card p-4 text-left transition active:scale-[0.99] hover:border-primary/30"
              >
                <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-accent text-primary">
                  <PiggyBank className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{c.nome}</p>
                  <p className="text-xs text-muted-foreground">Toque para guardar ou resgatar</p>
                </div>
                <p className="shrink-0 text-sm font-semibold text-foreground">
                  {BRL(c.saldo_guardado)}
                </p>
              </button>
            </li>
          ))}
        </ul>
      )}

      <CreateCaixinhaDialog open={creating} onOpenChange={setCreating} />
      <MoveMoneyDialog
        key={moving?.id ?? "none"}
        open={!!moving}
        onOpenChange={(v) => !v && setMoving(null)}
        caixinha={moving}
        liquidAvailable={liquidAvailable}
      />
    </AppShell>
  );
}

function CreateCaixinhaDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [nome, setNome] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isSubmittingRef = useRef(false);

  useEffect(() => {
    if (!open) {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
      return;
    }
    setNome("");
    isSubmittingRef.current = false;
    setIsSubmitting(false);
  }, [open]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    setIsSubmitting(true);
    const trimmed = nome.trim();
    if (!trimmed) {
      toast.error("Informe o nome da caixinha");
      isSubmittingRef.current = false;
      setIsSubmitting(false);
      return;
    }
    try {
      await addCaixinha({ nome: trimmed });
      toast.success("Caixinha criada com sucesso");
      onOpenChange(false);
    } catch (err) {
      toast.error(supabaseErrorMessage(err));
    } finally {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] max-w-sm flex-col gap-0 overflow-hidden rounded-2xl p-0">
        <DialogHeader className="shrink-0 px-6 pt-6">
          <DialogTitle>Nova Caixinha</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
          <div className="flex-1 overflow-y-auto p-6">
            <div className="space-y-1.5">
              <Label htmlFor="cx-nome">Nome</Label>
              <Input
                id="cx-nome"
                placeholder="Ex: Viagem, Emergência..."
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                autoFocus
              />
            </div>
          </div>
          <div className="shrink-0 border-t p-4">
            <DialogFooter>
              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? "Salvando..." : "Criar"}
              </Button>
            </DialogFooter>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

type MoveMode = "deposit" | "withdraw";

function MoveMoneyDialog({
  open,
  onOpenChange,
  caixinha,
  liquidAvailable,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  caixinha: Caixinha | null;
  liquidAvailable: number;
}) {
  const [mode, setMode] = useState<MoveMode>("deposit");
  const [amount, setAmount] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isSubmittingRef = useRef(false);

  useEffect(() => {
    if (!open) {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
      return;
    }
    setMode("deposit");
    setAmount("");
    isSubmittingRef.current = false;
    setIsSubmitting(false);
  }, [open, caixinha?.id]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!caixinha) return;
    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    setIsSubmitting(true);

    const value = parseFloat(amount.replace(",", "."));
    if (!amount.trim() || Number.isNaN(value) || value <= 0) {
      toast.error("Informe um valor maior que zero");
      isSubmittingRef.current = false;
      setIsSubmitting(false);
      return;
    }

    if (mode === "deposit" && value > liquidAvailable) {
      toast.error("Valor maior que o saldo líquido disponível");
      isSubmittingRef.current = false;
      setIsSubmitting(false);
      return;
    }

    if (mode === "withdraw" && value > caixinha.saldo_guardado) {
      toast.error("Valor maior que o saldo guardado na caixinha");
      isSubmittingRef.current = false;
      setIsSubmitting(false);
      return;
    }

    try {
      if (mode === "deposit") {
        await depositToCaixinha(caixinha.id, value);
        toast.success(`R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} guardado em "${caixinha.nome}"`);
      } else {
        await withdrawFromCaixinha(caixinha.id, value);
        toast.success(`R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} resgatado de "${caixinha.nome}"`);
      }
      onOpenChange(false);
    } catch (err) {
      toast.error(supabaseErrorMessage(err));
    } finally {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  if (!caixinha) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] max-w-sm flex-col gap-0 overflow-hidden rounded-2xl p-0">
        <DialogHeader className="shrink-0 px-6 pt-6">
          <DialogTitle>{caixinha.nome}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
          <div className="flex-1 space-y-4 overflow-y-auto p-6">
            <div className="grid grid-cols-2 gap-2 rounded-xl bg-muted p-1">
              <button
                type="button"
                onClick={() => setMode("deposit")}
                className={`rounded-lg py-2 text-sm font-medium transition ${
                  mode === "deposit"
                    ? "bg-card text-primary shadow-sm"
                    : "text-muted-foreground"
                }`}
              >
                Depositar
              </button>
              <button
                type="button"
                onClick={() => setMode("withdraw")}
                className={`rounded-lg py-2 text-sm font-medium transition ${
                  mode === "withdraw"
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground"
                }`}
              >
                Resgatar
              </button>
            </div>

            <div className="rounded-xl border border-border bg-muted/40 p-3 text-sm">
              <p className="text-muted-foreground">
                {mode === "deposit" ? "Disponível para guardar" : "Saldo na caixinha"}
              </p>
              <p className="mt-0.5 font-semibold text-foreground">
                {BRL(mode === "deposit" ? liquidAvailable : caixinha.saldo_guardado)}
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="cx-valor">Valor (R$)</Label>
              <Input
                id="cx-valor"
                inputMode="decimal"
                placeholder="0,00"
                value={amount}
                onChange={(e) => setAmount(sanitizeAmountInput(e.target.value))}
                {...amountInputFocusProps(setAmount)}
                autoFocus
              />
            </div>
          </div>
          <div className="shrink-0 border-t p-4">
            <DialogFooter>
              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting
                  ? "Salvando..."
                  : mode === "deposit"
                    ? "Depositar"
                    : "Resgatar"}
              </Button>
            </DialogFooter>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
