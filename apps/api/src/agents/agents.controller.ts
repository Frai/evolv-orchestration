import { Body, Controller, Get, Inject, Param, Post, Query } from "@nestjs/common";
import type { AgentRunner } from "@evolv/contracts/ports";
import { AGENT_RUNNER } from "./agent-runner.token";

interface RunNowBody {
  companyId: string;
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
  listRuns(@Query("companyId") companyId: string, @Query("agentId") agentId: string | undefined) {
    return this.runner.listRuns(companyId, agentId);
  }

  @Get("runs/:runId")
  getRun(@Param("runId") runId: string) {
    return this.runner.getRun(runId);
  }

  @Get("last-cycle")
  lastCycle(@Query("companyId") companyId: string) {
    return this.runner.lastCycle(companyId);
  }

  @Post("run-now")
  runNow(@Body() body: RunNowBody) {
    return this.runner.runNow(body.companyId, body.agentId);
  }
}
