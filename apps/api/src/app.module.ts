import { Module } from "@nestjs/common";
import { FixturesModule } from "./fixtures/fixtures.module";
import { SalesModule } from "./sales/sales.module";
import { LabourModule } from "./labour/labour.module";
import { InventoryModule } from "./inventory/inventory.module";
import { AccountingModule } from "./accounting/accounting.module";
import { NarratorModule } from "./narrator/narrator.module";
import { NotifierModule } from "./notifier/notifier.module";
import { AgentsModule } from "./agents/agents.module";
import { ApprovalsModule } from "./approvals/approvals.module";
import { IntegrationsModule } from "./integrations/integrations.module";

@Module({
  imports: [
    FixturesModule,
    SalesModule,
    LabourModule,
    InventoryModule,
    AccountingModule,
    NarratorModule,
    NotifierModule,
    AgentsModule,
    ApprovalsModule,
    IntegrationsModule,
  ],
})
export class AppModule {}
