import { afterEach, describe, expect, it, vi } from "vitest";
import { apiClient } from "./api-client";

function jsonResponse(body: unknown, init: { ok?: boolean; status?: number } = {}) {
  return {
    ok: init.ok ?? true,
    status: init.status ?? 200,
    headers: new Headers({ "content-type": "application/json" }),
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as unknown as Response;
}

function textResponse(body: string, init: { ok?: boolean; status?: number } = {}) {
  return {
    ok: init.ok ?? true,
    status: init.status ?? 200,
    headers: new Headers({ "content-type": "text/plain" }),
    json: async () => {
      throw new Error("not json");
    },
    text: async () => body,
  } as unknown as Response;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("apiClient GET requests", () => {
  it("hits the expected path against the default base URL", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse([]));
    vi.stubGlobal("fetch", fetchMock);

    await apiClient.sales.listLocations();

    expect(fetchMock).toHaveBeenCalledWith("http://localhost:3001/sales/locations");
  });

  it("builds query strings from provided params, omitting undefined ones", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse([]));
    vi.stubGlobal("fetch", fetchMock);

    await apiClient.sales.getSalesDays({ locationId: "prairie-table", range: { from: "2026-01-01", to: "2026-01-31" } });

    const url = new URL(fetchMock.mock.calls[0][0] as string, "http://localhost");
    expect(url.pathname).toBe("/sales/days");
    expect(url.searchParams.get("locationId")).toBe("prairie-table");
    expect(url.searchParams.get("from")).toBe("2026-01-01");
    expect(url.searchParams.get("to")).toBe("2026-01-31");
    expect(url.searchParams.has("outletId")).toBe(false);
  });

  it("parses a JSON response body", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ id: "prairie-table" })));
    const location = await apiClient.sales.getLocation("prairie-table");
    expect(location).toEqual({ id: "prairie-table" });
  });

  it("parses a plain-text response body when content-type is not JSON", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(textResponse("2026-01-04")));
    const date = await apiClient.sales.latestDate("prairie-table");
    expect(date).toBe("2026-01-04");
  });

  it("throws on a non-ok response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({}, { ok: false, status: 404 })));
    await expect(apiClient.sales.getLocation("nonexistent")).rejects.toThrow(/404/);
  });
});

describe("apiClient POST requests", () => {
  it("sends a JSON body with the right method and headers", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ id: "appr-1", status: "approved" }));
    vi.stubGlobal("fetch", fetchMock);

    await apiClient.approvals.resolve({ approvalId: "appr-1", status: "approved" });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://localhost:3001/approvals/appr-1/resolve");
    expect(init.method).toBe("POST");
    expect(init.headers).toEqual({ "Content-Type": "application/json" });
    expect(JSON.parse(init.body as string)).toEqual({ status: "approved", editedAction: undefined });
  });

  it("throws on a non-ok POST response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({}, { ok: false, status: 500 })));
    await expect(apiClient.approvals.resolve({ approvalId: "appr-1", status: "approved" })).rejects.toThrow(/500/);
  });
});
