"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { AgentMode, Alert, Approval, ApprovalStatus, Company, Integration, Job, Settings } from "@evolv/contracts/types";
import { detectAlerts } from "@evolv/contracts/alerts";
import { apiClient, loadSnapshot, type Snapshot } from "@/lib/api-client";

interface AppState {
  ready: boolean;
  signedIn: boolean;
  userEmail: string | null;
  signIn: (email: string) => void;
  signOut: () => void;

  resolvingApprovalId: string | null;

  companies: Company[];
  company: Company | undefined;
  companyId: string;
  setCompanyId: (id: string) => void;
  /** Optional job filter: undefined means every job. */
  jobId: string | undefined;
  setJobId: (id: string | undefined) => void;
  /** Most recent closed business day ("yesterday"). */
  asOf: string;

  /** The canonical model for the selected company; undefined while it loads. */
  snapshot: Snapshot | undefined;
  snapshotLoading: boolean;
  refreshSnapshot: () => void;
  /** Signals computed at request time over the snapshot, whole company. */
  alerts: Alert[] | undefined;
  jobs: Job[];

  settings: Settings;
  updateSettings: (patch: Partial<Settings>) => void;

  approvals: Approval[];
  approvalsLoading: boolean;
  pendingCount: number;
  resolveApproval: (id: string, status: Exclude<ApprovalStatus, "pending">, editedAction?: string) => Promise<void>;
  addApproval: (a: Approval) => void;

  integrations: Integration[];
  integrationsLoading: boolean;
  connectIntegration: (id: string) => void;

  agentModes: Record<string, AgentMode>;
  setAgentMode: (agentId: string, mode: AgentMode) => void;
}

const Ctx = createContext<AppState | null>(null);

const DEFAULT_COMPANY = "foothills-pipeline";

