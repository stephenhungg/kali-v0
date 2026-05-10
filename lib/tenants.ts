/**
 * Tenant lookup. v1 is single-tenant (Rivertown Community Foundation), so
 * this is a constant in-memory record. Production swaps to a Postgres
 * lookup keyed on slug, with Clerk-mediated user → tenant resolution.
 */

export interface TenantRecord {
  id: string; // kali_entity_id
  slug: string; // url path component
  name: string;
  ein: string;
  taxStatus: string; // "501(c)(3)" | "501(c)(4)" | ...
  mission: string;
  city: string;
  state: string;
  programs: string[];
  fiscalYearStart: string; // MM-DD
  website: string;
  treasuryWallet?: string;
}

const RIVERTOWN: TenantRecord = {
  id: "tenant_rivertown",
  slug: "rivertown",
  name: "Rivertown Community Foundation",
  ein: "82-3491582",
  taxStatus: "501(c)(3)",
  mission:
    "We invest in Sacramento neighborhoods through grantmaking, capacity-building, and local advocacy across six core programs.",
  city: "Sacramento",
  state: "CA",
  programs: [
    "Youth Mentorship",
    "Community Health Outreach",
    "Workforce Development",
    "Food Security Network",
    "Family Stabilization",
    "Operating",
  ],
  fiscalYearStart: "07-01",
  website: "https://rivertown.example.org",
};

const TENANTS = new Map<string, TenantRecord>();
TENANTS.set(RIVERTOWN.slug, RIVERTOWN);
TENANTS.set(RIVERTOWN.id, RIVERTOWN);

export async function resolveTenant(slugOrId: string): Promise<TenantRecord | null> {
  return TENANTS.get(slugOrId) ?? null;
}

export async function listTenants(): Promise<TenantRecord[]> {
  // Distinct values only.
  const seen = new Set<string>();
  const out: TenantRecord[] = [];
  for (const t of TENANTS.values()) {
    if (seen.has(t.id)) continue;
    seen.add(t.id);
    out.push(t);
  }
  return out;
}
