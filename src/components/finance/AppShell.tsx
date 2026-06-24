import type { ReactNode } from "react";
import { BottomNav } from "./BottomNav";
import { ReceivablesSheet } from "./ReceivablesSheet";
import { SideNav } from "./SideNav";
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
      <SideNav />
      <div className="flex min-h-screen min-w-0 flex-col lg:ml-56">
          <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-background/90 px-4 pt-5 pb-4 backdrop-blur sm:px-6 lg:px-8 lg:pt-6">
            <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl lg:text-3xl">
              {title}
            </h1>
            <div className="flex items-center gap-2">
              <ReceivablesSheet />
              <UserMenu />
            </div>
          </header>
          <main className="relative mx-auto w-full max-w-7xl flex-1 px-4 pt-5 pb-24 sm:px-6 lg:px-8 lg:pb-8 lg:pt-8">
            {children}
          </main>
          {action}
          <BottomNav />
      </div>
    </div>
  );
}
