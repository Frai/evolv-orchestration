"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { AgentMode, Approval, ApprovalStatus, Company, Integration, Settings } from "@/lib/construction/types";
import { apiClient } from "@/lib/api-client";

interface AppState {
  ready: boolean;
  signedIn: boolean;
  userEmail: string | null;
  signIn: (email: string) => void;
  signOut: () => void;

  companies: Company[];
  company: Company | undefined;
  companyId: string;
  setCompanyId: (id: string) => void;
  /** Today's date; numbers are as of this morning's sync. */
  today: string;

  settings: Settings;
  updateSettings: (patch: Partial<Settings>) => void;

  approvals: Approval[];
  approvalsLoading: boolean;
  pendingCount: number;
  resolveApproval: (id: string, status: Exclude<ApprovalStatus, "pending">) => void;
  editApproval: (id: string, action: string) => void;

  integrations: Integration[];
  integrationsLoading: boolean;
  connectIntegration: (id: string) => void;

  agentModes: Record<string, AgentMode>;
  setAgentMode: (agentId: string, mode: AgentMode) => void;
}

const Ctx = createContext<AppState | null>(null);

const DEFAULT_COMPANY = "summit-ridge";

function defaultSettings(c: Company | undefined): Settings {
  return {
    deliveryChannel: "whatsapp",
    sendTime: "06:00",
    recipients: c ? [c.owner.phone, c.owner.email] : [],
    targetMarginPct: c?.targetMarginPct ?? 0.075,
    coAgingDays: 21,
  };
}

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [signedIn, setSignedIn] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [today, setToday] = useState("");
  const [ready, setReady] = useState(false);
  const [companyId, setCompanyId] = useState(DEFAULT_COMPANY);

  const [settingsBy, setSettingsBy] = useState<Record<string, Settings>>({});
  const [approvalsBy, setApprovalsBy] = useState<Record<string, Approval[]>>({});
  const [integrationsBy, setIntegrationsBy] = useState<Record<string, Integration[]>>({});
  const [agentModes, setAgentModes] = useState<Record<string, AgentMode>>({});
  const inflight = useRef(new Set<string>());

  useEffect(() => {
    let alive = true;
    Promise.all([apiClient.companies.list(), apiClient.companies.today(), apiClient.agents.listAgents()]).then(([cs, t, agents]) => {
      if (!alive) return;
      setCompanies(cs);
      setToday(t);
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
    if (approvalsBy[companyId] || inflight.current.has(key)) return;
    inflight.current.add(key);
    apiClient.approvals.list(companyId).then((rows) => {
      inflight.current.delete(key);
      setApprovalsBy((m) => (m[companyId] ? m : { ...m, [companyId]: rows }));
    });
  }, [companyId, approvalsBy]);

  useEffect(() => {
    const key = `i:${companyId}`;
    if (integrationsBy[companyId] || inflight.current.has(key)) return;
    inflight.current.add(key);
    apiClient.integrations.list(companyId).then((rows) => {
      inflight.current.delete(key);
      setIntegrationsBy((m) => (m[companyId] ? m : { ...m, [companyId]: rows }));
    });
  }, [companyId, integrationsBy]);

  const settings = settingsBy[companyId] ?? defaultSettings(company);
  const updateSettings = useCallback(
    (patch: Partial<Settings>) => {
      setSettingsBy((m) => ({ ...m, [companyId]: { ...(m[companyId] ?? defaultSettings(company)), ...patch } }));
    },
    [companyId, company],
  );

  const approvals = useMemo(() => approvalsBy[companyId] ?? [], [approvalsBy, companyId]);
  const resolveApproval = useCallback(
    (id: string, status: Exclude<ApprovalStatus, "pending">) => {
      setApprovalsBy((m) => ({
        ...m,
        [companyId]: (m[companyId] ?? []).map((a) => (a.id === id ? { ...a, status, resolvedAt: new Date().toISOString() } : a)),
      }));
    },
    [companyId],
  );
  const editApproval = useCallback(
    (id: string, action: string) => {
      setApprovalsBy((m) => ({ ...m, [companyId]: (m[companyId] ?? []).map((a) => (a.id === id ? { ...a, action } : a)) }));
    },
    [companyId],
  );

  const integrations = useMemo(() => integrationsBy[companyId] ?? [], [integrationsBy, companyId]);
  const connectIntegration = useCallback(
    (id: string) => {
      setIntegrationsBy((m) => ({
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
    companies,
    company,
    companyId,
    setCompanyId,
    today,
    settings,
    updateSettings,
    approvals,
    approvalsLoading: !approvalsBy[companyId],
    pendingCount: approvals.filter((a) => a.status === "pending").length,
    resolveApproval,
    editApproval,
    integrations,
    integrationsLoading: !integrationsBy[companyId],
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
