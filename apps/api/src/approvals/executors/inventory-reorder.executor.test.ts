import { describe, expect, it, vi } from "vitest";
import type { PoolClient } from "pg";
import type { Approval, StockLevel } from "@evolv/contracts/types";
import { InventoryReorderExecutor } from "./inventory-reorder.executor";
import type { StockRepository } from "../../inventory/stock.repository";
import type { PurchaseOrderRepository } from "../../purchase-orders/purchase-order.repository";

const FAKE_CLIENT = {} as PoolClient;

function approval(overrides: Partial<Approval> = {}): Approval {
  return {
    id: "appr-1",
    locationId: "prairie-table",
    agentId: "inventory-guard",
    title: "Reorder flour",
    summary: "Flour is running low.",
    itemId: "flour",
    evidence: [],
    status: "pending",
    proposedAt: "2026-01-01T00:00:00.000Z",
    confirmation: "Canned fallback confirmation.",
    action: "Reorder flour from Sysco.",
    ...overrides,
  };
}

function stock(overrides: Partial<StockLevel> = {}): StockLevel {
  return {
    locationId: "prairie-table",
    itemId: "flour",
    name: "Flour",
    category: "dry goods",
    unit: "kg",
    onHand: 10,
    par: 50,
    dailyUsage: 5,
    unitCost: 2,
    supplier: "Sysco",
    countedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("InventoryReorderExecutor", () => {
  it("creates a purchase order and bumps stock to par + daily usage", async () => {
    const item = stock({ par: 50, dailyUsage: 5, onHand: 10, unitCost: 2, supplier: "Sysco", name: "Flour", unit: "kg" });
    const find = vi.fn().mockResolvedValue(item);
    const setOnHand = vi.fn().mockResolvedValue({ ...item, onHand: 55 });
    const create = vi.fn().mockResolvedValue({
      id: "po-0001",
      locationId: item.locationId,
      approvalId: "appr-1",
      itemId: item.itemId,
      itemName: item.name,
      qty: 50,
      unit: item.unit,
      unitCost: item.unitCost,
      totalCost: 100,
      supplier: item.supplier,
      createdAt: "2026-01-02T00:00:00.000Z",
      status: "sent" as const,
    });

    const executor = new InventoryReorderExecutor(
      { find, setOnHand } as unknown as StockRepository,
      { create } as unknown as PurchaseOrderRepository,
    );

    const confirmation = await executor.execute(approval(), FAKE_CLIENT);

    expect(find).toHaveBeenCalledWith("prairie-table", "flour", FAKE_CLIENT);
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ locationId: "prairie-table", itemId: "flour", supplier: "Sysco" }),
      FAKE_CLIENT,
    );
    // par (50) + dailyUsage (5) = 55, restocked above par.
    expect(setOnHand).toHaveBeenCalledWith("prairie-table", "flour", 55, FAKE_CLIENT);
    expect(confirmation).toContain("po-0001");
    expect(confirmation).toContain("Sysco");
  });

  it("falls back to the canned confirmation when the approval has no itemId", async () => {
    const find = vi.fn();
    const setOnHand = vi.fn();
    const create = vi.fn();
    const executor = new InventoryReorderExecutor(
      { find, setOnHand } as unknown as StockRepository,
      { create } as unknown as PurchaseOrderRepository,
    );

    const confirmation = await executor.execute(approval({ itemId: undefined }), FAKE_CLIENT);

    expect(confirmation).toBe("Canned fallback confirmation.");
    expect(find).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });

  it("falls back to the canned confirmation when the stock item cannot be found", async () => {
    const find = vi.fn().mockResolvedValue(undefined);
    const setOnHand = vi.fn();
    const create = vi.fn();
    const executor = new InventoryReorderExecutor(
      { find, setOnHand } as unknown as StockRepository,
      { create } as unknown as PurchaseOrderRepository,
    );

    const confirmation = await executor.execute(approval(), FAKE_CLIENT);

    expect(confirmation).toBe("Canned fallback confirmation.");
    expect(create).not.toHaveBeenCalled();
    expect(setOnHand).not.toHaveBeenCalled();
  });
});
