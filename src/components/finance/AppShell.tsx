import type { ReactNode } from "react";
import { BottomNav } from "./BottomNav";
import { ReceivablesSheet } from "./ReceivablesSheet";
import { UserMenu } from "./UserMenu";

export function AppShell({
  title,
  children,
  action,
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col">
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-background/90 px-5 pt-6 pb-4 backdrop-blur md:px-8">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl">{title}</h1>
          <div className="flex items-center gap-2">
            <ReceivablesSheet />
            <UserMenu />
          </div>
        </header>
        <main className="relative flex-1 px-5 pt-5 pb-28 md:px-8 md:pt-8">{children}</main>
        {action}
        <BottomNav />
      </div>
    </div>
  );
}