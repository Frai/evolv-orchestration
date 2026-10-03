import { describe, expect, it, vi } from "vitest";
import type { Pool, PoolClient } from "pg";
import type { Approval } from "@evolv/contracts/types";
import { ApprovalsService } from "./approvals.service";
import type { ApprovalRepository } from "./approval.repository";
import type { ChangeOrderExecutor } from "./executors/change-order.executor";
import type { DefaultExecutor } from "./executors/default.executor";

function approval(overrides: Partial<Approval> = {}): Approval {
  return {
    id: "appr-1",
    companyId: "foothills-pipeline",
    agentId: "change-order-catcher",
    title: "Change order request",
    summary: "Hours booked with no change order.",
    evidence: [],
    status: "pending",
    proposedAt: "2026-01-01T00:00:00.000Z",
    confirmation: "canned",
    action: "Submit a change order.",
    ...overrides,
  };
}

/** A fake Pool whose connect() hands back a fake client that tolerates BEGIN/COMMIT/ROLLBACK. */
function fakePool() {
  const client = { query: vi.fn().mockResolvedValue({ rows: [] }), release: vi.fn() } as unknown as PoolClient;
  const pool = { connect: vi.fn().mockResolvedValue(client) } as unknown as Pool;
  return { pool, client };
}

function buildService(overrides: { notFound?: boolean; agentId?: string } = {}) {
  const { pool, client } = fakePool();
  const store = {
    get: vi.fn().mockResolvedValue(overrides.notFound ? undefined : approval({ agentId: overrides.agentId })),
    update: vi.fn().mockImplementation(async (id: string, patch: Partial<Approval>) => ({ ...approval(), id, ...patch })),
  } as unknown as ApprovalRepository;

  const changeOrder = { execute: vi.fn().mockResolvedValue("change order confirmation") } as unknown as ChangeOrderExecutor;
  const defaultExecutor = { execute: vi.fn().mockResolvedValue("default confirmation") } as unknown as DefaultExecutor;

  const service = new ApprovalsService(pool, store, changeOrder, defaultExecutor);
  return { service, store, client, executors: { changeOrder, defaultExecutor } };
}

describe("ApprovalsService.resolve", () => {
  it("dispatches an approved change-order-catcher approval to ChangeOrderExecutor", async () => {
    const { service, store, executors } = buildService({ agentId: "change-order-catcher" });
    const result = await service.resolve({ approvalId: "appr-1", status: "approved" });

    expect(executors.changeOrder.execute).toHaveBeenCalledTimes(1);
    expect(executors.defaultExecutor.execute).not.toHaveBeenCalled();
    expect(store.update).toHaveBeenCalledWith("appr-1", expect.objectContaining({ status: "approved", confirmation: "change order confirmation" }), expect.anything());
    expect(result.confirmation).toBe("change order confirmation");
  });

  it.each(["margin-sentinel", "labor-analyst", "billing-accelerator", "materials-watcher", "safety-coordinator", "some-future-agent"])(
    "falls back to DefaultExecutor for %s: drafts only, no write-back",
    async (agentId) => {
      const { service, executors } = buildService({ agentId });
      const result = await service.resolve({ approvalId: "appr-1", status: "approved" });
      expect(executors.defaultExecutor.execute).toHaveBeenCalledTimes(1);
      expect(executors.changeOrder.execute).not.toHaveBeenCalled();
      expect(result.confirmation).toBe("default confirmation");
    },
  );

  it("does not run any executor when rejecting", async () => {
    const { service, store, executors } = buildService({ agentId: "change-order-catcher" });
    const result = await service.resolve({ approvalId: "appr-1", status: "rejected" });

    expect(executors.changeOrder.execute).not.toHaveBeenCalled();
    expect(result.status).toBe("rejected");
    expect(store.update).toHaveBeenCalledWith("appr-1", expect.objectContaining({ status: "rejected", confirmation: "canned" }), expect.anything());
  });

  it("uses editedAction over the original action when provided", async () => {
    const { service, store } = buildService({ agentId: "change-order-catcher" });
    await service.resolve({ approvalId: "appr-1", status: "approved", editedAction: "Submit at cost, no markup." });
    expect(store.update).toHaveBeenCalledWith("appr-1", expect.objectContaining({ action: "Submit at cost, no markup." }), expect.anything());
  });

  it("throws NotFoundException when the approval does not exist", async () => {
    const { service } = buildService({ notFound: true });
    await expect(service.resolve({ approvalId: "missing", status: "approved" })).rejects.toThrow(/not found/i);
  });
});
