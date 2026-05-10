// The source-of-truth entity graph. Every connector references entities by their
// canonical Kali ID, so cross-tool queries work coherently.

export type KaliId = string;

export interface Tenant {
  id: KaliId;
  name: string;
  legalName: string;
  ein: string;
  fiscalYearStart: string; // MM-DD, e.g., "07-01" for July fiscal year
  address: { street: string; city: string; state: string; zip: string };
  mission: string;
  programs: Program[];
  foundedYear: number;
  staffCount: number;
  annualBudget: number;
  website: string;
}

export interface Program {
  id: KaliId;
  name: string;
  description: string;
  budgetAnnual: number;
  startedYear: number;
}

export interface Person {
  id: KaliId;
  // role buckets — a person can be multiple
  isStaff: boolean;
  isBoard: boolean;
  isDonor: boolean;
  isVolunteer: boolean;
  isVendor: boolean;
  isProspect: boolean;
  // identity
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address: { street: string; city: string; state: string; zip: string };
  employer?: KaliId; // → Organization
  jobTitle?: string;
  // staff-specific
  staffRole?: string;
  staffStartDate?: string;
  // donor-specific
  donorSegment?: "major" | "mid" | "grassroots" | "lapsed" | "prospect";
  lifetimeGiving?: number;
  firstGiftDate?: string;
  lastGiftDate?: string;
  // wallet for solana
  solanaWallet?: string;
}

export interface Organization {
  id: KaliId;
  name: string;
  type: "corporate_sponsor" | "foundation" | "government" | "vendor" | "partner" | "other";
  industry?: string;
  hasMatchingGifts?: boolean;
  matchingGiftCap?: number;
  fundingFocus?: string[];
  solanaWallet?: string;
}

export interface EventEntity {
  id: KaliId;
  name: string;
  type: "gala" | "fundraiser" | "luncheon" | "campaign" | "volunteer_day" | "board_meeting" | "training" | "webinar";
  date: string;
  programId?: KaliId;
  attendeeIds: KaliId[];
  ticketRevenue?: number;
  cancelled?: boolean;
}

export interface Donation {
  id: KaliId;
  donorId: KaliId;
  amount: number;
  date: string;
  campaignId?: KaliId;
  eventId?: KaliId;
  programDesignation?: KaliId;
  paymentMethod: "cash" | "check" | "credit_card" | "ach" | "stock" | "crypto" | "in_kind";
  isMatched?: boolean;
  matchedAmount?: number;
  matchingOrgId?: KaliId;
  acknowledged?: boolean;
  thankYouSentDate?: string;
}

export interface Campaign {
  id: KaliId;
  name: string;
  type: "annual_fund" | "capital" | "year_end" | "giving_tuesday" | "emergency" | "program_specific";
  startDate: string;
  endDate: string;
  goal: number;
  programId?: KaliId;
}

export interface Grant {
  id: KaliId;
  funderId: KaliId; // → Organization
  programId?: KaliId;
  status: "prospect" | "in_progress" | "submitted" | "awarded" | "rejected" | "active" | "reporting" | "closed";
  amount: number;
  amountAwarded?: number;
  deadline?: string;
  submittedDate?: string;
  awardedDate?: string;
  reportDueDate?: string;
  fitScore?: number; // 0-100
  notes?: string;
  documents: KaliId[]; // → Document IDs
}

export interface Document {
  id: KaliId;
  title: string;
  type: "board_minutes" | "program_report" | "grant_application" | "financial_statement" | "policy" | "hr_record" | "communication_plan" | "annual_report";
  authorId?: KaliId;
  createdDate: string;
  modifiedDate: string;
  programId?: KaliId;
  grantId?: KaliId;
  tags: string[];
  body: string;
  externalSharing?: string[]; // emails of external recipients
  sizeKb: number;
}

export interface EmailEntity {
  id: KaliId;
  fromId: KaliId;
  toIds: KaliId[];
  subject: string;
  date: string;
  threadId: string;
  snippet: string; // first 200 chars only — we don't seed full bodies for privacy
  hasAttachment?: boolean;
}

export interface CalendarEvent {
  id: KaliId;
  ownerId: KaliId;
  title: string;
  start: string;
  end: string;
  attendeeIds: KaliId[];
  location?: string;
  zoomMeetingId?: KaliId;
}

export interface ZoomMeeting {
  id: KaliId;
  hostId: KaliId;
  topic: string;
  startTime: string;
  durationMin: number;
  attendeeIds: KaliId[];
  hasRecording: boolean;
  hasTranscript: boolean;
  transcriptText?: string;
}

export interface PowerAutomateFlow {
  id: KaliId;
  name: string;
  description: string;
  trigger: string;
  active: boolean;
  createdDate: string;
  runHistory: { date: string; status: "success" | "failure"; durationMs: number }[];
  ownerId: KaliId;
}

export interface PowerBIDashboard {
  id: KaliId;
  name: string;
  metrics: { name: string; value: number; trendPct: number }[];
}

export interface QBTransaction {
  id: KaliId;
  date: string;
  type: "income" | "expense" | "transfer";
  category: string;
  amount: number;
  account: string;
  programId?: KaliId;
  vendorId?: KaliId;
  donationId?: KaliId;
  memo?: string;
}

export interface KnowBe4Result {
  userId: KaliId;
  riskScore: number; // 0-100
  trainingCompletionPct: number;
  phishingTests: { date: string; result: "passed" | "failed_clicked" | "failed_credentials" }[];
  flagged?: { date: string; reason: string }[];
}

export interface SolanaTx {
  id: KaliId;
  signature: string;
  type: "grant_disbursement" | "vendor_payment" | "board_stipend" | "donor_refund";
  amountUsdc: number;
  date: string;
  fromWallet: string;
  toWallet: string;
  recipientId: KaliId;
  reference: { kind: "grant" | "donation" | "vendor" | "board"; id: KaliId };
  feeLamports: number;
  status: "confirmed";
}

export interface EntityGraph {
  tenant: Tenant;
  people: Person[];
  organizations: Organization[];
  events: EventEntity[];
  donations: Donation[];
  campaigns: Campaign[];
  grants: Grant[];
  documents: Document[];
  emails: EmailEntity[];
  calendarEvents: CalendarEvent[];
  zoomMeetings: ZoomMeeting[];
  powerAutomateFlows: PowerAutomateFlow[];
  powerBIDashboards: PowerBIDashboard[];
  qbTransactions: QBTransaction[];
  knowBe4Results: KnowBe4Result[];
  solanaTxs: SolanaTx[];
}
