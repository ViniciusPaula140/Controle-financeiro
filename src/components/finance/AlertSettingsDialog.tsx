import { useState } from "react";
import { Bell } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useAlertSettings, setAlertSettings } from "@/lib/finance-store";

const OPTIONS = [
  { v: 7, label: "1 semana antes" },
  { v: 6, label: "Na semana do pagamento" },
  { v: 3, label: "3 dias antes" },
  { v: 1, label: "1 dia antes" },
];

export function AlertSettingsDialog({
  controlledOpen,
  onControlledOpenChange,
  hideTrigger = false,
}: {
  controlledOpen?: boolean;
  onControlledOpenChange?: (v: boolean) => void;
  hideTrigger?: boolean;
} = {}) {
  const settings = useAlertSettings();
  const [internal, setInternal] = useState(false);
  const open = controlledOpen ?? internal;
  const setOpen = (v: boolean) => {
    onControlledOpenChange?.(v);
    if (controlledOpen === undefined) setInternal(v);
  };
  const [val, setVal] = useState(settings.daysBefore);

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (v) setVal(settings.daysBefore); }}>
      {!hideTrigger && (
        <DialogTrigger asChild>
          <button
            aria-label="Configurar alertas"
            className="grid h-9 w-9 place-items-center rounded-full bg-accent text-accent-foreground transition active:scale-95"
          >
            <Bell className="h-4 w-4" />
          </button>
        </DialogTrigger>
      )}
      <DialogContent className="max-w-sm rounded-2xl">
        <DialogHeader>
          <DialogTitle>Alertas de vencimento</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Escolha quando ser avisado sobre contas fixas próximas do vencimento.
        </p>
        <div className="space-y-1.5">
          {OPTIONS.map((o) => (
            <button
              key={o.v}
              onClick={() => setVal(o.v)}
              className={`flex w-full items-center justify-between rounded-xl border p-3 text-left text-sm transition ${
                val === o.v
                  ? "border-primary bg-accent text-foreground"
                  : "border-border bg-card text-foreground"
              }`}
            >
              <span>{o.label}</span>
              {val === o.v && <span className="text-xs font-semibold text-primary">Selecionado</span>}
            </button>
          ))}
        </div>
        <DialogFooter>
          <Button
            className="w-full"
            onClick={() => {
              setAlertSettings({ daysBefore: val });
              setOpen(false);
            }}
          >
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}