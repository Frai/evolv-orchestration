"use client";
import { useState } from "react";
import Link from "next/link";
import { Bot, Check } from "lucide-react";
import type { Approval } from "@/core/types";
import type { FlaggedShift } from "@/core/labour";
import { useAppState } from "@/components/providers/app-state";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { money } from "@/core/format";

/** Mocked Labour Optimizer proposal. Adding it to the queue creates an in-memory Approval. */
export function ScheduleProposalDialog({ flagged, onClose, buildApproval }: { flagged: FlaggedShift | null; onClose: () => void; buildApproval: (f: FlaggedShift) => Approval }) {
  const { addApproval, approvals } = useAppState();
  const [queued, setQueued] = useState<string | null>(null);
  const approval = flagged ? buildApproval(flagged) : null;
  const alreadyQueued = approval ? approvals.some((a) => a.id === approval.id) : false;

  return (
    <Dialog open={!!flagged} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        {approval ? (
          <>
            <DialogHeader>
              <div className="text-muted-foreground flex items-center gap-1.5 text-xs font-medium">
                <Bot className="size-3.5" /> Labour Optimizer proposal
              </div>
              <DialogTitle className="pr-6 leading-snug">{approval.title}</DialogTitle>
              <DialogDescription>{approval.summary}</DialogDescription>
            </DialogHeader>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              {approval.evidence.map((e) => (
                <div key={e.label} className="contents">
                  <dt className="text-muted-foreground">{e.label}</dt>
                  <dd className="tnum text-right font-medium">{e.value}</dd>
                </div>
              ))}
              <dt className="text-muted-foreground">Weekly saving</dt>
              <dd className="tnum text-right font-medium">{money(approval.amount ?? 0)}</dd>
            </dl>
            <DialogFooter>
              {queued === approval.id || alreadyQueued ? (
                <Button asChild variant="outline">
                  <Link href="/approvals/">
                    <Check /> In the approvals queue
                  </Link>
                </Button>
              ) : (
                <>
                  <Button variant="ghost" onClick={onClose}>
                    Not now
                  </Button>
                  <Button
                    onClick={() => {
                      addApproval(approval);
                      setQueued(approval.id);
                    }}
                  >
                    Send to approvals
                  </Button>
                </>
              )}
            </DialogFooter>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
