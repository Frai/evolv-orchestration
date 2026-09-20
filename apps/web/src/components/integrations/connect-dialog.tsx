"use client";
import { useEffect, useState } from "react";
import { Check, Loader2, ShieldCheck } from "lucide-react";
import type { Integration } from "@evolv/contracts/types";
import { useAppState } from "@/components/providers/app-state";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const SCOPES: Record<string, string[]> = {
  pos: ["Read sales, checks and items", "Read hourly breakdowns", "Read labour and timecards"],
  scheduling: ["Read schedules and roles", "Read actual hours", "Propose schedule changes (with approval)"],
  inventory: ["Read counts and par levels", "Draft purchase orders (with approval)"],
  accounting: ["Read P&L and expenses", "Read bank balances"],
  delivery: ["Read orders and commissions", "Read ratings"],
  reservations: ["Read bookings and no-shows", "Read guest notes"],
  messaging: ["Send the morning brief", "Send alerts"],
};

/** Mocked three-step OAuth: sign in with the vendor, grant scopes, initial sync. Ends connected. */
export function ConnectDialog({ integration, onClose, onConnected }: { integration: Integration | null; onClose: () => void; onConnected: (id: string) => void }) {
  return (
    <Dialog open={!!integration} onOpenChange={(o) => !o && onClose()}>
      {integration ? <ConnectFlow key={integration.id} integration={integration} onClose={onClose} onConnected={onConnected} /> : null}
    </Dialog>
  );
}

function ConnectFlow({ integration, onClose, onConnected }: { integration: Integration; onClose: () => void; onConnected: (id: string) => void }) {
  const { userEmail } = useAppState();
  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (step !== 3) return;
    let p = 0;
    const t = setInterval(() => {
      p = Math.min(100, p + 9 + Math.round(Math.random() * 10));
      setProgress(p);
      if (p >= 100) {
        clearInterval(t);
        onConnected(integration.id);
        setTimeout(() => setStep(4), 250);
      }
    }, 220);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, integration?.id]);

  const scopes = SCOPES[integration.area] ?? [];

  const next = () => {
    setBusy(true);
    setTimeout(() => {
      setBusy(false);
      setStep((s) => s + 1);
    }, 550);
  };

  return (
    <DialogContent>
        <DialogHeader>
          <DialogTitle className="pr-6">Connect {integration.name}</DialogTitle>
          <DialogDescription>
            {step < 4 ? `Step ${step} of 3` : "Connected"} · {step === 1 ? "Sign in to your account" : step === 2 ? "Choose what Evolv can access" : step === 3 ? "First sync" : "Ready"}
          </DialogDescription>
        </DialogHeader>
        <ol className="flex items-center gap-2" aria-hidden>
          {[1, 2, 3].map((s) => (
            <li key={s} className={cn("h-1 flex-1 rounded-full", step > s ? "bg-primary" : step === s ? "bg-primary/50" : "bg-muted")} />
          ))}
        </ol>

        {step === 1 ? (
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="vendor-email">{integration.name} account email</Label>
              <Input id="vendor-email" type="email" defaultValue={userEmail ?? ""} placeholder="you@restaurant.ca" />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="vendor-password">Password</Label>
              <Input id="vendor-password" type="password" placeholder="••••••••" />
            </div>
            <p className="text-muted-foreground text-xs">You are signing in with {integration.name}. Evolv never sees your password.</p>
          </div>
        ) : step === 2 ? (
          <div className="flex flex-col gap-2">
            <p className="text-sm">Evolv is asking for permission to:</p>
            <ul className="flex flex-col gap-1.5">
              {scopes.map((s) => (
                <li key={s} className="flex items-start gap-2 text-sm">
                  <ShieldCheck className="text-primary mt-0.5 size-4 shrink-0" /> {s}
                </li>
              ))}
            </ul>
            <p className="text-muted-foreground text-xs">Read-only unless it says otherwise. Anything that changes data goes through Approvals.</p>
          </div>
        ) : step === 3 ? (
          <div className="flex flex-col gap-3">
            <div className="bg-muted h-2 w-full overflow-hidden rounded-full">
              <div className="bg-primary h-full rounded-full transition-all" style={{ width: `${progress}%` }} />
            </div>
            <p className="text-muted-foreground inline-flex items-center gap-2 text-sm">
              <Loader2 className="size-4 animate-spin" /> Pulling the last 90 days from {integration.name}…
            </p>
          </div>
        ) : (
          <div className="flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-3 text-emerald-900">
            <Check className="size-5" />
            <div className="text-sm">
              <div className="font-medium">{integration.name} is connected.</div>
              <div className="text-xs opacity-80">First sync done. Tomorrow&apos;s brief will include it.</div>
            </div>
          </div>
        )}

        <DialogFooter>
          {step < 3 ? (
            <>
              <Button variant="ghost" onClick={onClose}>
                Cancel
              </Button>
              <Button onClick={next} disabled={busy}>
                {busy ? <Loader2 className="animate-spin" /> : null}
                {step === 1 ? "Sign in" : "Allow access"}
              </Button>
            </>
          ) : step === 4 ? (
            <Button onClick={onClose}>Done</Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
  );
}
