import { Link } from "@tanstack/react-router";
import { Wallet } from "lucide-react";
import { NAV_ITEMS } from "./nav-items";

export function SideNav() {
  return (
    <aside className="sticky top-0 hidden h-screen w-56 shrink-0 flex-col border-r border-border bg-card/50 lg:flex">
      <div className="flex items-center gap-2.5 border-b border-border px-5 py-6">
        <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-primary to-emerald-600 text-primary-foreground">
          <Wallet className="h-4 w-4" />
        </div>
        <span className="text-sm font-semibold tracking-tight text-foreground">Finanças</span>
      </div>
      <nav className="flex flex-1 flex-col gap-1 p-3">
        {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
          <Link
            key={to}
            to={to}
            activeOptions={{ exact: true }}
            activeProps={{
              className:
                "bg-primary/10 text-primary font-medium",
            }}
            inactiveProps={{ className: "text-muted-foreground hover:bg-accent hover:text-foreground" }}
            className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors"
          >
            <Icon className="h-4 w-4 shrink-0" />
            {label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
