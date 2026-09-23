import { describe, expect, it } from "vitest";
import type { PoolClient } from "pg";
import type { Approval } from "@evolv/contracts/types";
import { DefaultExecutor } from "./default.executor";
import { MenuChangeExecutor } from "./menu-change.executor";
import { ScheduleChangeExecutor } from "./schedule-change.executor";
import { KitchenPacingExecutor } from "./kitchen-pacing.executor";

const approval: Approval = {
  id: "appr-1",
  locationId: "prairie-table",
  agentId: "sales-watch",
  title: "t",
  summary: "s",
  evidence: [],
  status: "pending",
  proposedAt: "2026-01-01T00:00:00.000Z",
  confirmation: "the existing canned confirmation",
  action: "a",
};
const client = {} as PoolClient;

describe("no-op executors", () => {
  it.each([
    ["DefaultExecutor", new DefaultExecutor()],
    ["MenuChangeExecutor", new MenuChangeExecutor()],
    ["ScheduleChangeExecutor", new ScheduleChangeExecutor()],
    ["KitchenPacingExecutor", new KitchenPacingExecutor()],
  ])("%s passes through the approval's existing confirmation untouched", async (_name, executor) => {
    await expect(executor.execute(approval, client)).resolves.toBe("the existing canned confirmation");
  });
});
