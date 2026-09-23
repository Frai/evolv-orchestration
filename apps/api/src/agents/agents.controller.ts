import { Body, Controller, Get, Inject, Param, Post, Query } from "@nestjs/common";
import type { AgentRunner } from "@evolv/contracts/ports";
import { AGENT_RUNNER } from "./agent-runner.token";

interface RunNowBody {
  locationId: string;
  agentId: string;
}

@Controller("agents")
export class AgentsController {
  constructor(@Inject(AGENT_RUNNER) private readonly runner: AgentRunner) {}

  @Get()
  listAgents() {
    return this.runner.listAgents();
  }

  @Get("runs")
  listRuns(@Query("locationId") locationId: string, @Query("agentId") agentId: string | undefined) {
    return this.runner.listRuns(locationId, agentId);
  }

  @Get("runs/:runId")
  getRun(@Param("runId") runId: string) {
    return this.runner.getRun(runId);
  }

  @Get("last-cycle")
  lastCycle(@Query("locationId") locationId: string) {
    return this.runner.lastCycle(locationId);
  }

  @Post("run-now")
  runNow(@Body() body: RunNowBody) {
    return this.runner.runNow(body.locationId, body.agentId);
  }
}
