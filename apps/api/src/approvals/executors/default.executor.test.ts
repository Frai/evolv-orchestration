import { describe, expect, it } from "vitest";
import type { Approval } from "@evolv/contracts/types";
import { DefaultExecutor } from "./default.executor";

const approval: Approval = {
  id: "appr-1",
  companyId: "foothills-pipeline",
  agentId: "billing-accelerator",
  title: "t",
  summary: "s",
  evidence: [],
  status: "pending",
  proposedAt: "2026-01-01T00:00:00.000Z",
  confirmation: "the existing canned confirmation",
  action: "a",
};

describe("DefaultExecutor", () => {
  it("passes through the approval's existing confirmation untouched: drafts only, no write-back", async () => {
    await expect(new DefaultExecutor().execute(approval)).resolves.toBe("the existing canned confirmation");
  });
});
