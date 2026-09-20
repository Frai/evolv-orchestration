"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { AgentMode, Approval, ApprovalStatus, Integration, Location, Settings } from "@evolv/contracts/types";
import { apiClient } from "@/lib/api-client";

interface AppState {
  ready: boolean;
  signedIn: boolean;
  userEmail: string | null;
  signIn: (email: string) => void;
  signOut: () => void;

  locations: Location[];
  location: Location | undefined;
  locationId: string;
  setLocationId: (id: string) => void;
  outletId: string | undefined;
  setOutletId: (id: string | undefined) => void;
  /** Most recent closed business day ("yesterday"). */
  asOf: string;

  settings: Settings;
  updateSettings: (patch: Partial<Settings>) => void;

  approvals: Approval[];
  approvalsLoading: boolean;
  pendingCount: number;
  resolveApproval: (id: string, status: Exclude<ApprovalStatus, "pending">) => void;
  editApproval: (id: string, action: string) => void;
  addApproval: (a: Approval) => void;

  integrations: Integration[];
  integrationsLoading: boolean;
  connectIntegration: (id: string) => void;

  agentModes: Record<string, AgentMode>;
  setAgentMode: (agentId: string, mode: AgentMode) => void;
}

const Ctx = createContext<AppState | null>(null);

const DEFAULT_LOCATION = "prairie-table";

function defaultSettings(loc: Location | undefined): Settings {
  return {
    deliveryChannel: "whatsapp",
    sendTime: "06:00",
    recipients: loc ? [loc.owner.phone, loc.owner.email] : [],
    targetLabourPct: loc?.targetLabourPct ?? 0.28,
  };
}

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [signedIn, setSignedIn] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [locations, setLocations] = useState<Location[]>([]);
  const [asOf, setAsOf] = useState("");
  const [ready, setReady] = useState(false);
  const [locationId, setLocationIdState] = useState(DEFAULT_LOCATION);
  const [outletId, setOutletId] = useState<string | undefined>(undefined);

  const [settingsByLoc, setSettingsByLoc] = useState<Record<string, Settings>>({});
  const [approvalsByLoc, setApprovalsByLoc] = useState<Record<string, Approval[]>>({});
  const [integrationsByLoc, setIntegrationsByLoc] = useState<Record<string, Integration[]>>({});
  const [agentModes, setAgentModes] = useState<Record<string, AgentMode>>({});
  const inflight = useRef(new Set<string>());

  useEffect(() => {
    let alive = true;
    Promise.all([apiClient.sales.listLocations(), apiClient.sales.latestDate(DEFAULT_LOCATION), apiClient.agents.listAgents()]).then(([locs, date, agents]) => {
      if (!alive) return;
      setLocations(locs);
      setAsOf(date);
      setAgentModes(Object.fromEntries(agents.map((a) => [a.id, a.defaultMode])));
      setReady(true);
    });
    return () => {
      alive = false;
    };
  }, []);

  const location = locations.find((l) => l.id === locationId);

  // Lazily load per-location state the first time a tenant is selected.
  useEffect(() => {
    const key = `a:${locationId}`;
    if (!locationId || approvalsByLoc[locationId] || inflight.current.has(key)) return;
    inflight.current.add(key);
    apiClient.approvals.listApprovals(locationId).then((rows) => {
      inflight.current.delete(key);
      setApprovalsByLoc((m) => (m[locationId] ? m : { ...m, [locationId]: rows }));
    });
  }, [locationId, approvalsByLoc]);

  useEffect(() => {
    const key = `i:${locationId}`;
    if (!locationId || integrationsByLoc[locationId] || inflight.current.has(key)) return;
    inflight.current.add(key);
    apiClient.integrations.listIntegrations(locationId).then((rows) => {
      inflight.current.delete(key);
      setIntegrationsByLoc((m) => (m[locationId] ? m : { ...m, [locationId]: rows }));
    });
  }, [locationId, integrationsByLoc]);

  const setLocationId = useCallback((id: string) => {
    setLocationIdState(id);
    setOutletId(undefined);
  }, []);

  const settings = settingsByLoc[locationId] ?? defaultSettings(location);
  const updateSettings = useCallback(
    (patch: Partial<Settings>) => {
      setSettingsByLoc((m) => ({ ...m, [locationId]: { ...(m[locationId] ?? defaultSettings(location)), ...patch } }));
    },
    [locationId, location],
  );

  const approvals = useMemo(() => approvalsByLoc[locationId] ?? [], [approvalsByLoc, locationId]);
  const resolveApproval = useCallback(
    (id: string, status: Exclude<ApprovalStatus, "pending">) => {
      setApprovalsByLoc((m) => ({
        ...m,
        [locationId]: (m[locationId] ?? []).map((a) => (a.id === id ? { ...a, status, resolvedAt: new Date().toISOString() } : a)),
      }));
    },
    [locationId],
  );
  const editApproval = useCallback(
    (id: string, action: string) => {
      setApprovalsByLoc((m) => ({ ...m, [locationId]: (m[locationId] ?? []).map((a) => (a.id === id ? { ...a, action } : a)) }));
    },
    [locationId],
  );
  const addApproval = useCallback((a: Approval) => {
    setApprovalsByLoc((m) => ({ ...m, [a.locationId]: [a, ...(m[a.locationId] ?? []).filter((x) => x.id !== a.id)] }));
  }, []);

  const integrations = useMemo(() => integrationsByLoc[locationId] ?? [], [integrationsByLoc, locationId]);
  const connectIntegration = useCallback(
    (id: string) => {
      setIntegrationsByLoc((m) => ({
        ...m,
        [locationId]: (m[locationId] ?? []).map((i) => (i.id === id ? { ...i, state: "connected", lastSyncAt: new Date().toISOString() } : i)),
      }));
    },
    [locationId],
  );

  const setAgentMode = useCallback((agentId: string, mode: AgentMode) => setAgentModes((m) => ({ ...m, [agentId]: mode })), []);

  const value: AppState = {
    ready,
    signedIn,
    userEmail,
    signIn: (email) => {
      setUserEmail(email);
      setSignedIn(true);
    },
    signOut: () => {
      setSignedIn(false);
      setUserEmail(null);
    },
    locations,
    location,
    locationId,
    setLocationId,
    outletId,
    setOutletId,
    asOf,
    settings,
    updateSettings,
    approvals,
    approvalsLoading: !approvalsByLoc[locationId],
    pendingCount: approvals.filter((a) => a.status === "pending").length,
    resolveApproval,
    editApproval,
    addApproval,
    integrations,
    integrationsLoading: !integrationsByLoc[locationId],
    connectIntegration,
    agentModes,
    setAgentMode,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAppState(): AppState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAppState must be used inside AppStateProvider");
  return v;
}
