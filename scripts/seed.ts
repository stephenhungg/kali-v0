/**
 * Master seed generator for "Rivertown Community Foundation".
 *
 * Generates one coherent fictional org and emits per-connector seed JSON to
 * `data/seed/<connector>.json`. The agent's cross-tool reasoning only works
 * if the same donor in Bloomerang shows up consistently in Salesforce, M365,
 * Zoom, and SharePoint. So we generate everyone here, ONCE, and every
 * connector seed file is a projection of this canonical graph.
 *
 * Run:
 *   bun scripts/seed.ts
 *
 * Outputs deterministic data — same run produces the same JSON. Reseed by
 * deleting `data/seed/*.json` and re-running.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const SEED_DIR = path.join(process.cwd(), "data", "seed");
mkdirSync(SEED_DIR, { recursive: true });

/* ─── deterministic prng ─────────────────────────────────────────────── */

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(0xc0ffee);
const pick = <T>(arr: readonly T[]) => arr[Math.floor(rand() * arr.length)] as T;
const intBetween = (lo: number, hi: number) =>
  Math.floor(rand() * (hi - lo + 1)) + lo;
const moneyBetween = (lo: number, hi: number) =>
  Math.round((rand() * (hi - lo) + lo) * 100) / 100;
const id = (prefix: string) =>
  `${prefix}_${Math.floor(rand() * 1e9).toString(36)}`;

/* ─── tenant ─────────────────────────────────────────────────────────── */

const tenant = {
  id: "rivertown",
  name: "Rivertown Community Foundation",
  fiscalYearEnd: "06-30",
  mission:
    "Strengthen Rivertown by funding youth education, food security, and small-business resilience.",
  programs: [
    { id: "youth-ed", name: "Rivertown Youth Education", annualBudget: 540000 },
    { id: "food-sec", name: "Food Security Initiative", annualBudget: 380000 },
    {
      id: "smb-resilience",
      name: "Small Business Resilience Fund",
      annualBudget: 290000,
    },
    {
      id: "civic-arts",
      name: "Civic Arts & Public Spaces",
      annualBudget: 180000,
    },
    { id: "ops", name: "Operations & Admin", annualBudget: 410000 },
    {
      id: "events",
      name: "Annual Gala & Community Events",
      annualBudget: 220000,
    },
  ],
};

/* ─── canonical entity graph ─────────────────────────────────────────── */

const FIRST_NAMES = [
  "Sarah", "Marcus", "Elena", "Devin", "Priya", "Jordan", "Aisha", "Ben",
  "Camila", "Wesley", "Hana", "Isaiah", "Olivia", "Theo", "Naomi", "Felix",
  "Maya", "Quinn", "Ravi", "Zoe", "Caleb", "Nia", "Tomás", "Yara",
  "Dmitri", "Imani", "Lucas", "Mei", "Owen", "Sofia",
] as const;

const LAST_NAMES = [
  "Patel", "Nguyen", "Okonkwo", "Hernandez", "Whitfield", "Cho",
  "Ramirez", "Bell", "Goldstein", "Adeyemi", "Park", "Khan",
  "Romano", "Volkov", "Mensah", "Williams", "Tanaka", "Cohen",
  "Sutton", "Reyes", "Ahmed", "Lindgren", "Fischer", "Marchetti",
  "Brooks", "Diaz", "Ng", "Holloway", "Patel", "Ortega",
] as const;

const COMPANIES = [
  { name: "Patel Industries", matchingGiftProgram: true },
  { name: "Northshore Capital", matchingGiftProgram: true },
  { name: "Bridgeway Tech", matchingGiftProgram: true },
  { name: "Rivertown Medical Group", matchingGiftProgram: false },
  { name: "Granite Logistics", matchingGiftProgram: true },
  { name: "Crescent Foods", matchingGiftProgram: false },
  { name: "Holloway & Sons Construction", matchingGiftProgram: false },
  { name: "Cobalt Bank", matchingGiftProgram: true },
] as const;

