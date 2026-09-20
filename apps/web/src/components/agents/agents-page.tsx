"use client";
import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertCircle, ArrowLeft, Bot, CheckCircle2, ChevronRight, Clock, HandMetal } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { useAppState } from "@/components/providers/app-state";
import { useAsync } from "@/hooks/use-async";
import type { Agent, AgentRun, RunStatus } from "@evolv/contracts/types";
import { dateTime, durationMs, shortDateWeekday, timeOfDay } from "@evolv/contracts/format";
import { PageHeader } from "@/components/layout/page-header";
import { Section } from "@/components/common/section";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { OrchestratorPanel } from "./orchestrator-panel";
import { TraceView } from "./trace-view";
import { cn } from "@/lib/utils";

export const RUN_STATUS: Record<RunStatus, { label: string; variant: "success" | "warning" | "danger"; Icon: typeof CheckCircle2 }> = {
  success: { label: "Completed", variant: "success", Icon: CheckCircle2 },
  needs_approval: { label: "Needs approval", variant: "warning", Icon: HandMetal },
  error: { label: "Error", variant: "danger", Icon: AlertCircle },
};

export function AgentsPage() {
  return (
    <Suspense fallback={<Skeleton className="h-64" />}>
      <AgentsPageInner />
    </Suspense>
  );
}

