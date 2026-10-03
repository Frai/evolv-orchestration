import type { Agent, AgentRun, OrchestratorSummary } from "../domain";

export interface AgentRunner {
  listAgents(): Promise<Agent[]>;
  listRuns(companyId: string, agentId?: string): Promise<AgentRun[]>;
  getRun(runId: string): Promise<AgentRun | undefined>;
  /** Summary of the most recent overnight cycle. */
  lastCycle(companyId: string): Promise<OrchestratorSummary>;
  /** Runs one agent's cycle live, on demand, and persists the resulting run. */
  runNow(companyId: string, agentId: string): Promise<AgentRun>;
}
