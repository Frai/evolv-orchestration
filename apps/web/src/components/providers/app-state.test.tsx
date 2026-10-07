import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import type { Approval, Company } from "@evolv/contracts/types";
import type { Snapshot } from "@/lib/api-client";
import { AppStateProvider, useAppState } from "./app-state";

const { listCompanies, latestDate, listAgents, listApprovals, listIntegrations, resolve, loadSnapshot } = vi.hoisted(() => ({
  listCompanies: vi.fn(),
  latestDate: vi.fn(),
  listAgents: vi.fn(),
  listApprovals: vi.fn(),
  listIntegrations: vi.fn(),
  resolve: vi.fn(),
  loadSnapshot: vi.fn(),
}));

vi.mock("@/lib/api-client", () => ({
  apiClient: {
    projects: {
      listCompanies: (...args: unknown[]) => listCompanies(...args),
      latestDate: (...args: unknown[]) => latestDate(...args),
    },
    agents: { listAgents: (...args: unknown[]) => listAgents(...args) },
    approvals: {
      listApprovals: (...args: unknown[]) => listApprovals(...args),
      resolve: (...args: unknown[]) => resolve(...args),
    },
    integrations: { listIntegrations: (...args: unknown[]) => listIntegrations(...args) },
  },
  loadSnapshot: (...args: unknown[]) => loadSnapshot(...args),
}));

const COMPANY: Company = {
  id: "foothills-pipeline",
  name: "Foothills Pipeline & Civil",
  shortName: "Foothills",
  segment: "pipeline_civil",
  accounting: "vista",
  city: "Calgary, AB",
  currency: "CAD",
  employeeCount: 140,
  targetMarginPct: 0.12,
  owner: { name: "Owner", role: "Controller", phone: "555", email: "owner@example.com" },
};

const EMPTY_SNAPSHOT: Snapshot = {
  companyId: "foothills-pipeline",
  asOf: "2026-01-04",
  jobs: [],
  codes: [],
  costDays: [],
  tickets: [],
  invoices: [],
  changeOrders: [],
  equipment: [],
  commitments: [],
  safety: [],
};

function approval(overrides: Partial<Approval> = {}): Approval {
  return {
    id: "appr-1",
    companyId: "foothills-pipeline",
    agentId: "change-order-catcher",
    title: "Change order request",
    summary: "s",
    evidence: [],
    status: "pending",
    proposedAt: "2026-01-01T00:00:00.000Z",
    confirmation: "c",
    action: "a",
    ...overrides,
  };
}

function wrapper({ children }: { children: ReactNode }) {
  return <AppStateProvider>{children}</AppStateProvider>;
}

function mockBasics(approvals: Approval[] = [], agents: unknown[] = []) {
  listCompanies.mockResolvedValue([COMPANY]);
  latestDate.mockResolvedValue("2026-01-04");
  listAgents.mockResolvedValue(agents);
  listApprovals.mockResolvedValue(approvals);
  listIntegrations.mockResolvedValue([]);
  loadSnapshot.mockResolvedValue(EMPTY_SNAPSHOT);
}

afterEach(() => {
  vi.resetAllMocks();
});

