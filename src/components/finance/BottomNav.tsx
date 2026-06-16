import { Link } from "@tanstack/react-router";
import { NAV_ITEMS } from "./nav-items";

export function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80 lg:hidden">
      <ul className="mx-auto grid max-w-lg grid-cols-6">
        {NAV_ITEMS.map(({ to, shortLabel, icon: Icon }) => (
          <li key={to}>
            <Link
              to={to}
              activeOptions={{ exact: true }}
              activeProps={{ className: "text-primary" }}
              inactiveProps={{ className: "text-muted-foreground" }}
              className="flex flex-col items-center gap-0.5 py-2.5 text-[10px] font-medium transition-colors sm:text-[11px]"
            >
              <Icon className="h-5 w-5" />
              <span>{shortLabel}</span>
            </Link>
          </li>
        ))}
      </ul>
      <div className="h-[env(safe-area-inset-bottom)]" />
    </nav>
  );
}
