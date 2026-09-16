/**
 * Adapter wiring. This is the one file to change when a real source replaces a mock:
 * swap `new MockSalesSource()` for `new ToastSalesSource(...)` and the Today page goes live.
 */
import type { AccountingSource, AgentRunner, ApprovalQueue, IntegrationRegistry, InventorySource, LabourSource, Narrator, Notifier, SalesSource } from "@/ports";
import { MockSalesSource } from "./mock/MockSalesSource";
import { MockLabourSource } from "./mock/MockLabourSource";
import { MockInventorySource } from "./mock/MockInventorySource";
import { MockAccountingSource } from "./mock/MockAccountingSource";
import { MockNarrator } from "./mock/MockNarrator";
import { MockNotifier } from "./mock/MockNotifier";
import { MockAgentRunner } from "./mock/MockAgentRunner";
import { MockApprovalQueue } from "./mock/MockApprovalQueue";
import { MockIntegrationRegistry } from "./mock/MockIntegrationRegistry";

export interface Adapters {
  sales: SalesSource;
  labour: LabourSource;
  inventory: InventorySource;
  accounting: AccountingSource;
  narrator: Narrator;
  notifier: Notifier;
  agents: AgentRunner;
  approvals: ApprovalQueue;
  integrations: IntegrationRegistry;
}

export const adapters: Adapters = {
  sales: new MockSalesSource(),
  labour: new MockLabourSource(),
  inventory: new MockInventorySource(),
  accounting: new MockAccountingSource(),
  narrator: new MockNarrator(),
  notifier: new MockNotifier(),
  agents: new MockAgentRunner(),
  approvals: new MockApprovalQueue(),
  integrations: new MockIntegrationRegistry(),
};