interface Person {
  kaliId: string;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  phone: string;
  /** Connector-specific id mappings (where this person shows up). */
  ids: Partial<{
    salesforceContactId: string;
    bloomerangDonorId: string;
    m365UserId: string;
    zoomParticipantId: string;
    knowbe4UserId: string;
  }>;
  role: "donor" | "staff" | "board" | "vendor" | "partner" | "prospect";
  /** For donors: their employer (link to matching gifts). */
  employer?: (typeof COMPANIES)[number];
  /** For donors: lifetime giving in USD. */
  lifetimeGiving?: number;
  /** For donors: most recent gift date (ISO). */
  lastGiftAt?: string;
  /** For staff: program affiliation. */
  programId?: string;
  /** For staff: title. */
  title?: string;
}

function genPerson(role: Person["role"]): Person {
  const firstName = pick(FIRST_NAMES);
  const lastName = pick(LAST_NAMES);
  const fullName = `${firstName} ${lastName}`;
  const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}@${
    role === "staff" ? "rivertownfoundation.org" : pickEmailDomain()
  }`;
  const phone = `(${intBetween(200, 989)}) ${intBetween(200, 989)}-${intBetween(
    1000,
    9999,
  )}`;
  return {
    kaliId: id("ent"),
    firstName,
    lastName,
    fullName,
    email,
    phone,
    role,
    ids: {},
  };
}

function pickEmailDomain(): string {
  const r = rand();
  if (r < 0.5) return "gmail.com";
  if (r < 0.7) return "outlook.com";
  if (r < 0.85) return "yahoo.com";
  return "icloud.com";
}

/* ─── populate the org ───────────────────────────────────────────────── */

const staff: Person[] = Array.from({ length: 30 }, () => {
  const p = genPerson("staff");
  p.programId = pick(tenant.programs).id;
  p.title = pick([
    "Program Officer",
    "Program Manager",
    "Director of Development",
    "Grant Writer",
    "Finance Manager",
    "Operations Lead",
    "Community Outreach",
    "Communications Lead",
    "Executive Assistant",
    "CEO",
    "CFO",
    "CTO",
  ]);
  return p;
});

const board: Person[] = Array.from({ length: 7 }, () => {
  const p = genPerson("board");
  p.title = "Board Member";
  return p;
});

const donors: Person[] = Array.from({ length: 1200 }, () => {
  const p = genPerson("donor");
  // 60% have a tracked employer
  if (rand() < 0.6) p.employer = pick(COMPANIES);
  p.lifetimeGiving = moneyBetween(50, 50000);
  // Last gift in past 24 months
  const daysAgo = intBetween(0, 730);
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  p.lastGiftAt = d.toISOString().split("T")[0];
  return p;
});

const vendors: Person[] = Array.from({ length: 12 }, () => {
  const p = genPerson("vendor");
  p.title = pick([
    "Caterer",
    "AV Production",
    "Print Shop",
    "Legal Counsel",
    "IT Consultant",
    "Cleaning Services",
  ]);
  return p;
});

const partners: Person[] = Array.from({ length: 8 }, () => {
  const p = genPerson("partner");
  p.title = "Partner Org Liaison";
  return p;
});

const allPeople = [...staff, ...board, ...donors, ...vendors, ...partners];

// Assign per-connector IDs so each person has a stable presence in each tool.
for (const p of allPeople) {
  if (p.role === "staff") {
    p.ids.m365UserId = id("usr");
    p.ids.knowbe4UserId = id("kb4");
    p.ids.zoomParticipantId = id("zoom");
  }
  if (p.role === "donor" || p.role === "board") {
    p.ids.salesforceContactId = id("003");
    p.ids.bloomerangDonorId = id("bl");
  }
  if (p.role === "donor" || p.role === "board") {
    // Some donors also showed up at events (zoom)
    if (rand() < 0.4) p.ids.zoomParticipantId = id("zoom");
  }
}

/* ─── write the canonical graph as the master record ─────────────────── */

const masterGraph = {
  tenant,
  programs: tenant.programs,
  companies: COMPANIES,
  people: allPeople,
  generatedAt: new Date().toISOString(),
  seedVersion: 1,
};

writeFileSync(
  path.join(SEED_DIR, "_master.json"),
  JSON.stringify(masterGraph, null, 2),
);

console.log(
  `[seed] wrote master graph: ${allPeople.length} people, ${tenant.programs.length} programs`,
);
console.log(
  `[seed]   - donors: ${donors.length}, staff: ${staff.length}, board: ${board.length}, vendors: ${vendors.length}, partners: ${partners.length}`,
);
console.log(`[seed] next: bun scripts/seed-bloomerang.ts (etc.)`);
