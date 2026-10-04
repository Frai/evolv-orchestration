import { describe, expect, it, vi } from "vitest";
import type { Approval } from "@evolv/contracts/types";
import { ChangeOrderExecutor } from "./change-order.executor";
import type { ChangeOrderRepository } from "../../billing/change-order.repository";

function approval(overrides: Partial<Approval> = {}): Approval {
  return {
    id: "appr-1",
    companyId: "foothills-pipeline",
    agentId: "change-order-catcher",
    title: "Change order request: Rock excavation",
    summary: "Hours booked with no change order.",
    amount: 110_200,
    refId: "ridge-loop:99-100",
    evidence: [],
    status: "pending",
    proposedAt: "2026-01-01T00:00:00.000Z",
    confirmation: "Canned fallback confirmation.",
    action: "Submit a change order.",
    ...overrides,
  };
}

describe("ChangeOrderExecutor", () => {
  it("creates a pending change order for the extra-work cost code and names it in the confirmation", async () => {
    const findExtraWorkCode = vi.fn().mockResolvedValue({ codeId: "ridge-loop:99-100", jobId: "ridge-loop", name: "Rock excavation (T&M, outside scope)", client: "Summit Creek Energy" });
    const create = vi.fn().mockResolvedValue({ id: "ridge-loop:co-2", number: "CO-002" });
    const executor = new ChangeOrderExecutor({ findExtraWorkCode, create } as unknown as ChangeOrderRepository);

    const confirmation = await executor.execute(approval());

    expect(findExtraWorkCode).toHaveBeenCalledWith("ridge-loop:99-100");
    expect(create).toHaveBeenCalledWith(
      { jobId: "ridge-loop", codeId: "ridge-loop:99-100", title: "Extra work: Rock excavation (T&M, outside scope)", amount: 110_200 },
    );
    expect(confirmation).toContain("CO-002");
    expect(confirmation).toContain("$110,200");
    expect(confirmation).toContain("Summit Creek Energy");
  });

  it("falls back to the canned confirmation when the approval has no refId", async () => {
    const findExtraWorkCode = vi.fn();
    const create = vi.fn();
    const executor = new ChangeOrderExecutor({ findExtraWorkCode, create } as unknown as ChangeOrderRepository);

    await expect(executor.execute(approval({ refId: undefined }))).resolves.toBe("Canned fallback confirmation.");
    expect(findExtraWorkCode).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });

  it("falls back to the canned confirmation when the cost code cannot be found", async () => {
    const findExtraWorkCode = vi.fn().mockResolvedValue(undefined);
    const create = vi.fn();
    const executor = new ChangeOrderExecutor({ findExtraWorkCode, create } as unknown as ChangeOrderRepository);

    await expect(executor.execute(approval())).resolves.toBe("Canned fallback confirmation.");
    expect(create).not.toHaveBeenCalled();
  });
});
