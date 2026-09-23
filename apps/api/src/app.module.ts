import { Module } from "@nestjs/common";
import { DbModule } from "./db/db.module";
import { SalesModule } from "./sales/sales.module";
import { LabourModule } from "./labour/labour.module";
import { InventoryModule } from "./inventory/inventory.module";
import { AccountingModule } from "./accounting/accounting.module";
import { NarratorModule } from "./narrator/narrator.module";
import { NotifierModule } from "./notifier/notifier.module";
import { AgentsModule } from "./agents/agents.module";
import { ApprovalsModule } from "./approvals/approvals.module";
import { IntegrationsModule } from "./integrations/integrations.module";
import { PurchaseOrdersModule } from "./purchase-orders/purchase-orders.module";

@Module({
  imports: [
    DbModule,
    SalesModule,
    LabourModule,
    InventoryModule,
    AccountingModule,
    NarratorModule,
    NotifierModule,
    AgentsModule,
    ApprovalsModule,
    IntegrationsModule,
    PurchaseOrdersModule,
  ],
})
export class AppModule {}
