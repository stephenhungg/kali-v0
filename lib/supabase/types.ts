/**
 * Onboarding state stored on Supabase auth user_metadata.
 *
 * One Supabase user = one tenant. The user_metadata JSON blob carries the
 * org profile + connector selections + uploads + completion timestamp. No
 * separate tenants/users table — the auth.users.id IS the tenant id.
 */

export type BudgetBracket = "under_500k" | "500k_2m" | "2m_10m" | "over_10m";

export interface TenantProfile {
  /** Org display name shown in chat header + greetings. */
  name: string;
  /** Federal EIN, format: XX-XXXXXXX. Stored loosely (display-only). */
  ein?: string;
  /** One-line mission statement, used in personalized prompts. */
  mission?: string;
  city?: string;
  state?: string;
  budgetBracket?: BudgetBracket;
}

export interface UploadRecord {
  id: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  /** Forged record count Kali "extracted." */
  recordsExtracted: number;
  entitiesResolved: number;
  durationMs: number;
  uploadedAt: string; // ISO
}

/**
 * The single source of truth for "where is this user in the wizard?" plus
 * everything they've entered so far. Persisted to Supabase user_metadata
 * after each step transition. Refreshing mid-flow restores from this.
 */
export interface OnboardingState {
  /** 1-based step index. 1=signup, 2=profile, 3=stack, 4=connect, 5=upload, 6=welcome. */
  currentStep: number;
  /** Tenant profile fields collected in step 2. */
  tenant?: TenantProfile;
  /** Connector ids the user said they use (matches lib/connectors/status::CONNECTOR_DISPLAYS ids). */
  selectedConnectors?: string[];
  /** Connector ids the user "connected" via the mock OAuth modal. */
  connectedConnectors?: string[];
  /** Files the user "uploaded" (theater — content was discarded). */
  uploads?: UploadRecord[];
  /** Set when the user hits the final CTA. After this, /chat + /dashboard unlock. */
  onboardedAt?: string; // ISO
}

export const ONBOARDING_STEPS = [
  { n: 1, slug: "signup", label: "Create account" },
  { n: 2, slug: "profile", label: "Your nonprofit" },
  { n: 3, slug: "stack", label: "Pick your tools" },
  { n: 4, slug: "connect", label: "Connect them" },
  { n: 5, slug: "upload", label: "Drop your data" },
  { n: 6, slug: "welcome", label: "You're in" },
] as const;
