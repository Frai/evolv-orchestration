import { Module } from "@nestjs/common";
import { DbModule } from "./db/db.module";
import { ProjectsModule } from "./projects/projects.module";
import { BillingModule } from "./billing/billing.module";
import { ResourcesModule } from "./resources/resources.module";
import { SafetyModule } from "./safety/safety.module";
import { NarratorModule } from "./narrator/narrator.module";
import { NotifierModule } from "./notifier/notifier.module";
import { AgentsModule } from "./agents/agents.module";
import { ApprovalsModule } from "./approvals/approvals.module";
import { IntegrationsModule } from "./integrations/integrations.module";

@Module({
  imports: [
    DbModule,
    ProjectsModule,
    BillingModule,
    ResourcesModule,
    SafetyModule,
    NarratorModule,
    NotifierModule,
    AgentsModule,
    ApprovalsModule,
    IntegrationsModule,
  ],
})
export class AppModule {}
