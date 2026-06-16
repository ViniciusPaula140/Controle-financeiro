import {
  Home,
  ArrowLeftRight,
  Target,
  Landmark,
  Trophy,
  Receipt,
  type LucideIcon,
} from "lucide-react";

export const NAV_ITEMS = [
  { to: "/inicio", label: "Início", shortLabel: "Início", icon: Home },
  { to: "/transacoes", label: "Transações", shortLabel: "Transac.", icon: ArrowLeftRight },
  { to: "/orcamentos", label: "Orçamentos", shortLabel: "Orçam.", icon: Target },
  { to: "/investimentos", label: "Contas", shortLabel: "Contas", icon: Landmark },
  { to: "/metas", label: "Metas", shortLabel: "Metas", icon: Trophy },
  { to: "/contas-fixas", label: "Contas fixas", shortLabel: "Fixas", icon: Receipt },
] as const satisfies ReadonlyArray<{
  to: string;
  label: string;
  shortLabel: string;
  icon: LucideIcon;
}>;
