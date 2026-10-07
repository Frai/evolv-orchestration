import { beforeEach, describe, expect, it } from "vitest";
import { addDays } from "@evolv/contracts/dates";
import { missingChangeOrders } from "@evolv/contracts/billing";
import { detectAlerts } from "@evolv/contracts/alerts";
import { loadSnapshot } from "@/lib/api-client";
import * as backend from "./backend";
import { getStore, resetStore } from "./store";

const COMPANY = "foothills-pipeline";
const DRAFT = `${COMPANY}:2026-10-02:change-order-catcher:change_orders`;

beforeEach(() => {
  process.env.NEXT_PUBLIC_FIXTURE_TODAY = "2026-10-03"; // a Saturday: "yesterday" is Friday the 2nd
  resetStore();
});

describe("the demo world", () => {
  it("is deterministic for a pinned date", () => {
    const a = getStore().fx.costDays.length;
    resetStore();
    expect(getStore().fx.costDays.length).toBe(a);
  });

  it("treats the last workday as yesterday, so a weekend demo shows Friday", async () => {
    expect(await backend.projects.latestDate(COMPANY)).toBe("2026-10-02");
    process.env.NEXT_PUBLIC_FIXTURE_TODAY = "2026-10-05"; // Monday: yesterday is Sunday, so back to Friday
    resetStore();
    expect(await backend.projects.latestDate(COMPANY)).toBe("2026-10-02");
  });

  it("scopes every read to the company", async () => {
    const jobs = await backend.projects.listJobs(COMPANY);
    expect(jobs).toHaveLength(3);
    const tickets = await backend.billing.getFieldTickets("peace-river-oilfield");
    expect(tickets.every((t) => t.companyId === "peace-river-oilfield")).toBe(true);
    const oneJob = await backend.projects.getCostCodes(COMPANY, "ridge-loop");
    expect(oneJob.every((c) => c.jobId === "ridge-loop")).toBe(true);
  });

  it("filters cost days to the requested range", async () => {
    const days = await backend.projects.getCostDays({ companyId: COMPANY, range: { from: "2026-09-28", to: "2026-10-02" } });
    expect(days.length).toBeGreaterThan(0);
    expect(days.every((d) => d.date >= "2026-09-28" && d.date <= "2026-10-02")).toBe(true);
  });
});

describe("loadSnapshot", () => {
  it("returns the whole canonical model for the company", async () => {
    const snap = await loadSnapshot(COMPANY, "2026-10-02");
    expect(snap.jobs).toHaveLength(3);
    expect(snap.codes.length).toBeGreaterThan(20);
    expect(snap.costDays.every((d) => d.date >= addDays("2026-10-02", -89))).toBe(true);
  });
});

describe("narrator.ask", () => {
  it("picks the pair with the highest keyword score", async () => {
    const r = await backend.narrator.ask(COMPANY, "2026-10-02", "which jobs have margin risk");
    expect(r.question).toBe("Which jobs are at margin risk?");
  });

  it("gives an exact question match a large bonus", async () => {
    const q = (await backend.narrator.suggestedQuestions(COMPANY))[2];
    expect((await backend.narrator.ask(COMPANY, "2026-10-02", q)).question).toBe(q);
  });

  it("falls back to a canned answer naming the company when nothing scores", async () => {
    const r = await backend.narrator.ask(COMPANY, "2026-10-02", "what is the weather today");
    expect(r.answer).toContain("Foothills Pipeline & Civil");
    expect(r.keywords).toEqual([]);
  });
});

describe("approving a change-order draft", () => {
  const uncovered = () => {
    const { fx } = getStore();
    return missingChangeOrders(fx.codes, fx.costDays, fx.changeOrders, fx.meta.asOf).filter((m) => m.jobId === "ridge-loop");
  };

  it("starts with an uncovered extra-work code and a pending draft", async () => {
    expect(uncovered()).toHaveLength(1);
    const draft = (await backend.approvals.listApprovals(COMPANY)).find((a) => a.id === DRAFT);
    expect(draft).toMatchObject({ status: "pending", refId: "ridge-loop:99-100" });
  });

  it("adds a pending change order, clears the signal and records the decision", async () => {
    const before = getStore().fx.changeOrders.length;
    const result = await backend.approvals.resolve({ approvalId: DRAFT, status: "approved" });

    expect(result.status).toBe("approved");
    expect(result.confirmation).toMatch(/CO-002/);
    expect(getStore().fx.changeOrders).toHaveLength(before + 1);
    expect(getStore().fx.changeOrders.at(-1)).toMatchObject({ jobId: "ridge-loop", codeId: "ridge-loop:99-100", status: "pending", amount: 110_200 });
    expect(uncovered()).toHaveLength(0);

    const { fx } = getStore();
    const company = fx.companies.find((c) => c.id === COMPANY)!;
    const alerts = detectAlerts({ company, date: fx.meta.asOf, ...(await loadSnapshot(COMPANY, fx.meta.asOf)) });
    expect(alerts.some((a) => a.source === "change_orders")).toBe(false);
  });

  it("writes nothing the second time the same approval is approved", async () => {
    await backend.approvals.resolve({ approvalId: DRAFT, status: "approved" });
    const after = getStore().fx.changeOrders.length;
    await backend.approvals.resolve({ approvalId: DRAFT, status: "approved" });
    expect(getStore().fx.changeOrders).toHaveLength(after);
  });

  it("writes nothing when the draft is rejected", async () => {
    const before = getStore().fx.changeOrders.length;
    const result = await backend.approvals.resolve({ approvalId: DRAFT, status: "rejected" });
    expect(result.status).toBe("rejected");
    expect(getStore().fx.changeOrders).toHaveLength(before);
  });

  it("uses the edited action when one is supplied", async () => {
    const result = await backend.approvals.resolve({ approvalId: DRAFT, status: "approved", editedAction: "Submit at cost, no markup." });
    expect(result.action).toBe("Submit at cost, no markup.");
  });

  it("only the change-order agent writes: every other approval just records the decision", async () => {
    const other = (await backend.approvals.listApprovals(COMPANY)).find((a) => a.status === "pending" && a.agentId !== "change-order-catcher")!;
    const before = getStore().fx.changeOrders.length;
    const result = await backend.approvals.resolve({ approvalId: other.id, status: "approved" });
    expect(result.status).toBe("approved");
    expect(result.confirmation).toBe(other.confirmation);
    expect(getStore().fx.changeOrders).toHaveLength(before);
  });

  it("rejects an unknown approval id", async () => {
    await expect(backend.approvals.resolve({ approvalId: "nope", status: "approved" })).rejects.toThrow(/not found/i);
  });
});
