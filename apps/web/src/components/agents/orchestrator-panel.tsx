"use client";
import type { AgentRun } from "@/lib/construction/types";
import type { CycleSummary } from "@/lib/construction/core";
import { AGENTS } from "@/lib/construction/core";
import { longDate, timeOfDay } from "@/lib/construction/format";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const AGENT_SHORT: Record<string, string> = Object.fromEntries(AGENTS.map((a) => [a.id, a.short]));

/** "Last night" summary with a small run graph: one lane per agent on a 5:00–6:30 timeline. */
export function OrchestratorPanel({ summary, loading, tz, onSelectRun }: { summary: CycleSummary | undefined; loading: boolean; tz: string; onSelectRun: (r: AgentRun) => void }) {
  if (loading || !summary) {
    return <Skeleton className="h-40" />;
  }
  const lanes = AGENTS.map((a) => a.id).filter((id) => summary.runs.some((r) => r.agentId === id));
  const t0 = new Date(summary.runs[0]?.startedAt ?? 0).getTime();
  const start = Math.floor(t0 / 900000) * 900000; // snap to 15 min
  const end = start + 60 * 60000;
  const x = (iso: string) => ((new Date(iso).getTime() - start) / (end - start)) * 100;

  return (
    <Card className="gap-3 px-4 py-4">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
        <div>
          <div className="eyebrow">Orchestrator · overnight</div>
          <div className="text-lg font-semibold tracking-tight">
            {summary.agents} agents, {summary.steps} steps, {summary.approvalsPending} approval{summary.approvalsPending === 1 ? "" : "s"} pending, {summary.errors} error{summary.errors === 1 ? "" : "s"}
          </div>
        </div>
        <div className="text-muted-foreground text-xs">{longDate(summary.date)}</div>
      </div>
      <div className="grid gap-1.5" style={{ gridTemplateColumns: "3.5rem 1fr" }}>
        {lanes.map((id) => (
          <Lane key={id} label={AGENT_SHORT[id] ?? id} runs={summary.runs.filter((r) => r.agentId === id)} x={x} tz={tz} onSelect={onSelectRun} />
        ))}
        <div />
        <div className="text-muted-foreground tnum relative h-4 text-[10px]">
          {[0, 20, 40, 60].map((m) => (
            <span key={m} className={cn("absolute whitespace-nowrap", m === 0 ? "" : m === 60 ? "-translate-x-full" : "-translate-x-1/2")} style={{ left: `${(m / 60) * 100}%` }}>
              {timeOfDay(new Date(start + m * 60000).toISOString(), tz)}
            </span>
          ))}
        </div>
      </div>
    </Card>
  );
}

function Lane({ label, runs, x, tz, onSelect }: { label: string; runs: AgentRun[]; x: (iso: string) => number; tz: string; onSelect: (r: AgentRun) => void }) {
  return (
    <>
      <div className="text-muted-foreground flex items-center text-xs">{label}</div>
      <div className="bg-muted/60 relative h-6 rounded-md">
        {runs.map((r) => {
          const left = Math.max(0, x(r.startedAt));
          const width = Math.max(2.5, x(r.finishedAt) - x(r.startedAt));
          return (
            <button
              key={r.id}
              onClick={() => onSelect(r)}
              title={`${r.status} · ${r.steps.length} steps`}
              className={cn(
                "absolute top-1 h-4 cursor-pointer rounded-sm transition-opacity hover:opacity-80",
                r.status === "success" ? "bg-chart-1" : r.status === "needs_approval" ? "bg-amber-500" : "bg-red-600",
              )}
              style={{ left: `${left}%`, width: `${width}%` }}
              aria-label={`${label} run at ${timeOfDay(r.startedAt, tz)}, ${r.status}`}
            />
          );
        })}
      </div>
    </>
  );
}
