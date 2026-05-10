/**
 * Display config for the connector menu.
 *
 * The backend (lib/connectors/sync-state via /api/connectors/status) tells
 * us which connectors are connected + their record counts + last-sync
 * timestamps. This file supplies the *visual* layer: vendor names, monograms,
 * domain bucket, and a couple of "future" tiles to set roadmap expectations
 * for non-AI-native nonprofit executives looking at the menu.
 *
 * The merge happens client-side in the ConnectorMenu component.
 */

export type ConnectorVisualStatus = "connected" | "available" | "needs_setup";
export type ConnectorDomain =
  | "donor"
  | "grants"
  | "finance"
  | "comms"
  | "docs"
  | "meetings"
  | "workflow"
  | "analytics"
  | "security"
  | "payouts"
  | "marketing";

export interface ConnectorDisplay {
  id: string;
  label: string;
  vendor: string;
  domain: ConnectorDomain;
  monogram: string;
  blurb: string;
  /** When seeded but unconnected on the backend, force this status. */
  forcedStatus?: ConnectorVisualStatus;
}

export const CONNECTOR_DISPLAYS: ConnectorDisplay[] = [
  // ── Active connectors (matched to backend connector ids) ──
  { id: "bloomerang", label: "Bloomerang", vendor: "Bloomerang", domain: "donor", monogram: "B", blurb: "Donor records, donations, engagement scores, segmentation." },
  { id: "salesforce", label: "Salesforce NPSP", vendor: "Salesforce", domain: "donor", monogram: "S", blurb: "Contacts, accounts, opportunities, board membership." },
  { id: "m365", label: "Microsoft 365", vendor: "Microsoft", domain: "comms", monogram: "M", blurb: "Email, calendar, identity for staff." },
  { id: "sharepoint", label: "SharePoint", vendor: "Microsoft", domain: "docs", monogram: "P", blurb: "Board minutes, program reports, grant applications, policies." },
  { id: "instrumentl", label: "Instrumentl", vendor: "Instrumentl", domain: "grants", monogram: "I", blurb: "Grant pipeline, deadlines, funder profiles, fit scores." },
  { id: "quickbooks", label: "QuickBooks", vendor: "Intuit", domain: "finance", monogram: "Q", blurb: "P&L, cash position, program budgets, restricted funds." },
  { id: "zoom", label: "Zoom", vendor: "Zoom", domain: "meetings", monogram: "Z", blurb: "Meeting transcripts, attendees, call logs." },
  { id: "powerautomate", label: "Power Automate", vendor: "Microsoft", domain: "workflow", monogram: "A", blurb: "Configured workflows + run history. Find automation gaps." },
  { id: "powerbi", label: "Power BI", vendor: "Microsoft", domain: "analytics", monogram: "L", blurb: "Dashboards + KPI snapshots for board reports." },
  { id: "knowbe4", label: "KnowBe4", vendor: "KnowBe4", domain: "security", monogram: "K", blurb: "Per-employee risk, phishing tests, training compliance." },
  { id: "solana", label: "Solana Payouts", vendor: "Solana (devnet)", domain: "payouts", monogram: "◎", blurb: "Onchain treasury + sub-cent disbursements." },

  // ── Future tiles (not in backend; visible to set roadmap expectations) ──
  { id: "mailchimp", label: "Mailchimp", vendor: "Intuit", domain: "marketing", monogram: "C", blurb: "Email campaigns, open + click rates. Coming soon.", forcedStatus: "available" },
  { id: "donorperfect", label: "DonorPerfect", vendor: "DonorPerfect", domain: "donor", monogram: "D", blurb: "Alternative donor CRM. Setup needed: API key from DP admin.", forcedStatus: "needs_setup" },
];

export function findDisplay(id: string): ConnectorDisplay | undefined {
  // case-insensitive on first lookup, then fall back to direct match
  const lower = id.toLowerCase();
  return CONNECTOR_DISPLAYS.find(c => c.id.toLowerCase() === lower) ?? CONNECTOR_DISPLAYS.find(c => c.id === id);
}

/** Format an ISO date as "12 minutes ago" / "1h ago" — for the tile caption. */
export function formatRelative(iso: string | null): string {
  if (!iso) return "never";
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return "just now";
  if (ms < 3600_000) return `${Math.round(ms / 60_000)}m ago`;
  if (ms < 86400_000) return `${Math.round(ms / 3600_000)}h ago`;
  return `${Math.round(ms / 86400_000)}d ago`;
}
