"use client";
import type { AgentRun, OrchestratorSummary } from "@evolv/contracts/types";
import { longDate, timeOfDay } from "@evolv/contracts/format";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const AGENT_SHORT: Record<string, string> = {
  "morning-brief": "Brief",
  "sales-watch": "Sales",
  "kitchen-pacing": "Kitchen",
  "labour-optimizer": "Labour",
  "inventory-guard": "Stock",
};

/** "Last night" summary with a small run graph: one lane per agent on a 5:00–6:30 timeline. */
export function OrchestratorPanel({ summary, loading, onSelectRun }: { summary: OrchestratorSummary | undefined; loading: boolean; onSelectRun: (r: AgentRun) => void }) {
  if (loading || !summary) {
    return <Skeleton className="h-40" />;
  }
  const lanes = ["inventory-guard", "sales-watch", "kitchen-pacing", "labour-optimizer", "morning-brief"].filter((id) => summary.runs.some((r) => r.agentId === id));
  const t0 = new Date(summary.runs[0]?.startedAt ?? 0).getTime();
  const start = Math.floor(t0 / 900000) * 900000; // snap to 15 min
  const end = start + 90 * 60000;
  const x = (iso: string) => ((new Date(iso).getTime() - start) / (end - start)) * 100;

  return (
    <Card className="gap-3 px-4 py-4">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
        <div>
          <div className="text-muted-foreground text-xs font-medium">Orchestrator · last night</div>
          <div className="text-lg font-semibold tracking-tight">
            {summary.agents} agents, {summary.steps} steps, {summary.approvalsPending} approval{summary.approvalsPending === 1 ? "" : "s"} pending, {summary.errors} error{summary.errors === 1 ? "" : "s"}
          </div>
        </div>
        <div className="text-muted-foreground text-xs">{longDate(summary.date)}</div>
      </div>
      <div className="grid gap-1.5" style={{ gridTemplateColumns: "3.5rem 1fr" }}>
        {lanes.map((id) => (
          <Lane key={id} label={AGENT_SHORT[id] ?? id} runs={summary.runs.filter((r) => r.agentId === id)} x={x} onSelect={onSelectRun} />
        ))}
        <div />
        <div className="text-muted-foreground tnum relative h-4 text-[10px]">
          {[0, 30, 60, 90].map((m) => (
            <span key={m} className={cn("absolute whitespace-nowrap", m === 0 ? "" : m === 90 ? "-translate-x-full" : "-translate-x-1/2")} style={{ left: `${(m / 90) * 100}%` }}>
              {timeOfDay(new Date(start + m * 60000).toISOString())}
            </span>
          ))}
        </div>
      </div>
    </Card>
  );
}

function Lane({ label, runs, x, onSelect }: { label: string; runs: AgentRun[]; x: (iso: string) => number; onSelect: (r: AgentRun) => void }) {
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
              aria-label={`${label} run at ${timeOfDay(r.startedAt)}, ${r.status}`}
            />
          );
        })}
      </div>
    </>
  );
}
