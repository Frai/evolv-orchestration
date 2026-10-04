import { Injectable } from "@nestjs/common";
import type { AgentRunner } from "@evolv/contracts/ports";
import type { Agent, AgentRun, OrchestratorSummary } from "@evolv/contracts/types";
import { StoreService } from "../../store/store.service";

@Injectable()
export class MemAgentRunner implements AgentRunner {
  constructor(private readonly store: StoreService) {}

  async listAgents(): Promise<Agent[]> {
    return [...this.store.fx.agents].sort((a, b) => a.name.localeCompare(b.name));
  }

  async listRuns(companyId: string, agentId?: string): Promise<AgentRun[]> {
    return this.store.fx.runs.filter((r) => r.companyId === companyId && (!agentId || r.agentId === agentId));
  }

  async getRun(runId: string): Promise<AgentRun | undefined> {
    return this.store.fx.runs.find((r) => r.id === runId);
  }

  async lastCycle(companyId: string): Promise<OrchestratorSummary> {
    const runs = await this.listRuns(companyId);
    const latest = runs.reduce((a, r) => (r.startedAt.slice(0, 10) > a ? r.startedAt.slice(0, 10) : a), "");
    const cycle = runs.filter((r) => r.startedAt.slice(0, 10) === latest).sort((a, b) => a.startedAt.localeCompare(b.startedAt));
    return {
      date: latest,
      agents: new Set(cycle.map((r) => r.agentId)).size,
      steps: cycle.reduce((a, r) => a + r.steps.length, 0),
      approvalsPending: cycle.filter((r) => r.status === "needs_approval").length,
      errors: cycle.filter((r) => r.status === "error").length,
      runs: cycle,
    };
  }

  async runNow(companyId: string, agentId: string): Promise<AgentRun> {
    // Placeholder until the real agentic loop lands: returns the most recent historical run for this
    // agent and company so the endpoint and UI are exercisable now.
    const latest = (await this.listRuns(companyId, agentId)).sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0];
    if (latest) return latest;
    const now = new Date().toISOString();
    return {
      id: `${companyId}:${now}:${agentId}`,
      agentId,
      companyId,
      startedAt: now,
      finishedAt: now,
      durationMs: 0,
      status: "error",
      goal: "Run this agent live.",
      steps: [],
      outcome: { kind: "error", summary: "Live runs aren't wired up for this agent yet." },
    };
  }
}
