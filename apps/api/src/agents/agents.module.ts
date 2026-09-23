import { Module } from "@nestjs/common";
import { AgentsController } from "./agents.controller";
import { AGENT_RUNNER } from "./agent-runner.token";
import { PgAgentRunner } from "./providers/pg-agent-runner.provider";

@Module({
  controllers: [AgentsController],
  providers: [{ provide: AGENT_RUNNER, useClass: PgAgentRunner }],
  exports: [AGENT_RUNNER],
})
export class AgentsModule {}
