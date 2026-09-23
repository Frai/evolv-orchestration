import { Injectable } from "@nestjs/common";
import type { AgentRunner } from "@evolv/contracts/ports";
import type { Agent, AgentRun, OrchestratorSummary } from "@evolv/contracts/types";
import { FixturesService, latency } from "../../fixtures/fixtures.service";

@Injectable()
export class MockAgentRunner implements AgentRunner {
  constructor(private readonly fixtures: FixturesService) {}

  async listAgents(): Promise<Agent[]> {
    return latency(this.fixtures.agents, 30);
  }
  async listRuns(locationId: string, agentId?: string): Promise<AgentRun[]> {
    return latency(this.fixtures.runs.filter((r) => r.locationId === locationId && (agentId ? r.agentId === agentId : true)));
  }
  async getRun(runId: string): Promise<AgentRun | undefined> {
    return latency(this.fixtures.runs.find((r) => r.id === runId), 60);
  }
  async lastCycle(locationId: string): Promise<OrchestratorSummary> {
    const runs = this.fixtures.runs.filter((r) => r.locationId === locationId);
    const latest = runs.reduce((a, r) => (r.startedAt.slice(0, 10) > a ? r.startedAt.slice(0, 10) : a), "");
    const cycle = runs.filter((r) => r.startedAt.slice(0, 10) === latest).sort((a, b) => a.startedAt.localeCompare(b.startedAt));
    return latency({
      date: latest,
      agents: new Set(cycle.map((r) => r.agentId)).size,
      steps: cycle.reduce((a, r) => a + r.steps.length, 0),
      approvalsPending: cycle.filter((r) => r.status === "needs_approval").length,
      errors: cycle.filter((r) => r.status === "error").length,
      runs: cycle,
    });
  }
  async runNow(locationId: string, agentId: string): Promise<AgentRun> {
    // Placeholder until the real agentic loop lands (see orchestrator/) — returns the most
    // recent historical run for this agent/location so the endpoint and UI are exercisable now.
    const runs = this.fixtures.runs.filter((r) => r.locationId === locationId && r.agentId === agentId);
    const latest = runs.sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0];
    if (latest) return latency(latest, 400);
    const now = new Date().toISOString();
    return latency(
      {
        id: `${locationId}:${now}:${agentId}`,
        agentId,
        locationId,
        startedAt: now,
        finishedAt: now,
        durationMs: 0,
        status: "error",
        goal: "Run this agent live.",
        steps: [],
        outcome: { kind: "error", summary: "Live runs aren't wired up for this agent yet." },
      },
      400,
    );
  }
}
