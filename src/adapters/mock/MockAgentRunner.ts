import type { AgentRunner } from "@/ports/AgentRunner";
import type { Agent, AgentRun, OrchestratorSummary } from "@/core/types";
import { fixtures, latency } from "./data";

export class MockAgentRunner implements AgentRunner {
  async listAgents(): Promise<Agent[]> {
    return latency(fixtures.agents, 30);
  }
  async listRuns(locationId: string, agentId?: string): Promise<AgentRun[]> {
    return latency(fixtures.runs.filter((r) => r.locationId === locationId && (agentId ? r.agentId === agentId : true)));
  }
  async getRun(runId: string): Promise<AgentRun | undefined> {
    return latency(fixtures.runs.find((r) => r.id === runId), 60);
  }
  async lastCycle(locationId: string): Promise<OrchestratorSummary> {
    const runs = fixtures.runs.filter((r) => r.locationId === locationId);
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
}
