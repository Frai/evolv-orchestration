"use client";
import Link from "next/link";
import { AlertCircle, CheckCircle2, Flag, HandMetal, ListChecks, MessageCircle, Target } from "lucide-react";
import type { AgentRun } from "@/core/types";
import { durationMs } from "@/core/format";
import { cn } from "@/lib/utils";

const OUTCOME = {
  brief_sent: { label: "Brief sent", Icon: MessageCircle, className: "text-emerald-700 bg-emerald-50 border-emerald-200" },
  alert_raised: { label: "Alert raised", Icon: Flag, className: "text-sky-800 bg-sky-50 border-sky-200" },
  approval_requested: { label: "Approval requested", Icon: HandMetal, className: "text-amber-800 bg-amber-50 border-amber-200" },
  no_action: { label: "No action needed", Icon: CheckCircle2, className: "text-muted-foreground bg-muted/50 border-border" },
  error: { label: "Error", Icon: AlertCircle, className: "text-red-800 bg-red-50 border-red-200" },
} as const;

/** Goal → Plan → Steps → Outcome as a vertical timeline. */
export function TraceView({ run }: { run: AgentRun }) {
  const o = OUTCOME[run.outcome.kind];
  return (
    <ol className="relative flex flex-col gap-5 border-l pl-6">
      <Node icon={<Target className="size-3.5" />} title="Goal">
        <p className="text-sm">{run.goal}</p>
      </Node>
      <Node icon={<ListChecks className="size-3.5" />} title="Plan">
        <ol className="text-muted-foreground list-decimal pl-4 text-sm">
          {run.steps.map((s) => (
            <li key={s.index}>{s.title}</li>
          ))}
        </ol>
      </Node>
      {run.steps.map((s) => (
        <Node key={s.index} icon={<span className="tnum text-[10px] font-semibold">{s.index}</span>} title={s.title} error={s.status === "error"} meta={durationMs(s.durationMs)}>
          <div className="flex flex-col gap-1.5 text-sm">
            <code className="bg-muted w-fit max-w-full truncate rounded px-1.5 py-0.5 font-mono text-xs">{s.tool}</code>
            <div className="grid gap-x-3 gap-y-1 text-xs sm:grid-cols-[3.5rem_1fr]">
              <span className="text-muted-foreground">Input</span>
              <span className="tnum break-words">{s.inputSummary}</span>
              <span className="text-muted-foreground">Output</span>
              <span className={cn("tnum break-words", s.status === "error" && "text-red-700")}>{s.outputSummary}</span>
            </div>
          </div>
        </Node>
      ))}
      <Node icon={<o.Icon className="size-3.5" />} title="Outcome">
        <div className={cn("rounded-md border px-3 py-2 text-sm", o.className)}>
          <div className="font-medium">{o.label}</div>
          <div className="text-xs opacity-90">{run.outcome.summary}</div>
          {run.outcome.kind === "approval_requested" ? (
            <Link href="/approvals/" className="mt-1 inline-block text-xs font-medium underline-offset-2 hover:underline">
              Open approvals
            </Link>
          ) : null}
        </div>
      </Node>
    </ol>
  );
}

function Node({ icon, title, meta, error, children }: { icon: React.ReactNode; title: string; meta?: string; error?: boolean; children: React.ReactNode }) {
  return (
    <li className="relative">
      <span className={cn("bg-card absolute -left-[calc(1.5rem+9px)] top-0 grid size-[18px] place-items-center rounded-full border", error ? "border-red-400 text-red-700" : "text-muted-foreground")}>
        {icon}
      </span>
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <div className="text-sm font-medium">{title}</div>
        {meta ? <div className="text-muted-foreground tnum text-xs">{meta}</div> : null}
      </div>
      {children}
    </li>
  );
}
