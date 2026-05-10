import type {
  EntityGraph, Tenant, Person, EventEntity, Donation, Campaign,
  Grant, Document, EmailEntity, CalendarEvent, ZoomMeeting, PowerAutomateFlow,
  PowerBIDashboard, QBTransaction, KnowBe4Result, SolanaTx, Organization,
} from "./types.ts";
import { makeFaker, makeRng, pick, pickN, chance, intBetween, powerLaw, dateBetween, driftName } from "./random.ts";

export type Size = "small" | "medium" | "large";

export interface SizeConfig {
  staff: number; board: number; donors: number; prospects: number; vendors: number;
  corporateSponsors: number; foundations: number; events: number; campaigns: number;
  grants: number; documents: number; emails: number; zoomMeetings: number;
  qbTransactionsPerMonth: number; solanaTxs: number;
  duplicateDonorRate: number; missingFieldRate: number;
}

export const SIZES: Record<Size, SizeConfig> = {
  small:  { staff:  8, board:  7, donors:   80, prospects:  30, vendors: 12, corporateSponsors:  6, foundations:  8, events: 14, campaigns:  4, grants: 14, documents:  60, emails:   400, zoomMeetings: 16, qbTransactionsPerMonth:  60, solanaTxs:  18, duplicateDonorRate: 0.04, missingFieldRate: 0.10 },
  medium: { staff: 22, board: 11, donors:  600, prospects: 200, vendors: 35, corporateSponsors: 18, foundations: 24, events: 38, campaigns:  9, grants: 38, documents: 220, emails:  3200, zoomMeetings: 60, qbTransactionsPerMonth: 220, solanaTxs:  55, duplicateDonorRate: 0.05, missingFieldRate: 0.13 },
  large:  { staff: 60, board: 18, donors: 4500, prospects: 800, vendors: 90, corporateSponsors: 60, foundations: 80, events: 90, campaigns: 22, grants: 95, documents: 700, emails: 14000, zoomMeetings: 200, qbTransactionsPerMonth: 800, solanaTxs: 220, duplicateDonorRate: 0.06, missingFieldRate: 0.15 },
};

const PROGRAMS_TEMPLATE = [
  { name: "Youth Mentorship", desc: "After-school mentorship for at-risk youth in Sacramento County. K-12 academic support, life skills, mentor matching.", budget: 380000, started: 2018 },
  { name: "Community Health Outreach", desc: "Mobile health clinics, vaccination drives, and health-literacy workshops in underserved neighborhoods.", budget: 520000, started: 2016 },
  { name: "Workforce Development", desc: "Job training, resume support, and employer matching for adults exiting the justice system or recovering from homelessness.", budget: 290000, started: 2020 },
  { name: "Food Security Network", desc: "Operates a 7-pantry network across the region, sourcing surplus from local grocers and partner farms.", budget: 410000, started: 2014 },
  { name: "Family Stabilization", desc: "Emergency rental assistance, financial coaching, and case management for families on the edge of housing crisis.", budget: 350000, started: 2019 },
  { name: "Operating", desc: "General operating fund — staff, infrastructure, fundraising overhead.", budget: 450000, started: 2014 },
];

const STAFF_ROLES = [
  "Executive Director", "Deputy Director", "Director of Development", "Major Gifts Officer",
  "Annual Fund Manager", "Grants Manager", "Director of Programs", "Program Manager — Youth",
  "Program Manager — Health", "Program Manager — Workforce", "Program Coordinator",
  "Communications Director", "Communications Coordinator", "Marketing Specialist",
  "Director of Finance", "Senior Accountant", "Bookkeeper", "Operations Manager",
  "HR Manager", "IT Coordinator", "Database Administrator", "Volunteer Coordinator",
  "Case Manager", "Outreach Specialist", "Office Manager", "Development Associate",
  "Events Coordinator", "Donor Relations Officer", "Compliance Officer", "Board Liaison",
];

const BOARD_TITLES = [
  "Board Chair", "Board Vice Chair", "Treasurer", "Secretary", "Board Member",
  "Board Member", "Governance Committee Chair", "Finance Committee Chair",
  "Programs Committee Chair", "Development Committee Chair", "Audit Committee Member",
];

let __idCounter = 0;
function id(prefix: string): string {
  __idCounter++;
  return `${prefix}_${__idCounter.toString(36).padStart(6, "0")}`;
}

