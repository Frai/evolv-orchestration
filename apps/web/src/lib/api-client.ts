/**
 * Mocked API client for the construction demo. Every call resolves from the in-browser mock world
 * (src/lib/construction) after a short delay, so pages keep their loading states. The namespaces are
 * the seams a real backend plugs into later: swap a function body for a fetch() and nothing else moves.
 */
import type { Agent, AgentRun, Alert, Approval, Brief, ChangeOrder, Company, Integration, Milestone, ProcurementItem, Project, Subcontractor } from "./construction/types";
import { COMPANIES, TODAY, WORLD } from "./construction/fixtures";
import {
  AGENTS,
  agentRuns,
  answer,
  approvalsFor,
  buildBrief,
  changeOrdersForCompany,
  detectAlerts,
  integrationSyncIso,
  lastCycle,
  milestonesForCompany,
  procurementForCompany,
  portfolio,
  projectById,
  projectFinancials,
  projectsFor,
  subsForCompany,
  suggestedQuestions,
  type CycleSummary,
  type Portfolio,
  type ProjectFinancials,
} from "./construction/core";

function later<T>(value: T, ms = 180 + Math.round(Math.random() * 220)): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(structuredClone(value)), ms));
}

export const apiClient = {
  companies: {
    list: () => later<Company[]>(COMPANIES, 60),
    today: () => later<string>(TODAY, 60),
  },
  projects: {
    list: (companyId: string) => later<Project[]>(projectsFor(companyId)),
    get: (id: string) => later<Project | undefined>(projectById(id)),
    financials: (id: string) => {
      const p = projectById(id);
      return later<ProjectFinancials | undefined>(p ? projectFinancials(p) : undefined);
    },
  },
  portfolio: {
    get: (companyId: string) => later<Portfolio>(portfolio(companyId)),
    alerts: (companyId: string, coAgingDays?: number) => later<Alert[]>(detectAlerts(companyId, coAgingDays)),
  },
  changeOrders: {
    list: (companyId: string) => later<ChangeOrder[]>(changeOrdersForCompany(companyId)),
  },
  schedule: {
    milestones: (companyId: string) => later<Milestone[]>(milestonesForCompany(companyId)),
    procurement: (companyId: string) => later<ProcurementItem[]>(procurementForCompany(companyId)),
  },
  subs: {
    list: (companyId: string) => later<Subcontractor[]>(subsForCompany(companyId)),
  },
  narrator: {
    getBrief: (companyId: string) => later<Brief>(buildBrief(companyId)),
    suggestedQuestions: () => later<string[]>(suggestedQuestions(), 80),
    ask: (companyId: string, question: string) => later<string>(answer(companyId, question), 700 + Math.round(Math.random() * 500)),
  },
  agents: {
    listAgents: () => later<Agent[]>(AGENTS, 80),
    listRuns: (companyId: string) => later<AgentRun[]>(agentRuns(companyId)),
    lastCycle: (companyId: string) => later<CycleSummary>(lastCycle(companyId)),
  },
  approvals: {
    list: (companyId: string) => later<Approval[]>(approvalsFor(companyId)),
  },
  integrations: {
    list: (companyId: string) =>
      later<Integration[]>(WORLD.integrations[companyId].map((i, n) => (i.state === "connected" ? { ...i, lastSyncAt: integrationSyncIso(companyId, 4 + (n % 9)) } : i))),
  },
};
