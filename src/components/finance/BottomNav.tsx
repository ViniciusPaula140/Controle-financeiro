import { Link } from "@tanstack/react-router";
import { Home, ArrowLeftRight, Target, Landmark, Trophy, Receipt } from "lucide-react";

const items = [
  { to: "/", label: "Início", icon: Home },
  { to: "/transacoes", label: "Transac.", icon: ArrowLeftRight },
  { to: "/orcamentos", label: "Orçam.", icon: Target },
  { to: "/investimentos", label: "Contas", icon: Landmark },
  { to: "/metas", label: "Metas", icon: Trophy },
  { to: "/contas-fixas", label: "Fixas", icon: Receipt },
] as const;

export function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
      <ul className="mx-auto grid max-w-3xl grid-cols-6">
        {items.map(({ to, label, icon: Icon }) => (
          <li key={to}>
            <Link
              to={to}
              activeOptions={{ exact: true }}
              activeProps={{ className: "text-primary" }}
              inactiveProps={{ className: "text-muted-foreground" }}
              className="flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium transition-colors"
            >
              <Icon className="h-5 w-5" />
              <span>{label}</span>
            </Link>
          </li>
        ))}
      </ul>
      <div className="h-[env(safe-area-inset-bottom)]" />
    </nav>
  );
}