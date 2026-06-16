import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { User, BellRing, AlertCircle, Calendar, LogOut } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AlertSettingsDialog } from "./AlertSettingsDialog";
import {
  useFixedBills,
  useAlertSettings,
  useBudgets,
  useTransactions,
  BRL,
} from "@/lib/finance-store";

export function UserMenu() {
  const bills = useFixedBills();
  const alerts = useAlertSettings();
  const budgets = useBudgets();
  const transactions = useTransactions();
  const [alertOpen, setAlertOpen] = useState(false);
  const navigate = useNavigate();

  const notifications = useMemo(() => {
    const items: { id: string; text: string; tone: "warn" | "danger" }[] = [];
    const today = new Date();
    const limit = new Date();
    limit.setDate(today.getDate() + alerts.daysBefore);
    bills.forEach((b) => {
      if (b.paid) return;
      const due = new Date(b.year, b.month, b.dueDay);
      if (due >= today && due <= limit) {
        const days = Math.max(0, Math.ceil((due.getTime() - today.getTime()) / 86400000));
        items.push({
          id: `bill-${b.id}`,
          text: `A conta fixa "${b.item}" vence em ${days} dia${days === 1 ? "" : "s"}`,
          tone: "warn",
        });
      }
    });
    const now = new Date();
    const spentByCat = new Map<string, number>();
    transactions.forEach((t) => {
      const d = new Date(t.date);
      if (
        t.type === "expense" &&
        d.getMonth() === now.getMonth() &&
        d.getFullYear() === now.getFullYear()
      ) {
        spentByCat.set(t.category, (spentByCat.get(t.category) ?? 0) + t.amount);
      }
    });
    budgets.forEach((b) => {
      const spent = spentByCat.get(b.category) ?? 0;
      if (spent > b.limit) {
        items.push({
          id: `bud-${b.id}`,
          text: `Orçamento "${b.category}" estourado em ${BRL(spent - b.limit)}`,
          tone: "danger",
        });
      }
    });
    return items;
  }, [bills, alerts, budgets, transactions]);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="inline-flex items-center gap-2 rounded-full bg-accent px-3 py-1.5 text-sm font-medium text-accent-foreground transition active:scale-95">
            <User className="h-4 w-4" />
            <span>Usuário</span>
            {notifications.length > 0 && (
              <span className="grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                {notifications.length}
              </span>
            )}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-80">
          <DropdownMenuLabel>Conta</DropdownMenuLabel>
          <DropdownMenuItem onSelect={(e) => { e.preventDefault(); setAlertOpen(true); }}>
            <BellRing className="mr-2 h-4 w-4" /> Alertas de vencimento
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={(e) => { e.preventDefault(); navigate({ to: "/login" }); }}
            className="text-destructive focus:text-destructive"
          >
            <LogOut className="mr-2 h-4 w-4" /> Sair
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuLabel className="flex items-center gap-2">
            <Calendar className="h-3.5 w-3.5" /> Notificações
          </DropdownMenuLabel>
          {notifications.length === 0 ? (
            <p className="px-2 py-3 text-xs text-muted-foreground">Nada por aqui ainda.</p>
          ) : (
            <div className="max-h-72 overflow-y-auto">
              {notifications.map((n) => (
                <div key={n.id} className="flex items-start gap-2 px-2 py-2 text-xs">
                  <AlertCircle className={`mt-0.5 h-4 w-4 shrink-0 ${n.tone === "danger" ? "text-destructive" : "text-amber-600"}`} />
                  <span className="text-foreground">{n.text}</span>
                </div>
              ))}
            </div>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertSettingsDialog controlledOpen={alertOpen} onControlledOpenChange={setAlertOpen} hideTrigger />
    </>
  );
}