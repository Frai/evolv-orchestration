import type { Company, Integration, IntegrationArea, IntegrationState } from "@evolv/contracts/types";

type Catalog = Omit<Integration, "state" | "lastSyncAt"> & { defaultState: IntegrationState };

const C = (id: string, name: string, area: IntegrationArea, description: string, defaultState: IntegrationState): Catalog => ({ id, name, area, description, defaultState });

export const CATALOG: Catalog[] = [
  C("sage300cre", "Sage 300 CRE", "accounting", "Job cost, commitments, AR/AP and payroll from Sage 300 Construction and Real Estate.", "available"),
  C("vista", "Viewpoint Vista", "accounting", "Job cost, commitments, AR/AP and payroll from Viewpoint Vista.", "available"),
  C("quickbooks", "QuickBooks", "accounting", "Job cost, invoices and payables from QuickBooks Online and Desktop.", "available"),
  C("netsuite", "NetSuite", "accounting", "Projects, job cost, invoices and commitments from Oracle NetSuite.", "available"),
  C("sap", "SAP", "accounting", "Project accounting from SAP Business One and S/4HANA.", "coming_soon"),
  C("heavybid", "HeavyBid", "estimating", "Estimate lines and budget at completion per cost code.", "available"),
  C("spreadsheet", "Spreadsheet drop", "estimating", "Scheduled CSV or Excel exports from any system. First-class source, not a workaround.", "available"),
  C("exaktime", "ExakTime", "timekeeping", "Crew hours by worker, cost code and day, including overtime.", "available"),
  C("procore", "Procore", "field", "Daily reports, quantities installed and change events.", "available"),
  C("p6", "Primavera P6", "field", "Schedule activities, dates, predecessors and float.", "available"),
  C("fieldcap", "FieldCap", "ticketing", "Electronic field tickets with crew, equipment, materials and client signatures.", "available"),
  C("fieldequip", "FieldEquip", "ticketing", "Dispatch, field tickets and billing-ready records.", "available"),
  C("spira", "Spira", "ticketing", "Scheduling, dispatch, field tickets and payroll for energy services.", "coming_soon"),
  C("enverus-oss", "Enverus Oilfield Services Suite", "ticketing", "Field tickets routed straight into OpenInvoice.", "coming_soon"),
  C("openinvoice", "Enverus OpenInvoice", "billing", "Invoice status and dispute reasons from the billing network most operators already use.", "available"),
  C("samsara", "Samsara", "equipment", "Telematics: engine hours, idle time and location.", "available"),
  C("geotab", "Geotab", "equipment", "Telematics: utilization and maintenance flags.", "available"),
  C("fleetio", "Fleetio", "equipment", "Maintenance schedules and work orders.", "available"),
  C("ecompliance", "eCompliance", "safety", "Incidents, near-misses, inspections and corrective actions.", "available"),
  C("sitedocs", "SiteDocs", "safety", "Safety forms, inspections and corrective actions.", "available"),
  C("cority", "Cority", "safety", "Incidents and corrective-action tracking.", "coming_soon"),
  C("whatsapp", "WhatsApp", "messaging", "Daily brief and urgent alerts to your phone.", "available"),
  C("email", "Email", "messaging", "Daily brief and digests to your inbox.", "available"),
  C("teams", "Microsoft Teams", "messaging", "Urgent alerts to a Teams channel.", "available"),
  C("sms", "SMS", "messaging", "Critical alerts by text message.", "coming_soon"),
];

/** What each pilot company actually runs. Everything else stays "available". */
const CONNECTED: Record<string, string[]> = {
  "foothills-pipeline": ["vista", "heavybid", "exaktime", "procore", "p6", "samsara", "sitedocs"],
  "peace-river-oilfield": ["quickbooks", "fieldcap", "openinvoice", "samsara", "ecompliance"],
  "red-deer-lease": ["sage300cre", "spreadsheet", "exaktime", "geotab", "sitedocs"],
  "bow-river-facilities": ["netsuite", "heavybid", "procore", "p6", "fleetio", "ecompliance"],
};

export function integrationsFor(company: Company, syncIso: string): Integration[] {
  const connected = new Set([...(CONNECTED[company.id] ?? []), company.accounting, "spreadsheet", "whatsapp", "email"]);
  return CATALOG.map((c) => {
    const state: IntegrationState = connected.has(c.id) ? "connected" : c.defaultState;
    const { defaultState, ...rest } = c;
    void defaultState;
    return { ...rest, state, lastSyncAt: state === "connected" ? syncIso : undefined };
  });
}
