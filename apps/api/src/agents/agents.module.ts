import { Module } from "@nestjs/common";
import { AgentsController } from "./agents.controller";
import { AGENT_RUNNER } from "./agent-runner.token";
import { MemAgentRunner } from "./providers/mem-agent-runner.provider";

@Module({
  controllers: [AgentsController],
  providers: [{ provide: AGENT_RUNNER, useClass: MemAgentRunner }],
  exports: [AGENT_RUNNER],
})
export class AgentsModule {}