describe("AppStateProvider", () => {
  it("loads companies, date and agent modes on mount and becomes ready", async () => {
    mockBasics([], [{ id: "margin-sentinel", name: "Margin Sentinel", description: "d", status: "active", schedule: "nightly", defaultMode: "ask_first" }]);

    const { result } = renderHook(() => useAppState(), { wrapper });
    await waitFor(() => expect(result.current.ready).toBe(true));

    expect(result.current.companies).toEqual([COMPANY]);
    expect(result.current.asOf).toBe("2026-01-04");
    expect(result.current.agentModes).toEqual({ "margin-sentinel": "ask_first" });
  });

  it("loads the selected company's snapshot and computes signals over it", async () => {
    mockBasics();

    const { result } = renderHook(() => useAppState(), { wrapper });
    await waitFor(() => expect(result.current.snapshot).toBeDefined());

    expect(loadSnapshot).toHaveBeenCalledWith("foothills-pipeline", "2026-01-04");
    expect(result.current.snapshotLoading).toBe(false);
    expect(result.current.alerts).toEqual([]);
  });

  it("computes pendingCount from approvals with status pending", async () => {
    mockBasics([approval({ id: "a1", status: "pending" }), approval({ id: "a2", status: "approved" }), approval({ id: "a3", status: "pending" })]);

    const { result } = renderHook(() => useAppState(), { wrapper });
    await waitFor(() => expect(result.current.approvals).toHaveLength(3));
    expect(result.current.pendingCount).toBe(2);
  });

  it("resolveApproval optimistically flips status, then reconciles with the server response", async () => {
    mockBasics([approval({ id: "a1", status: "pending" })]);
    resolve.mockResolvedValue(approval({ id: "a1", status: "approved", confirmation: "server confirmation" }));

    const { result } = renderHook(() => useAppState(), { wrapper });
    await waitFor(() => expect(result.current.approvals).toHaveLength(1));

    await act(async () => {
      await result.current.resolveApproval("a1", "approved");
    });

    expect(result.current.approvals[0].status).toBe("approved");
    expect(result.current.approvals[0].confirmation).toBe("server confirmation");
    expect(result.current.resolvingApprovalId).toBeNull();
  });

  it("reloads the snapshot after an approval so a written change order clears its signal", async () => {
    mockBasics([approval({ id: "a1", status: "pending" })]);
    resolve.mockResolvedValue(approval({ id: "a1", status: "approved" }));

    const { result } = renderHook(() => useAppState(), { wrapper });
    await waitFor(() => expect(result.current.snapshot).toBeDefined());
    expect(loadSnapshot).toHaveBeenCalledTimes(1);

    await act(async () => {
      await result.current.resolveApproval("a1", "approved");
    });
    await waitFor(() => expect(loadSnapshot).toHaveBeenCalledTimes(2));
  });

  it("does not reload the snapshot when an approval is rejected", async () => {
    mockBasics([approval({ id: "a1", status: "pending" })]);
    resolve.mockResolvedValue(approval({ id: "a1", status: "rejected" }));

    const { result } = renderHook(() => useAppState(), { wrapper });
    await waitFor(() => expect(result.current.snapshot).toBeDefined());

    await act(async () => {
      await result.current.resolveApproval("a1", "rejected");
    });
    expect(loadSnapshot).toHaveBeenCalledTimes(1);
  });

  it("resolveApproval reverts the optimistic update if the server call fails", async () => {
    mockBasics([approval({ id: "a1", status: "pending" })]);
    resolve.mockRejectedValue(new Error("network error"));

    const { result } = renderHook(() => useAppState(), { wrapper });
    await waitFor(() => expect(result.current.approvals).toHaveLength(1));

    await act(async () => {
      await expect(result.current.resolveApproval("a1", "approved")).rejects.toThrow("network error");
    });

    expect(result.current.approvals[0].status).toBe("pending");
  });

  it("addApproval prepends and de-duplicates by id", async () => {
    mockBasics([approval({ id: "a1" })]);

    const { result } = renderHook(() => useAppState(), { wrapper });
    await waitFor(() => expect(result.current.approvals).toHaveLength(1));

    act(() => result.current.addApproval(approval({ id: "a1", title: "Replaced" })));
    expect(result.current.approvals).toHaveLength(1);
    expect(result.current.approvals[0].title).toBe("Replaced");
  });

  it("setCompanyId clears the selected job filter", async () => {
    mockBasics();

    const { result } = renderHook(() => useAppState(), { wrapper });
    await waitFor(() => expect(result.current.ready).toBe(true));

    act(() => result.current.setJobId("ridge-loop"));
    expect(result.current.jobId).toBe("ridge-loop");

    act(() => result.current.setCompanyId("foothills-pipeline"));
    expect(result.current.jobId).toBeUndefined();
  });
});
