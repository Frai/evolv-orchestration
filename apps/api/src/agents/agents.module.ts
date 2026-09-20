import { Module } from "@nestjs/common";
import { FixturesModule } from "../fixtures/fixtures.module";
import { AgentsController } from "./agents.controller";
import { AGENT_RUNNER } from "./agent-runner.token";
import { MockAgentRunner } from "./providers/mock-agent-runner.provider";

@Module({
  imports: [FixturesModule],
  controllers: [AgentsController],
  providers: [{ provide: AGENT_RUNNER, useClass: MockAgentRunner }],
  exports: [AGENT_RUNNER],
})
export class AgentsModule {}