function AgentsPageInner() {
  const { locationId, location, agentModes } = useAppState();
  const params = useSearchParams();
  const router = useRouter();
  const deepRun = params.get("run");

  const agents = useAsync(() => apiClient.agents.listAgents(), []);
  const runs = useAsync(() => apiClient.agents.listRuns(locationId), [locationId]);
  const cycle = useAsync(() => apiClient.agents.lastCycle(locationId), [locationId]);

  // Selection is stored with the tenant it belongs to, so switching tenants resets it without an effect.
  const [sel, setSel] = useState<{ loc: string; agentId: string | null; runId: string | null }>({ loc: locationId, agentId: null, runId: null });
  const [dismissedDeep, setDismissedDeep] = useState<string | null>(null);
  const cur = sel.loc === locationId ? sel : { loc: locationId, agentId: null, runId: null };
  const runId = cur.runId ?? (deepRun && deepRun !== dismissedDeep ? deepRun : null);
  const setRunId = (id: string | null) => setSel({ ...cur, runId: id });
  const setAgentId = (id: string | null) => setSel({ loc: locationId, agentId: id, runId: null });

  const lastRunByAgent = useMemo(() => {
    const m = new Map<string, AgentRun>();
    for (const r of runs.data ?? []) if (!m.has(r.agentId)) m.set(r.agentId, r);
    return m;
  }, [runs.data]);

  const selectedRun = runs.data?.find((r) => r.id === runId) ?? null;
  const agentId = cur.agentId ?? (runId === deepRun ? (selectedRun?.agentId ?? null) : null);
  const selectedAgent = agents.data?.find((a) => a.id === agentId) ?? null;
  const agentRuns = (runs.data ?? []).filter((r) => r.agentId === agentId);

  const closeTrace = () => {
    setSel({ ...cur, agentId, runId: null });
    if (deepRun) {
      setDismissedDeep(deepRun);
      router.replace("/agents/");
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Agents" description={`What ran overnight for ${location?.name}, step by step.`} />

      <OrchestratorPanel summary={cycle.data} loading={cycle.loading} onSelectRun={(r) => setSel({ loc: locationId, agentId: r.agentId, runId: r.id })} />

      {selectedAgent ? (
        <Section
          title={
            <span className="flex items-center gap-2">
              <button onClick={() => setAgentId(null)} className="hover:bg-muted -ml-1 cursor-pointer rounded-md p-1" aria-label="Back to agents">
                <ArrowLeft className="size-4" />
              </button>
              {selectedAgent.name}
            </span>
          }
          description={`${selectedAgent.description} Runs ${selectedAgent.schedule.toLowerCase()}.`}
          bodyClassName="px-0"
        >
          {runs.loading ? (
            <div className="flex flex-col gap-2 px-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-14" />)}</div>
          ) : agentRuns.length ? (
            <ul className="divide-y">
              {agentRuns.map((r) => {
                const st = RUN_STATUS[r.status];
                return (
                  <li key={r.id}>
                    <button onClick={() => setRunId(r.id)} className="hover:bg-muted/60 flex w-full cursor-pointer items-center gap-3 px-4 py-3 text-left">
                      <st.Icon className={cn("size-4 shrink-0", r.status === "success" ? "text-emerald-600" : r.status === "needs_approval" ? "text-amber-600" : "text-red-600")} />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-2 text-sm">
                          <span className="font-medium">{shortDateWeekday(r.startedAt.slice(0, 10))}</span>
                          <span className="text-muted-foreground">{timeOfDay(r.startedAt)}</span>
                          <span className="text-muted-foreground tnum">· {r.steps.length} steps · {durationMs(r.durationMs)}</span>
                        </div>
                        <div className="text-muted-foreground truncate text-xs">{r.outcome.summary}</div>
                      </div>
                      <ChevronRight className="text-muted-foreground size-4 shrink-0" />
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="px-4">
              <EmptyState title="No runs yet" description={selectedAgent.status === "coming_soon" ? "This agent is not live yet." : "Runs will appear after the first overnight cycle."} />
            </div>
          )}
        </Section>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {agents.loading
            ? [0, 1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-36" />)
            : agents.data?.map((a) => <AgentCard key={a.id} agent={a} lastRun={lastRunByAgent.get(a.id)} mode={agentModes[a.id] ?? a.defaultMode} onOpen={() => setAgentId(a.id)} />)}
        </div>
      )}

      <Sheet open={!!selectedRun} onOpenChange={(o) => !o && closeTrace()}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg">
          {selectedRun ? (
            <>
              <SheetHeader className="pr-10">
                <div className="text-muted-foreground flex items-center gap-1.5 text-xs">
                  <Bot className="size-3.5" /> {agents.data?.find((a) => a.id === selectedRun.agentId)?.name}
                </div>
                <SheetTitle className="leading-snug">{selectedRun.goal}</SheetTitle>
                <SheetDescription>
                  {dateTime(selectedRun.startedAt)} · {durationMs(selectedRun.durationMs)} · {selectedRun.steps.length} steps
                </SheetDescription>
              </SheetHeader>
              <div className="px-4 pb-6">
                <TraceView run={selectedRun} />
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function AgentCard({ agent, lastRun, mode, onOpen }: { agent: Agent; lastRun?: AgentRun; mode: string; onOpen: () => void }) {
  const coming = agent.status === "coming_soon";
  const st = lastRun ? RUN_STATUS[lastRun.status] : null;
  return (
    <Card className={cn("gap-3 px-4 py-4", coming && "bg-muted/40")}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className={cn("grid size-8 place-items-center rounded-lg", coming ? "bg-muted text-muted-foreground" : "bg-accent text-accent-foreground")}>
            <Bot className="size-4" />
          </span>
          <div>
            <div className="font-medium leading-tight">{agent.name}</div>
            <div className="text-muted-foreground text-xs">{agent.schedule}</div>
          </div>
        </div>
        {coming ? <Badge variant="muted">Coming soon</Badge> : <Badge variant="success">Active</Badge>}
      </div>
      <p className="text-muted-foreground line-clamp-2 text-sm">{agent.description}</p>
      <div className="mt-auto flex items-center justify-between gap-2">
        {lastRun && st ? (
          <span className="text-muted-foreground inline-flex min-w-0 items-center gap-1.5 text-xs">
            <st.Icon className={cn("size-3.5 shrink-0", lastRun.status === "success" ? "text-emerald-600" : lastRun.status === "needs_approval" ? "text-amber-600" : "text-red-600")} />
            <span className="truncate">Last run {timeOfDay(lastRun.startedAt)} · {st.label}</span>
          </span>
        ) : (
          <span className="text-muted-foreground inline-flex items-center gap-1.5 text-xs">
            <Clock className="size-3.5" /> {coming ? "Not live yet" : "No runs"}
          </span>
        )}
        {!coming ? (
          <Button size="sm" variant="outline" onClick={onOpen}>
            Runs <ChevronRight />
          </Button>
        ) : null}
      </div>
      {!coming ? <div className="text-muted-foreground text-[11px]">{mode === "auto" ? "Acts automatically" : "Asks before acting"}</div> : null}
    </Card>
  );
}
