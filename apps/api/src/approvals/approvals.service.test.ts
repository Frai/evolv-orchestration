import { describe, expect, it, vi } from "vitest";
import type { Pool, PoolClient } from "pg";
import type { Approval } from "@evolv/contracts/types";
import { ApprovalsService } from "./approvals.service";
import type { ApprovalRepository } from "./approval.repository";
import type { InventoryReorderExecutor } from "./executors/inventory-reorder.executor";
import type { MenuChangeExecutor } from "./executors/menu-change.executor";
import type { ScheduleChangeExecutor } from "./executors/schedule-change.executor";
import type { KitchenPacingExecutor } from "./executors/kitchen-pacing.executor";
import type { DefaultExecutor } from "./executors/default.executor";

function approval(overrides: Partial<Approval> = {}): Approval {
  return {
    id: "appr-1",
    locationId: "prairie-table",
    agentId: "inventory-guard",
    title: "Reorder flour",
    summary: "Flour is running low.",
    evidence: [],
    status: "pending",
    proposedAt: "2026-01-01T00:00:00.000Z",
    confirmation: "canned",
    action: "Reorder flour.",
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

  const inventoryReorder = { execute: vi.fn().mockResolvedValue("inventory confirmation") } as unknown as InventoryReorderExecutor;
  const menuChange = { execute: vi.fn().mockResolvedValue("menu confirmation") } as unknown as MenuChangeExecutor;
  const scheduleChange = { execute: vi.fn().mockResolvedValue("schedule confirmation") } as unknown as ScheduleChangeExecutor;
  const kitchenPacing = { execute: vi.fn().mockResolvedValue("kitchen confirmation") } as unknown as KitchenPacingExecutor;
  const defaultExecutor = { execute: vi.fn().mockResolvedValue("default confirmation") } as unknown as DefaultExecutor;

  const service = new ApprovalsService(pool, store, inventoryReorder, menuChange, scheduleChange, kitchenPacing, defaultExecutor);
  return { service, store, client, executors: { inventoryReorder, menuChange, scheduleChange, kitchenPacing, defaultExecutor } };
}

describe("ApprovalsService.resolve", () => {
  it("dispatches an approved inventory-guard approval to InventoryReorderExecutor", async () => {
    const { service, store, executors } = buildService({ agentId: "inventory-guard" });
    const result = await service.resolve({ approvalId: "appr-1", status: "approved" });

    expect(executors.inventoryReorder.execute).toHaveBeenCalledTimes(1);
    expect(executors.defaultExecutor.execute).not.toHaveBeenCalled();
    expect(store.update).toHaveBeenCalledWith(
      "appr-1",
      expect.objectContaining({ status: "approved", confirmation: "inventory confirmation" }),
      expect.anything(),
    );
    expect(result.confirmation).toBe("inventory confirmation");
  });

  it("routes each known agentId to its own executor", async () => {
    const cases: Array<[string, string]> = [
      ["sales-watch", "menu confirmation"],
      ["labour-optimizer", "schedule confirmation"],
      ["kitchen-pacing", "kitchen confirmation"],
    ];
    for (const [agentId, expected] of cases) {
      const { service } = buildService({ agentId });
      const result = await service.resolve({ approvalId: "appr-1", status: "approved" });
      expect(result.confirmation).toBe(expected);
    }
  });

  it("falls back to DefaultExecutor for an unknown agentId", async () => {
    const { service, executors } = buildService({ agentId: "some-future-agent" });
    await service.resolve({ approvalId: "appr-1", status: "approved" });
    expect(executors.defaultExecutor.execute).toHaveBeenCalledTimes(1);
  });

  it("does not run any executor when rejecting", async () => {
    const { service, store, executors } = buildService({ agentId: "inventory-guard" });
    const result = await service.resolve({ approvalId: "appr-1", status: "rejected" });

    expect(executors.inventoryReorder.execute).not.toHaveBeenCalled();
    expect(result.status).toBe("rejected");
    expect(store.update).toHaveBeenCalledWith(
      "appr-1",
      expect.objectContaining({ status: "rejected", confirmation: "canned" }),
      expect.anything(),
    );
  });

  it("uses editedAction over the original action when provided", async () => {
    const { service, store } = buildService({ agentId: "inventory-guard" });
    await service.resolve({ approvalId: "appr-1", status: "approved", editedAction: "Reorder from a different supplier." });
    expect(store.update).toHaveBeenCalledWith(
      "appr-1",
      expect.objectContaining({ action: "Reorder from a different supplier." }),
      expect.anything(),
    );
  });

  it("throws NotFoundException when the approval does not exist", async () => {
    const { service } = buildService({ notFound: true });
    await expect(service.resolve({ approvalId: "missing", status: "approved" })).rejects.toThrow(/not found/i);
  });
});
