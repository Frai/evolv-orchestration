"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { LogOut, MoreHorizontal } from "lucide-react";
import { useAppState } from "@/components/providers/app-state";
import { Logo } from "./logo";
import { NAV_ITEMS, isActive } from "./nav-items";
import { TenantSwitcher } from "./tenant-switcher";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export function AppShell({ children }: { children: ReactNode }) {
  const { signedIn, ready, signOut, pendingCount, location } = useAppState();
  const router = useRouter();
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);

  useEffect(() => {
    if (ready && !signedIn) router.replace("/login/");
  }, [ready, signedIn, router]);

  if (!ready || !signedIn || !location) {
    return (
      <div className="mx-auto max-w-6xl p-4 md:p-6">
        <Skeleton className="mb-4 h-8 w-48" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="mt-4 h-64" />
      </div>
    );
  }

  const primary = NAV_ITEMS.filter((n) => n.primary);
  const secondary = NAV_ITEMS.filter((n) => !n.primary);

  return (
    <div className="min-h-dvh md:flex">
      {/* Desktop sidebar */}
      <aside className="bg-card sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r md:flex">
        <div className="px-5 py-5">
          <Link href="/" aria-label="Today">
            <Logo />
          </Link>
        </div>
        <nav className="flex flex-1 flex-col gap-0.5 px-3">
          {NAV_ITEMS.map((n) => {
            const active = isActive(pathname, n.href);
            return (
              <Link
                key={n.href}
                href={n.href}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                  active ? "bg-accent text-accent-foreground font-medium" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <n.icon className="size-4" />
                <span className="flex-1">{n.label}</span>
                {n.href === "/approvals/" && pendingCount > 0 ? (
                  <span className="bg-primary text-primary-foreground tnum rounded-full px-1.5 py-0.5 text-[11px] leading-none">{pendingCount}</span>
                ) : null}
              </Link>
            );
          })}
        </nav>
        <div className="border-t p-3">
          <button
            onClick={signOut}
            className="text-muted-foreground hover:bg-muted hover:text-foreground flex w-full cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-sm"
          >
            <LogOut className="size-4" /> Sign out
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar */}
        <header className="bg-background/95 sticky top-0 z-30 border-b backdrop-blur supports-[backdrop-filter]:bg-background/80">
          <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2.5 md:px-6">
            <Link href="/" className="md:hidden" aria-label="Today">
              <Logo compact />
            </Link>
            <TenantSwitcher className="min-w-0 flex-1 justify-end md:justify-start" />
          </div>
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 pt-4 pb-24 md:px-6 md:pt-6 md:pb-10">{children}</main>
      </div>

      {/* Mobile bottom nav */}
      <nav className="bg-card fixed inset-x-0 bottom-0 z-30 border-t pb-[env(safe-area-inset-bottom)] md:hidden" aria-label="Primary">
        <div className="grid grid-cols-5">
          {primary.map((n) => {
            const active = isActive(pathname, n.href);
            return (
              <Link
                key={n.href}
                href={n.href}
                className={cn("flex flex-col items-center gap-1 py-2 text-[11px]", active ? "text-primary font-medium" : "text-muted-foreground")}
              >
                <n.icon className="size-5" />
                {n.label}
              </Link>
            );
          })}
          <button
            onClick={() => setMoreOpen(true)}
            className={cn(
              "relative flex cursor-pointer flex-col items-center gap-1 py-2 text-[11px]",
              secondary.some((n) => isActive(pathname, n.href)) ? "text-primary font-medium" : "text-muted-foreground",
            )}
          >
            <MoreHorizontal className="size-5" />
            More
            {pendingCount > 0 ? <span className="bg-primary absolute top-1.5 right-[22%] size-2 rounded-full" aria-hidden /> : null}
          </button>
        </div>
      </nav>

      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent side="bottom" className="pb-[max(1rem,env(safe-area-inset-bottom))]">
          <SheetHeader>
            <SheetTitle>More</SheetTitle>
          </SheetHeader>
          <div className="grid grid-cols-2 gap-2 px-4">
            {secondary.map((n) => (
              <Link key={n.href} href={n.href} onClick={() => setMoreOpen(false)} className="bg-muted/60 hover:bg-muted flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium">
                <n.icon className="size-4" />
                <span className="flex-1">{n.label}</span>
                {n.href === "/approvals/" && pendingCount > 0 ? (
                  <span className="bg-primary text-primary-foreground tnum rounded-full px-1.5 py-0.5 text-[11px] leading-none">{pendingCount}</span>
                ) : null}
              </Link>
            ))}
            <button onClick={signOut} className="bg-muted/60 hover:bg-muted flex cursor-pointer items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium">
              <LogOut className="size-4" /> Sign out
            </button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
