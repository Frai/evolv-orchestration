import type { Agent, AgentRun, OrchestratorSummary } from "../domain";

export interface AgentRunner {
  listAgents(): Promise<Agent[]>;
  listRuns(locationId: string, agentId?: string): Promise<AgentRun[]>;
  getRun(runId: string): Promise<AgentRun | undefined>;
  /** Summary of the most recent overnight cycle. */
  lastCycle(locationId: string): Promise<OrchestratorSummary>;
}
