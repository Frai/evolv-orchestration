import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import type { Approval, Location } from "@evolv/contracts/types";
import { AppStateProvider, useAppState } from "./app-state";

const { listLocations, latestDate, listAgents, listApprovals, listIntegrations, resolve } = vi.hoisted(() => ({
  listLocations: vi.fn(),
  latestDate: vi.fn(),
  listAgents: vi.fn(),
  listApprovals: vi.fn(),
  listIntegrations: vi.fn(),
  resolve: vi.fn(),
}));

vi.mock("@/lib/api-client", () => ({
  apiClient: {
    sales: {
      listLocations: (...args: unknown[]) => listLocations(...args),
      latestDate: (...args: unknown[]) => latestDate(...args),
    },
    agents: { listAgents: (...args: unknown[]) => listAgents(...args) },
    approvals: {
      listApprovals: (...args: unknown[]) => listApprovals(...args),
      resolve: (...args: unknown[]) => resolve(...args),
    },
    integrations: { listIntegrations: (...args: unknown[]) => listIntegrations(...args) },
  },
}));

const LOCATION: Location = {
  id: "prairie-table",
  name: "Prairie Table",
  shortName: "Prairie",
  type: "full_service",
  pos: "toast",
  city: "Calgary",
  currency: "CAD",
  targetLabourPct: 0.28,
  menuItemCount: 10,
  staffCount: 20,
  wageBands: [],
  kitchenTicketCapacityPerHour: 40,
  owner: { name: "Owner", phone: "555", email: "owner@example.com" },
};

function approval(overrides: Partial<Approval> = {}): Approval {
  return {
    id: "appr-1",
    locationId: "prairie-table",
    agentId: "inventory-guard",
    title: "Reorder flour",
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

afterEach(() => {
  vi.resetAllMocks();
});

describe("AppStateProvider", () => {
  it("loads locations/date/agent-modes on mount and becomes ready", async () => {
    listLocations.mockResolvedValue([LOCATION]);
    latestDate.mockResolvedValue("2026-01-04");
    listAgents.mockResolvedValue([{ id: "inventory-guard", name: "Inventory Guard", description: "d", status: "active", schedule: "hourly", defaultMode: "ask_first" }]);
    listApprovals.mockResolvedValue([]);
    listIntegrations.mockResolvedValue([]);

    const { result } = renderHook(() => useAppState(), { wrapper });
    await waitFor(() => expect(result.current.ready).toBe(true));

    expect(result.current.locations).toEqual([LOCATION]);
    expect(result.current.asOf).toBe("2026-01-04");
    expect(result.current.agentModes).toEqual({ "inventory-guard": "ask_first" });
  });

  it("computes pendingCount from approvals with status pending", async () => {
    listLocations.mockResolvedValue([LOCATION]);
    latestDate.mockResolvedValue("2026-01-04");
    listAgents.mockResolvedValue([]);
    listApprovals.mockResolvedValue([approval({ id: "a1", status: "pending" }), approval({ id: "a2", status: "approved" }), approval({ id: "a3", status: "pending" })]);
    listIntegrations.mockResolvedValue([]);

    const { result } = renderHook(() => useAppState(), { wrapper });
    await waitFor(() => expect(result.current.approvals).toHaveLength(3));
    expect(result.current.pendingCount).toBe(2);
  });

  it("resolveApproval optimistically flips status, then reconciles with the server response", async () => {
    listLocations.mockResolvedValue([LOCATION]);
    latestDate.mockResolvedValue("2026-01-04");
    listAgents.mockResolvedValue([]);
    listApprovals.mockResolvedValue([approval({ id: "a1", status: "pending" })]);
    listIntegrations.mockResolvedValue([]);
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

  it("resolveApproval reverts the optimistic update if the server call fails", async () => {
    listLocations.mockResolvedValue([LOCATION]);
    latestDate.mockResolvedValue("2026-01-04");
    listAgents.mockResolvedValue([]);
    listApprovals.mockResolvedValue([approval({ id: "a1", status: "pending" })]);
    listIntegrations.mockResolvedValue([]);
    resolve.mockRejectedValue(new Error("network error"));

    const { result } = renderHook(() => useAppState(), { wrapper });
    await waitFor(() => expect(result.current.approvals).toHaveLength(1));

    await act(async () => {
      await expect(result.current.resolveApproval("a1", "approved")).rejects.toThrow("network error");
    });

    expect(result.current.approvals[0].status).toBe("pending");
  });

  it("addApproval prepends and de-duplicates by id", async () => {
    listLocations.mockResolvedValue([LOCATION]);
    latestDate.mockResolvedValue("2026-01-04");
    listAgents.mockResolvedValue([]);
    listApprovals.mockResolvedValue([approval({ id: "a1" })]);
    listIntegrations.mockResolvedValue([]);

    const { result } = renderHook(() => useAppState(), { wrapper });
    await waitFor(() => expect(result.current.approvals).toHaveLength(1));

    act(() => result.current.addApproval(approval({ id: "a1", title: "Replaced" })));
    expect(result.current.approvals).toHaveLength(1);
    expect(result.current.approvals[0].title).toBe("Replaced");
  });

  it("setLocationId clears the selected outletId", async () => {
    listLocations.mockResolvedValue([LOCATION]);
    latestDate.mockResolvedValue("2026-01-04");
    listAgents.mockResolvedValue([]);
    listApprovals.mockResolvedValue([]);
    listIntegrations.mockResolvedValue([]);

    const { result } = renderHook(() => useAppState(), { wrapper });
    await waitFor(() => expect(result.current.ready).toBe(true));

    act(() => result.current.setOutletId("restaurant"));
    expect(result.current.outletId).toBe("restaurant");

    act(() => result.current.setLocationId("prairie-table"));
    expect(result.current.outletId).toBeUndefined();
  });
});