export function buildGraph(size: Size): EntityGraph {
  __idCounter = 0;
  const cfg = SIZES[size];
  const rng = makeRng(`kali-graph-${size}`);
  const faker = makeFaker(0xC4FE);

  const programs = PROGRAMS_TEMPLATE.map(p => ({
    id: id("prog"), name: p.name, description: p.desc, budgetAnnual: p.budget, startedYear: p.started,
  }));

  const tenant: Tenant = {
    id: id("tenant"),
    name: "Rivertown Community Foundation",
    legalName: "Rivertown Community Foundation, Inc.",
    ein: "82-3491582",
    fiscalYearStart: "07-01",
    address: { street: "1245 Mission Street", city: "Sacramento", state: "CA", zip: "95814" },
    mission: "Rivertown Community Foundation strengthens the social fabric of California's Capital Region by funding direct services, building cross-sector coalitions, and equipping families with the resources to stabilize and thrive.",
    programs,
    foundedYear: 2014,
    staffCount: cfg.staff,
    annualBudget: programs.reduce((s, p) => s + p.budgetAnnual, 0),
    website: "https://rivertowncf.org",
  };

  const organizations: Organization[] = [];
  for (let i = 0; i < cfg.corporateSponsors; i++) {
    organizations.push({
      id: id("org"), name: faker.company.name(), type: "corporate_sponsor",
      industry: faker.company.buzzNoun(),
      hasMatchingGifts: chance(rng, 0.55),
      matchingGiftCap: chance(rng, 0.55) ? pick(rng, [2500, 5000, 10000, 25000]) : undefined,
      solanaWallet: chance(rng, 0.4) ? faker.string.alphanumeric(44) : undefined,
    });
  }
  for (let i = 0; i < cfg.foundations; i++) {
    organizations.push({
      id: id("org"),
      name: `${faker.person.lastName()} ${pick(rng, ["Foundation", "Family Trust", "Charitable Fund", "Community Foundation"])}`,
      type: "foundation",
      fundingFocus: pickN(rng, ["youth", "health", "workforce", "food security", "housing", "education", "arts", "environment"], intBetween(rng, 1, 3)),
    });
  }
  for (let i = 0; i < Math.max(2, Math.floor(cfg.foundations / 6)); i++) {
    organizations.push({
      id: id("org"),
      name: pick(rng, ["California Department of Social Services", "Sacramento County Public Health", "City of Sacramento — Community Development", "California Endowment", "USDA — Food and Nutrition Service"]),
      type: "government",
      fundingFocus: pickN(rng, ["health", "workforce", "food security", "housing"], intBetween(rng, 1, 2)),
    });
  }
  for (let i = 0; i < cfg.vendors; i++) {
    organizations.push({
      id: id("org"), name: faker.company.name(), type: "vendor",
      industry: pick(rng, ["IT services", "office supplies", "catering", "facilities", "marketing", "legal", "accounting", "insurance", "printing", "transportation"]),
      solanaWallet: chance(rng, 0.6) ? faker.string.alphanumeric(44) : undefined,
    });
  }
  const corporateSponsors = organizations.filter(o => o.type === "corporate_sponsor");
  const foundations = organizations.filter(o => o.type === "foundation" || o.type === "government");
  const vendors = organizations.filter(o => o.type === "vendor");

  const people: Person[] = [];

  function makePerson(opts: Partial<Person> & { firstName?: string; lastName?: string }): Person {
    const fn = opts.firstName ?? faker.person.firstName();
    const ln = opts.lastName ?? faker.person.lastName();
    const employer = opts.employer ?? (chance(rng, 0.45) ? pick(rng, corporateSponsors).id : undefined);
    const hasMissingEmail = chance(rng, cfg.missingFieldRate * 0.4);
    const hasMissingPhone = chance(rng, cfg.missingFieldRate * 0.6);

    return {
      id: id("ppl"),
      isStaff: false, isBoard: false, isDonor: false, isVolunteer: false, isVendor: false, isProspect: false,
      firstName: fn, lastName: ln,
      email: hasMissingEmail ? "" : `${fn.toLowerCase()}.${ln.toLowerCase().replace(/[^a-z]/g, "")}@${pick(rng, ["gmail.com", "yahoo.com", "outlook.com", "icloud.com", "comcast.net", "aol.com"])}`,
      phone: hasMissingPhone ? "" : faker.phone.number({ style: "national" }),
      address: {
        street: faker.location.streetAddress(),
        city: chance(rng, 0.55) ? "Sacramento" : faker.location.city(),
        state: chance(rng, 0.65) ? "CA" : faker.location.state({ abbreviated: true }),
        zip: faker.location.zipCode("#####"),
      },
      employer,
      jobTitle: employer ? faker.person.jobTitle() : undefined,
      ...opts,
    };
  }

  const staffPeople: Person[] = [];
  for (let i = 0; i < cfg.staff; i++) {
    const role = i < STAFF_ROLES.length ? STAFF_ROLES[i] : pick(rng, STAFF_ROLES);
    const startYear = intBetween(rng, tenant.foundedYear, 2025);
    const p = makePerson({
      isStaff: true, staffRole: role,
      staffStartDate: `${startYear}-${String(intBetween(rng, 1, 12)).padStart(2, "0")}-${String(intBetween(rng, 1, 28)).padStart(2, "0")}`,
      employer: tenant.id, jobTitle: role, email: "",
    });
    p.email = `${p.firstName.toLowerCase()}.${p.lastName.toLowerCase().replace(/[^a-z]/g, "")}@rivertowncf.org`;
    people.push(p); staffPeople.push(p);
  }

  for (let i = 0; i < cfg.board; i++) {
    const title = i < BOARD_TITLES.length ? BOARD_TITLES[i] : "Board Member";
    const employer = chance(rng, 0.7) ? pick(rng, corporateSponsors).id : undefined;
    people.push(makePerson({ isBoard: true, jobTitle: title, employer }));
  }

  const donorPeople: Person[] = [];
  for (let i = 0; i < cfg.donors; i++) {
    const segmentRoll = rng();
    let segment: Person["donorSegment"]; let lifetime: number;
    if (segmentRoll < 0.05) { segment = "major"; lifetime = Math.round(powerLaw(rng, 25000, 500000, 2.0)); }
    else if (segmentRoll < 0.25) { segment = "mid"; lifetime = Math.round(powerLaw(rng, 1000, 25000, 2.5)); }
    else { segment = "grassroots"; lifetime = Math.round(powerLaw(rng, 25, 1000, 3.0)); }

    const firstGiftYears = intBetween(rng, 0, 11);
    const firstGiftDate = new Date(); firstGiftDate.setFullYear(firstGiftDate.getFullYear() - firstGiftYears);
    const lastGiftDate = new Date(firstGiftDate.getTime() + rng() * (Date.now() - firstGiftDate.getTime()));
    const monthsSinceLastGift = (Date.now() - lastGiftDate.getTime()) / (1000 * 60 * 60 * 24 * 30);
    if (monthsSinceLastGift > 18) segment = "lapsed";

    const p = makePerson({
      isDonor: true, donorSegment: segment, lifetimeGiving: lifetime,
      firstGiftDate: firstGiftDate.toISOString().slice(0, 10),
      lastGiftDate: lastGiftDate.toISOString().slice(0, 10),
      solanaWallet: chance(rng, 0.08) ? faker.string.alphanumeric(44) : undefined,
    });
    people.push(p); donorPeople.push(p);
  }

  const duplicates = Math.floor(donorPeople.length * cfg.duplicateDonorRate);
  for (let i = 0; i < duplicates; i++) {
    const original = pick(rng, donorPeople);
    people.push(makePerson({
      isDonor: true, donorSegment: "grassroots",
      lifetimeGiving: Math.round((original.lifetimeGiving ?? 100) * (0.1 + rng() * 0.4)),
      firstName: driftName(rng, original.firstName), lastName: original.lastName,
      email: chance(rng, 0.3) ? original.email : (chance(rng, 0.5) ? original.email.replace(".com", ".con") : ""),
      address: original.address,
    }));
  }

  for (let i = 0; i < cfg.prospects; i++) {
    people.push(makePerson({ isProspect: true, donorSegment: "prospect", lifetimeGiving: 0 }));
  }

  const campaigns: Campaign[] = [];
  const currentYear = new Date().getFullYear();
  for (let yr = currentYear - 2; yr <= currentYear; yr++) {
    campaigns.push({ id: id("camp"), name: `Annual Fund ${yr}`, type: "annual_fund", startDate: `${yr}-01-01`, endDate: `${yr}-12-31`, goal: 150000 + intBetween(rng, 0, 100000) });
    campaigns.push({ id: id("camp"), name: `Year-End Giving ${yr}`, type: "year_end", startDate: `${yr}-11-01`, endDate: `${yr}-12-31`, goal: 80000 + intBetween(rng, 0, 60000) });
    campaigns.push({ id: id("camp"), name: `Giving Tuesday ${yr}`, type: "giving_tuesday", startDate: `${yr}-11-25`, endDate: `${yr}-12-05`, goal: 25000 + intBetween(rng, 0, 25000) });
  }
  while (campaigns.length < cfg.campaigns) {
    const prog = pick(rng, programs);
    const yr = intBetween(rng, currentYear - 2, currentYear);
    campaigns.push({ id: id("camp"), name: `${prog.name} Campaign ${yr}`, type: "program_specific", startDate: `${yr}-${String(intBetween(rng, 1, 9)).padStart(2, "0")}-01`, endDate: `${yr}-${String(intBetween(rng, 10, 12)).padStart(2, "0")}-31`, goal: 30000 + intBetween(rng, 0, 70000), programId: prog.id });
  }

  const events: EventEntity[] = [];
  const EVENT_TYPES: EventEntity["type"][] = ["gala", "fundraiser", "luncheon", "campaign", "volunteer_day", "board_meeting", "training", "webinar"];
  for (let i = 0; i < cfg.events; i++) {
    const evType = pick(rng, EVENT_TYPES);
    const yr = intBetween(rng, currentYear - 2, currentYear);
    const month = intBetween(rng, 1, 12); const day = intBetween(rng, 1, 28);
    const isBoard = evType === "board_meeting";
    const attendeePool = isBoard ? people.filter(p => p.isBoard || p.staffRole?.includes("Director")) : people.filter(p => p.isDonor || p.isStaff || p.isBoard);
    const attendeeCount = isBoard ? attendeePool.length : Math.min(attendeePool.length, intBetween(rng, evType === "gala" ? 80 : 10, evType === "gala" ? 350 : 60));
    events.push({
      id: id("evt"),
      name: `${evType === "gala" ? "Annual Gala" : evType === "luncheon" ? "Donor Luncheon" : evType === "volunteer_day" ? "Volunteer Day" : evType === "board_meeting" ? "Board Meeting" : evType === "training" ? "Staff Training" : evType === "webinar" ? "Community Webinar" : "Community Fundraiser"} ${yr}-${String(month).padStart(2, "0")}`,
      type: evType, date: `${yr}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
      programId: chance(rng, 0.5) ? pick(rng, programs).id : undefined,
      attendeeIds: pickN(rng, attendeePool, attendeeCount).map(p => p.id),
      ticketRevenue: ["gala", "fundraiser", "luncheon"].includes(evType) ? attendeeCount * intBetween(rng, 75, 350) : undefined,
      cancelled: chance(rng, 0.05),
    });
  }

  const donations: Donation[] = [];
  for (const donor of donorPeople) {
    const giftCount = donor.donorSegment === "major" ? intBetween(rng, 4, 24) : donor.donorSegment === "mid" ? intBetween(rng, 2, 12) : intBetween(rng, 1, 6);
    for (let i = 0; i < giftCount; i++) {
      const amount = donor.donorSegment === "major" ? Math.round(powerLaw(rng, 1000, 100000, 2.0)) : donor.donorSegment === "mid" ? Math.round(powerLaw(rng, 100, 5000, 2.5)) : Math.round(powerLaw(rng, 10, 250, 2.5));
      const employer = donor.employer ? organizations.find(o => o.id === donor.employer) : undefined;
      const isMatched = !!(employer?.hasMatchingGifts && chance(rng, 0.4) && donor.donorSegment !== "lapsed");
      const dateStr = dateBetween(rng, new Date(donor.firstGiftDate ?? "2020-01-01"), new Date(donor.lastGiftDate ?? new Date())).toISOString().slice(0, 10);
      donations.push({
        id: id("don"), donorId: donor.id, amount, date: dateStr,
        campaignId: chance(rng, 0.7) ? pick(rng, campaigns).id : undefined,
        eventId: chance(rng, 0.25) ? pick(rng, events).id : undefined,
        programDesignation: chance(rng, 0.4) ? pick(rng, programs).id : undefined,
        paymentMethod: pick(rng, ["credit_card", "credit_card", "credit_card", "check", "ach", "stock", "crypto", "in_kind"]),
        isMatched, matchedAmount: isMatched ? Math.min(amount, employer?.matchingGiftCap ?? amount) : undefined,
        matchingOrgId: isMatched ? employer?.id : undefined,
        acknowledged: chance(rng, 0.85),
        thankYouSentDate: chance(rng, 0.75) ? dateStr : undefined,
      });
    }
  }

  const grants: Grant[] = [];
  const GRANT_STATUSES: Grant["status"][] = ["prospect", "in_progress", "submitted", "awarded", "rejected", "active", "reporting", "closed"];
  for (let i = 0; i < cfg.grants; i++) {
    const status = pick(rng, GRANT_STATUSES);
    const funder = pick(rng, foundations);
    const amount = Math.round(powerLaw(rng, 5000, 500000, 2.0));
    const deadlineDate = dateBetween(rng, new Date(currentYear - 1, 0, 1), new Date(currentYear + 1, 0, 1));
    grants.push({
      id: id("grant"), funderId: funder.id, programId: chance(rng, 0.7) ? pick(rng, programs).id : undefined,
      status, amount,
      amountAwarded: ["awarded", "active", "reporting", "closed"].includes(status) ? amount * (0.5 + rng() * 0.5) : undefined,
      deadline: deadlineDate.toISOString().slice(0, 10),
      submittedDate: ["submitted", "awarded", "rejected", "active", "reporting", "closed"].includes(status) ? new Date(deadlineDate.getTime() - intBetween(rng, 7, 60) * 86400000).toISOString().slice(0, 10) : undefined,
      awardedDate: ["awarded", "active", "reporting", "closed"].includes(status) ? new Date(deadlineDate.getTime() + intBetween(rng, 30, 90) * 86400000).toISOString().slice(0, 10) : undefined,
      reportDueDate: ["reporting"].includes(status) ? new Date(Date.now() + intBetween(rng, 14, 90) * 86400000).toISOString().slice(0, 10) : undefined,
      fitScore: intBetween(rng, 35, 98),
      notes: chance(rng, 0.5) ? faker.lorem.sentences(intBetween(rng, 1, 3)) : undefined,
      documents: [],
    });
  }

  const documents: Document[] = [];
  const DOC_TYPES: Document["type"][] = ["board_minutes", "program_report", "grant_application", "financial_statement", "policy", "hr_record", "communication_plan", "annual_report"];
  for (let i = 0; i < cfg.documents; i++) {
    const docType = pick(rng, DOC_TYPES);
    const author = docType === "hr_record" ? pick(rng, staffPeople.filter(s => s.staffRole?.includes("HR"))) ?? pick(rng, staffPeople) : pick(rng, staffPeople);
    const program = ["program_report", "grant_application", "communication_plan"].includes(docType) ? pick(rng, programs) : undefined;
    const grantRef = docType === "grant_application" ? pick(rng, grants) : undefined;
    const created = dateBetween(rng, new Date(currentYear - 2, 0, 1), new Date());
    const tags = pickN(rng, ["confidential", "draft", "approved", "fy2024", "fy2025", "fy2026", "pending-review", "archived", "shared"], intBetween(rng, 1, 3));
    const title = docType === "board_minutes" ? `Board Meeting Minutes — ${created.toISOString().slice(0, 10)}` : docType === "program_report" ? `${program?.name ?? "Program"} Quarterly Report — ${created.toISOString().slice(0, 7)}` : docType === "grant_application" ? `Grant Application — ${pick(rng, foundations).name}` : docType === "financial_statement" ? `Financial Statement — ${created.toISOString().slice(0, 7)}` : docType === "policy" ? `Policy: ${faker.lorem.words(3)}` : docType === "hr_record" ? `HR — ${pick(rng, staffPeople).firstName} ${pick(rng, staffPeople).lastName}` : docType === "communication_plan" ? `Communication Plan — ${faker.lorem.words(2)}` : `Annual Report — FY${created.getFullYear()}`;
    documents.push({
      id: id("doc"), title, type: docType, authorId: author?.id,
      createdDate: created.toISOString().slice(0, 10),
      modifiedDate: dateBetween(rng, created, new Date()).toISOString().slice(0, 10),
      programId: program?.id, grantId: grantRef?.id, tags,
      body: faker.lorem.paragraphs(intBetween(rng, 3, 10), "\n\n"),
      externalSharing: chance(rng, 0.15) ? [`${faker.internet.username()}@${faker.internet.domainName()}`] : undefined,
      sizeKb: intBetween(rng, 30, 4500),
    });
    if (grantRef) grantRef.documents.push(documents.at(-1)!.id);
  }

  const emails: EmailEntity[] = [];
  for (let i = 0; i < cfg.emails; i++) {
    const from = pick(rng, staffPeople);
    const recipients = pickN(rng, people, intBetween(rng, 1, 5)).map(p => p.id);
    const dt = dateBetween(rng, new Date(Date.now() - 365 * 86400000), new Date());
    emails.push({
      id: id("eml"), fromId: from.id, toIds: recipients,
      subject: pick(rng, ["Re: Board prep next week", "Donor stewardship update — Q3", `Grant deadline reminder: ${pick(rng, foundations).name}`, "Quick question about the gala manifest", "FY budget revisions", "Year-end appeal copy review", "Volunteer schedule for Saturday", "Re: Major gift prospects", `${pick(rng, programs).name} program update`, "Vendor invoice — please approve", "Salesforce report", "Quarterly impact metrics", faker.lorem.sentence({ min: 3, max: 8 }).slice(0, 60)]),
      date: dt.toISOString(),
      threadId: `thr_${intBetween(rng, 1, Math.max(1, Math.floor(cfg.emails / 6)))}`,
      snippet: faker.lorem.sentence({ min: 8, max: 24 }).slice(0, 200),
      hasAttachment: chance(rng, 0.18),
    });
  }

  const calendarEvents: CalendarEvent[] = [];
  for (const staff of staffPeople) {
    const meetingCount = intBetween(rng, 30, 90);
    for (let i = 0; i < meetingCount; i++) {
      const start = dateBetween(rng, new Date(Date.now() - 180 * 86400000), new Date(Date.now() + 30 * 86400000));
      const dur = pick(rng, [15, 30, 30, 30, 60, 60, 90]);
      calendarEvents.push({
        id: id("cal"), ownerId: staff.id,
        title: pick(rng, ["1:1 check-in", "Donor call", "Board prep", "Grant review", "Program sync", "Team standup", "Vendor meeting", "Board meeting", "Strategy session"]),
        start: start.toISOString(), end: new Date(start.getTime() + dur * 60000).toISOString(),
        attendeeIds: pickN(rng, [...staffPeople, ...people.filter(p => p.isBoard)], intBetween(rng, 1, 6)).map(p => p.id),
        location: chance(rng, 0.4) ? "Zoom" : chance(rng, 0.6) ? "Office — Conference Room A" : undefined,
      });
    }
  }

  const zoomMeetings: ZoomMeeting[] = [];
  for (let i = 0; i < cfg.zoomMeetings; i++) {
    const host = pick(rng, staffPeople);
    const start = dateBetween(rng, new Date(Date.now() - 365 * 86400000), new Date());
    const dur = pick(rng, [30, 45, 60, 60, 90, 120]);
    const hasRec = chance(rng, 0.55);
    zoomMeetings.push({
      id: id("zoom"), hostId: host.id,
      topic: pick(rng, ["Board Meeting", "Donor Strategy Session", "Program Review", "Annual Gala — Virtual", "Team All-Hands", "Grant Strategy", "Major Donor Steward Call", "Fundraising Pipeline Review"]),
      startTime: start.toISOString(), durationMin: dur,
      attendeeIds: pickN(rng, [...staffPeople, ...people.filter(p => p.isBoard || p.isDonor)], intBetween(rng, 2, 30)).map(p => p.id),
      hasRecording: hasRec, hasTranscript: hasRec && chance(rng, 0.7),
      transcriptText: hasRec && chance(rng, 0.7) ? faker.lorem.paragraphs(intBetween(rng, 5, 20), "\n\n") : undefined,
    });
  }

  const powerAutomateFlows: PowerAutomateFlow[] = [];
  const FLOW_TEMPLATES = [
    { name: "Auto-acknowledge donations under $500", desc: "Sends templated thank-you within 24h of any online gift under $500", trigger: "Bloomerang webhook: new_donation" },
    { name: "Grant deadline 30-day alerts", desc: "Posts to #grants Teams channel and emails Grants Manager 30 days before any tracked Instrumentl deadline", trigger: "Scheduled: daily 09:00" },
    { name: "Board meeting prep packet", desc: "Pulls financials, program reports, donor pipeline 7 days before board meetings, drops in SharePoint", trigger: "Scheduled: 7d before calendar event tagged board" },
    { name: "Major gift alert ($5K+)", desc: "Slacks ED + DOD when any Bloomerang gift > $5,000", trigger: "Bloomerang webhook" },
    { name: "Lapsed donor re-engagement queue", desc: "Weekly: surfaces donors who haven't given in 14+ months and adds to outreach queue", trigger: "Scheduled: weekly Mon 08:00" },
    { name: "Volunteer day signup confirmation", desc: "Sends Zoom link + parking instructions to volunteer registrations", trigger: "Form submission" },
    { name: "Quarterly impact report assembly", desc: "Aggregates metrics from Power BI, drops PDF in board SharePoint folder", trigger: "Scheduled: quarterly" },
    { name: "Vendor invoice routing", desc: "Routes vendor invoices > $5K to Finance Director for approval before paying", trigger: "QuickBooks: new bill" },
    { name: "New donor welcome series", desc: "5-email welcome series for first-time donors over 30 days", trigger: "Bloomerang: first-gift flag" },
    { name: "Program report submission tracker", desc: "Reminds program managers when monthly reports are 3 days overdue", trigger: "Scheduled" },
    { name: "Stale lead scrubber", desc: "Archives Salesforce leads with no activity in 12 months", trigger: "Scheduled: monthly" },
    { name: "Board attendance compliance", desc: "Flags board members who've missed 3+ consecutive meetings to Board Liaison", trigger: "Calendar event tagged board_meeting" },
  ];
  for (let i = 0; i < Math.min(cfg.events / 3, FLOW_TEMPLATES.length); i++) {
    const tmpl = FLOW_TEMPLATES[i];
    const owner = pick(rng, staffPeople);
    const runs: PowerAutomateFlow["runHistory"] = [];
    for (let j = 0; j < intBetween(rng, 30, 220); j++) {
      runs.push({
        date: dateBetween(rng, new Date(Date.now() - 180 * 86400000), new Date()).toISOString(),
        status: chance(rng, 0.92) ? "success" : "failure",
        durationMs: intBetween(rng, 200, 8000),
      });
    }
    powerAutomateFlows.push({
      id: id("flow"), name: tmpl.name, description: tmpl.desc, trigger: tmpl.trigger,
      active: chance(rng, 0.85),
      createdDate: dateBetween(rng, new Date(2023, 0, 1), new Date(2025, 11, 31)).toISOString().slice(0, 10),
      runHistory: runs.sort((a, b) => a.date.localeCompare(b.date)),
      ownerId: owner.id,
    });
  }

  const powerBIDashboards: PowerBIDashboard[] = [
    { id: id("dash"), name: "Donor Health", metrics: [
      { name: "Active donors (LYBUNT-adjusted)", value: Math.floor(cfg.donors * 0.62), trendPct: 0.04 },
      { name: "Lapsed donor count", value: people.filter(p => p.donorSegment === "lapsed").length, trendPct: 0.07 },
      { name: "Average gift size", value: Math.round(donations.reduce((s, d) => s + d.amount, 0) / Math.max(1, donations.length)), trendPct: -0.02 },
      { name: "Retention rate", value: 64, trendPct: -0.03 },
      { name: "New donor acquisition", value: Math.floor(cfg.donors * 0.11), trendPct: 0.12 },
    ]},
    { id: id("dash"), name: "Program Impact", metrics: programs.map(p => ({ name: `${p.name} — beneficiaries served`, value: intBetween(rng, 200, 4000), trendPct: (rng() - 0.4) * 0.4 })) },
    { id: id("dash"), name: "Fundraising Pipeline", metrics: [
      { name: "Pipeline value (next 90d)", value: Math.round(donations.slice(0, 50).reduce((s, d) => s + d.amount, 0) * 1.4), trendPct: 0.08 },
      { name: "Open grant requests ($)", value: grants.filter(g => ["submitted", "in_progress"].includes(g.status)).reduce((s, g) => s + g.amount, 0), trendPct: 0.15 },
      { name: "Major gift prospects", value: people.filter(p => p.donorSegment === "prospect").length, trendPct: 0.05 },
      { name: "Annual fund YTD", value: donations.filter(d => new Date(d.date).getFullYear() === currentYear && campaigns.find(c => c.id === d.campaignId)?.type === "annual_fund").reduce((s, d) => s + d.amount, 0), trendPct: 0.06 },
    ]},
    { id: id("dash"), name: "Financial Health", metrics: [
      { name: "Cash on hand", value: 1250000 + intBetween(rng, -250000, 350000), trendPct: -0.01 },
      { name: "Months of operating reserve", value: 4 + Math.round(rng() * 3), trendPct: -0.05 },
      { name: "Restricted fund balance", value: 480000 + intBetween(rng, -100000, 200000), trendPct: 0.03 },
      { name: "FY budget % executed", value: intBetween(rng, 35, 95), trendPct: 0 },
    ]},
  ];

  const qbTransactions: QBTransaction[] = [];
  for (const d of donations) {
    qbTransactions.push({
      id: id("qb"), date: d.date, type: "income", category: "Contributed Income",
      amount: d.amount, account: pick(rng, ["Operating Checking", "Restricted Checking"]),
      programId: d.programDesignation, donationId: d.id,
      memo: `Gift from donor ${d.donorId}${d.campaignId ? ` (${campaigns.find(c => c.id === d.campaignId)?.name})` : ""}`,
    });
  }
  const monthsBack = 18;
  for (let m = 0; m < monthsBack; m++) {
    const monthDate = new Date(); monthDate.setMonth(monthDate.getMonth() - m);
    for (let i = 0; i < cfg.qbTransactionsPerMonth / 12; i++) {
      const isVendorPay = chance(rng, 0.4);
      qbTransactions.push({
        id: id("qb"),
        date: dateBetween(rng, new Date(monthDate.getFullYear(), monthDate.getMonth(), 1), new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0)).toISOString().slice(0, 10),
        type: "expense",
        category: pick(rng, ["Salaries & Wages", "Benefits", "Rent", "Utilities", "Office Supplies", "Travel", "Professional Services", "Program Supplies", "Marketing", "Insurance", "Tech / SaaS"]),
        amount: Math.round(powerLaw(rng, 50, 25000, 2.5)),
        account: pick(rng, ["Operating Checking", "Operating Checking", "Operating Checking", "Restricted Checking"]),
        programId: chance(rng, 0.6) ? pick(rng, programs).id : undefined,
        vendorId: isVendorPay ? pick(rng, vendors).id : undefined,
        memo: chance(rng, 0.5) ? faker.lorem.sentence({ min: 3, max: 10 }) : undefined,
      });
    }
  }

  const knowBe4Results: KnowBe4Result[] = staffPeople.map(s => {
    const phishCount = intBetween(rng, 8, 24);
    const phishingTests: KnowBe4Result["phishingTests"] = [];
    let failures = 0;
    for (let i = 0; i < phishCount; i++) {
      const result: KnowBe4Result["phishingTests"][number]["result"] = rng() < 0.85 ? "passed" : (rng() < 0.6 ? "failed_clicked" : "failed_credentials");
      if (result !== "passed") failures++;
      phishingTests.push({ date: dateBetween(rng, new Date(Date.now() - 365 * 86400000), new Date()).toISOString().slice(0, 10), result });
    }
    const riskScore = Math.min(100, failures * 12 + intBetween(rng, 5, 35));
    const flagged = riskScore > 60 && chance(rng, 0.5) ? [{ date: new Date(Date.now() - intBetween(rng, 1, 90) * 86400000).toISOString().slice(0, 10), reason: pick(rng, ["Clicked simulated phishing link", "Reported suspicious attachment late", "Skipped quarterly training"]) }] : undefined;
    return { userId: s.id, riskScore, trainingCompletionPct: intBetween(rng, 60, 100), phishingTests, flagged };
  });

  const solanaTxs: SolanaTx[] = [];
  const treasuryWallet = "rivertowncf7Hp9YJK8Lm3X2N4P5Q6R7S8T9U0V1W2X3Y";
  for (let i = 0; i < cfg.solanaTxs; i++) {
    const txTypes: SolanaTx["type"][] = ["grant_disbursement", "vendor_payment", "board_stipend", "donor_refund"];
    const txType = pick(rng, txTypes);
    let recipient: Person | Organization;
    let refKind: SolanaTx["reference"]["kind"]; let refId: string; let amount: number;
    if (txType === "grant_disbursement") {
      recipient = pick(rng, organizations.filter(o => o.type === "partner" || o.type === "foundation"));
      refKind = "grant"; refId = pick(rng, grants).id;
      amount = Math.round(powerLaw(rng, 1000, 100000, 2.2));
    } else if (txType === "vendor_payment") {
      const vendor = pick(rng, vendors.filter(v => v.solanaWallet) ?? vendors);
      recipient = vendor; refKind = "vendor"; refId = vendor.id;
      amount = Math.round(powerLaw(rng, 100, 12000, 2.5));
    } else if (txType === "board_stipend") {
      const board = pick(rng, people.filter(p => p.isBoard));
      recipient = board; refKind = "board"; refId = board.id;
      amount = pick(rng, [500, 750, 1000]);
    } else {
      const donor = pick(rng, donorPeople);
      recipient = donor; refKind = "donation";
      refId = pick(rng, donations.filter(d => d.donorId === donor.id) ?? donations).id;
      amount = Math.round(powerLaw(rng, 50, 2500, 2.5));
    }
    solanaTxs.push({
      id: id("sol"), signature: faker.string.alphanumeric(88), type: txType, amountUsdc: amount,
      date: dateBetween(rng, new Date(Date.now() - 180 * 86400000), new Date()).toISOString(),
      fromWallet: treasuryWallet,
      toWallet: ("solanaWallet" in recipient && recipient.solanaWallet) ? recipient.solanaWallet : faker.string.alphanumeric(44),
      recipientId: recipient.id, reference: { kind: refKind, id: refId },
      feeLamports: intBetween(rng, 5000, 12000), status: "confirmed",
    });
  }

  return { tenant, people, organizations, events, donations, campaigns, grants, documents, emails, calendarEvents, zoomMeetings, powerAutomateFlows, powerBIDashboards, qbTransactions, knowBe4Results, solanaTxs };
}
