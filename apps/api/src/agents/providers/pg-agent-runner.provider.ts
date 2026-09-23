import { Inject, Injectable } from "@nestjs/common";
import type { Pool } from "pg";
import type { AgentRunner } from "@evolv/contracts/ports";
import type { Agent, AgentRun, OrchestratorSummary } from "@evolv/contracts/types";
import { PG_POOL } from "../../db/pg-pool.provider";

interface RunRow {
  id: string;
  agent_id: string;
  location_id: string;
  started_at: string;
  finished_at: string;
  duration_ms: number;
  status: AgentRun["status"];
  goal: string;
  steps: AgentRun["steps"];
  outcome: AgentRun["outcome"];
}
const mapRun = (r: RunRow): AgentRun => ({
  id: r.id,
  agentId: r.agent_id,
  locationId: r.location_id,
  startedAt: r.started_at,
  finishedAt: r.finished_at,
  durationMs: r.duration_ms,
  status: r.status,
  goal: r.goal,
  steps: r.steps,
  outcome: r.outcome,
});

@Injectable()
export class PgAgentRunner implements AgentRunner {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async listAgents(): Promise<Agent[]> {
    const { rows } = await this.pool.query<{ id: string; name: string; description: string; status: Agent["status"]; schedule: string; default_mode: Agent["defaultMode"] }>(
      `select id, name, description, status, schedule, default_mode from agents order by name`,
    );
    return rows.map((r) => ({ id: r.id, name: r.name, description: r.description, status: r.status, schedule: r.schedule, defaultMode: r.default_mode }));
  }

  async listRuns(locationId: string, agentId?: string): Promise<AgentRun[]> {
    const { rows } = await this.pool.query<RunRow>(
      `select id, agent_id, location_id, started_at, finished_at, duration_ms, status, goal, steps, outcome
       from agent_runs where location_id = $1 and ($2::text is null or agent_id = $2)`,
      [locationId, agentId ?? null],
    );
    return rows.map(mapRun);
  }

  async getRun(runId: string): Promise<AgentRun | undefined> {
    const { rows } = await this.pool.query<RunRow>(
      `select id, agent_id, location_id, started_at, finished_at, duration_ms, status, goal, steps, outcome from agent_runs where id = $1`,
      [runId],
    );
    return rows[0] ? mapRun(rows[0]) : undefined;
  }

  async lastCycle(locationId: string): Promise<OrchestratorSummary> {
    const { rows } = await this.pool.query<RunRow>(
      `select id, agent_id, location_id, started_at, finished_at, duration_ms, status, goal, steps, outcome
       from agent_runs where location_id = $1`,
      [locationId],
    );
    const runs = rows.map(mapRun);
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

  async runNow(locationId: string, agentId: string): Promise<AgentRun> {
    // Placeholder until the real agentic loop lands (see orchestrator/) — returns the most
    // recent historical run for this agent/location so the endpoint and UI are exercisable now.
    const { rows } = await this.pool.query<RunRow>(
      `select id, agent_id, location_id, started_at, finished_at, duration_ms, status, goal, steps, outcome
       from agent_runs where location_id = $1 and agent_id = $2 order by started_at desc limit 1`,
      [locationId, agentId],
    );
    if (rows[0]) return mapRun(rows[0]);
    const now = new Date().toISOString();
    return {
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
    };
  }
}
