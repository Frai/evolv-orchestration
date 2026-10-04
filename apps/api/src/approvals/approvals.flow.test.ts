import { beforeAll, describe, expect, it } from "vitest";
import { addDays } from "@evolv/contracts/dates";
import { missingChangeOrders } from "@evolv/contracts/billing";
import { StoreService } from "../store/store.service";
import { ChangeOrderRepository } from "../billing/change-order.repository";
import { ApprovalRepository } from "./approval.repository";
import { ApprovalsService } from "./approvals.service";
import { ChangeOrderExecutor } from "./executors/change-order.executor";
import { DefaultExecutor } from "./executors/default.executor";
import { MemProjectSource } from "../projects/providers/mem-project.provider";

/** Real store, real services, no mocks: the approve-a-change-order story end to end. */
describe("approving a change-order draft", () => {
  let store: StoreService;
  let service: ApprovalsService;

  beforeAll(() => {
    process.env.FIXTURE_TODAY = "2026-10-03";
    store = new StoreService();
    service = new ApprovalsService(new ApprovalRepository(store), new ChangeOrderExecutor(new ChangeOrderRepository(store)), new DefaultExecutor());
  });

  const draftId = "foothills-pipeline:2026-10-02:change-order-catcher:change_orders";
  const uncovered = () => missingChangeOrders(store.fx.codes, store.fx.costDays, store.fx.changeOrders, store.fx.meta.asOf).filter((m) => m.jobId === "ridge-loop");

  it("starts with an uncovered extra-work code and a pending draft", async () => {
    expect(uncovered()).toHaveLength(1);
    const pending = (await service.list("foothills-pipeline")).find((a) => a.id === draftId);
    expect(pending?.status).toBe("pending");
    expect(pending?.refId).toBe("ridge-loop:99-100");
  });

  it("writes a pending change order, clears the signal and records the decision", async () => {
    const before = store.fx.changeOrders.length;
    const result = await service.resolve({ approvalId: draftId, status: "approved" });

    expect(result.status).toBe("approved");
    expect(result.confirmation).toMatch(/CO-002/);
    expect(store.fx.changeOrders).toHaveLength(before + 1);
    expect(store.fx.changeOrders.at(-1)).toMatchObject({ jobId: "ridge-loop", codeId: "ridge-loop:99-100", status: "pending", amount: 110_200 });
    expect(uncovered()).toHaveLength(0);
  });

  it("does not write a second change order if the same approval is approved again", async () => {
    const before = store.fx.changeOrders.length;
    await service.resolve({ approvalId: draftId, status: "approved" });
    expect(store.fx.changeOrders).toHaveLength(before);
  });

  it("serves the same as-of date the fixtures were built for", async () => {
    expect(await new MemProjectSource(store).latestDate("foothills-pipeline")).toBe(addDays("2026-10-03", -1));
  });
});