function defaultSettings(company: Company | undefined): Settings {
  return {
    deliveryChannel: "whatsapp",
    sendTime: "05:45",
    recipients: company ? [company.owner.phone, company.owner.email] : [],
    targetMarginPct: company?.targetMarginPct ?? 0.12,
  };
}

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [signedIn, setSignedIn] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [asOf, setAsOf] = useState("");
  const [ready, setReady] = useState(false);
  const [companyId, setCompanyIdState] = useState(DEFAULT_COMPANY);
  const [jobId, setJobId] = useState<string | undefined>(undefined);

  const [snapshotsByCo, setSnapshotsByCo] = useState<Record<string, Snapshot>>({});
  const [settingsByCo, setSettingsByCo] = useState<Record<string, Settings>>({});
  const [approvalsByCo, setApprovalsByCo] = useState<Record<string, Approval[]>>({});
  const [integrationsByCo, setIntegrationsByCo] = useState<Record<string, Integration[]>>({});
  const [agentModes, setAgentModes] = useState<Record<string, AgentMode>>({});
  const inflight = useRef(new Set<string>());

  useEffect(() => {
    let alive = true;
    Promise.all([apiClient.projects.listCompanies(), apiClient.projects.latestDate(DEFAULT_COMPANY), apiClient.agents.listAgents()]).then(([cos, date, agents]) => {
      if (!alive) return;
      setCompanies(cos);
      setAsOf(date);
      setAgentModes(Object.fromEntries(agents.map((a) => [a.id, a.defaultMode])));
      setReady(true);
    });
    return () => {
      alive = false;
    };
  }, []);

  const company = companies.find((c) => c.id === companyId);

  // Lazily load per-company state the first time a tenant is selected.
  useEffect(() => {
    const key = `a:${companyId}`;
    if (!companyId || approvalsByCo[companyId] || inflight.current.has(key)) return;
    inflight.current.add(key);
    apiClient.approvals.listApprovals(companyId).then((rows) => {
      inflight.current.delete(key);
      setApprovalsByCo((m) => (m[companyId] ? m : { ...m, [companyId]: rows }));
    });
  }, [companyId, approvalsByCo]);

  useEffect(() => {
    const key = `i:${companyId}`;
    if (!companyId || integrationsByCo[companyId] || inflight.current.has(key)) return;
    inflight.current.add(key);
    apiClient.integrations.listIntegrations(companyId).then((rows) => {
      inflight.current.delete(key);
      setIntegrationsByCo((m) => (m[companyId] ? m : { ...m, [companyId]: rows }));
    });
  }, [companyId, integrationsByCo]);

  useEffect(() => {
    const key = `s:${companyId}`;
    if (!ready || !asOf || snapshotsByCo[companyId] || inflight.current.has(key)) return;
    inflight.current.add(key);
    loadSnapshot(companyId, asOf).then((snap) => {
      inflight.current.delete(key);
      setSnapshotsByCo((m) => (m[companyId] ? m : { ...m, [companyId]: snap }));
    });
  }, [ready, asOf, companyId, snapshotsByCo]);

  const refreshSnapshot = useCallback(() => {
    if (!asOf) return;
    const id = companyId;
    loadSnapshot(id, asOf).then((snap) => setSnapshotsByCo((m) => ({ ...m, [id]: snap })));
  }, [asOf, companyId]);

  const setCompanyId = useCallback((id: string) => {
    setCompanyIdState(id);
    setJobId(undefined);
  }, []);

  const snapshot = snapshotsByCo[companyId];
  const alerts = useMemo(
    () => (company && snapshot ? detectAlerts({ company, date: asOf, ...snapshot }) : undefined),
    [company, snapshot, asOf],
  );

  const settings = settingsByCo[companyId] ?? defaultSettings(company);
  const updateSettings = useCallback(
    (patch: Partial<Settings>) => {
      setSettingsByCo((m) => ({ ...m, [companyId]: { ...(m[companyId] ?? defaultSettings(company)), ...patch } }));
    },
    [companyId, company],
  );

  const approvals = useMemo(() => approvalsByCo[companyId] ?? [], [approvalsByCo, companyId]);
  const [resolvingApprovalId, setResolvingApprovalId] = useState<string | null>(null);
  const resolveApproval = useCallback(
    async (id: string, status: Exclude<ApprovalStatus, "pending">, editedAction?: string) => {
      const co = companyId;
      const previous = approvalsByCo[co];
      // Optimistic flip so the UI feels instant; reconciled with the server response below.
      setApprovalsByCo((m) => ({
        ...m,
        [co]: (m[co] ?? []).map((a) => (a.id === id ? { ...a, status, resolvedAt: new Date().toISOString(), action: editedAction ?? a.action } : a)),
      }));
      setResolvingApprovalId(id);
      try {
        const resolved = await apiClient.approvals.resolve({ approvalId: id, status, editedAction });
        setApprovalsByCo((m) => ({ ...m, [co]: (m[co] ?? []).map((a) => (a.id === id ? resolved : a)) }));
        // An approved change-order draft writes a real change order: reload so the signal clears.
        if (status === "approved") refreshSnapshot();
      } catch (err) {
        // Revert on failure: the optimistic flip didn't actually happen server-side.
        setApprovalsByCo((m) => ({ ...m, [co]: previous ?? m[co] }));
        throw err;
      } finally {
        setResolvingApprovalId((current) => (current === id ? null : current));
      }
    },
    [companyId, approvalsByCo, refreshSnapshot],
  );
  const addApproval = useCallback((a: Approval) => {
    setApprovalsByCo((m) => ({ ...m, [a.companyId]: [a, ...(m[a.companyId] ?? []).filter((x) => x.id !== a.id)] }));
  }, []);

  const integrations = useMemo(() => integrationsByCo[companyId] ?? [], [integrationsByCo, companyId]);
  const connectIntegration = useCallback(
    (id: string) => {
      setIntegrationsByCo((m) => ({
        ...m,
        [companyId]: (m[companyId] ?? []).map((i) => (i.id === id ? { ...i, state: "connected", lastSyncAt: new Date().toISOString() } : i)),
      }));
    },
    [companyId],
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
    resolvingApprovalId,
    companies,
    company,
    companyId,
    setCompanyId,
    jobId,
    setJobId,
    asOf,
    snapshot,
    snapshotLoading: !snapshot,
    refreshSnapshot,
    alerts,
    jobs: snapshot?.jobs ?? [],
    settings,
    updateSettings,
    approvals,
    approvalsLoading: !approvalsByCo[companyId],
    pendingCount: approvals.filter((a) => a.status === "pending").length,
    resolveApproval,
    addApproval,
    integrations,
    integrationsLoading: !integrationsByCo[companyId],
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
