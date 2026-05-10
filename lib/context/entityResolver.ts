/**
 * Cross-source entity resolution.
 *
 * Every connector seed has `kali_entity_id` already baked in (the seed
 * generator canonicalises at build time — see `lib/seed/build-graph.ts`).
 * The resolver's job is therefore not to *infer* canonical ids — it's to
 * **find** one given a free-text fragment (name / email / phone).
 *
 * For v1 the resolver is rule-based:
 *   1. Email exact match (confidence 100)
 *   2. Phone exact normalized match (confidence 90)
 *   3. Full-name exact match (confidence 80)
 *   4. Substring name + corroborating attribute (confidence 60)
 *   5. Substring name only (confidence 40)
 *
 * Sources scanned:
 *   - bloomerang.constituents (donors + prospects)
 *   - salesforce.contacts (board, donors, prospects)
 *   - m365.users (staff)
 *   - zoom meeting participants (covers anyone who's been in a call)
 *
 * Higher confidence wins; ties resolve by source priority
 * (bloomerang > salesforce > m365 > zoom — donors carry the most context).
 */

import { getBloomerangSeed } from "../connectors/bloomerang";
import { getM365Seed } from "../connectors/m365";
import { getSalesforceSeed } from "../connectors/salesforce";
import { getZoomSeed } from "../connectors/zoom";

export type ResolverSource = "bloomerang" | "salesforce" | "m365" | "zoom";

const SOURCE_PRIORITY: Record<ResolverSource, number> = {
  bloomerang: 4,
  salesforce: 3,
  m365: 2,
  zoom: 1,
};

export interface ResolverHit {
  kali_entity_id: string;
  name: string;
  email: string | null;
  source: ResolverSource;
  /** 0..100 — higher is more confident. */
  confidence: number;
  /** Why we matched (for explainability in the UI). */
  matchedOn: string;
}

export interface ResolveArgs {
  name?: string;
  email?: string;
  phone?: string;
  /** Cap on rows returned. Default 10. Hard-capped at 50. */
  limit?: number;
}

function normalizePhone(p: string | null | undefined): string | null {
  if (!p) return null;
  const digits = p.replace(/[^\d]/g, "");
  if (digits.length === 0) return null;
  // Trim a leading "1" (US country code) so "+1 (555) 123-4567" matches "5551234567".
  return digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
}

function lc(s: string | null | undefined): string {
  return (s ?? "").toLowerCase().trim();
}

function pushHit(
  out: Map<string, ResolverHit>,
  hit: ResolverHit,
): void {
  const existing = out.get(hit.kali_entity_id);
  if (!existing) {
    out.set(hit.kali_entity_id, hit);
    return;
  }
  // Prefer higher confidence; on a tie, prefer the higher-priority source.
  if (
    hit.confidence > existing.confidence ||
    (hit.confidence === existing.confidence &&
      SOURCE_PRIORITY[hit.source] > SOURCE_PRIORITY[existing.source])
  ) {
    out.set(hit.kali_entity_id, hit);
  }
}

export async function resolveEntity(
  args: ResolveArgs,
): Promise<{ count: number; hits: ResolverHit[] }> {
  if (!args.name && !args.email && !args.phone) {
    return { count: 0, hits: [] };
  }
  const limit = Math.min(args.limit ?? 10, 50);
  const wantEmail = lc(args.email);
  const wantPhone = normalizePhone(args.phone);
  const wantName = lc(args.name);

  const out = new Map<string, ResolverHit>();

  const [bloom, sf, m365, zoom] = await Promise.all([
    getBloomerangSeed(),
    getSalesforceSeed(),
    getM365Seed(),
    getZoomSeed(),
  ]);

  // ─── bloomerang.constituents ─────────────────────────────────────
  for (const c of bloom.constituents) {
    const fullName = lc(`${c.firstName} ${c.lastName}`);
    const cEmail = lc(c.primaryEmail.value);
    const cPhone = normalizePhone(c.primaryPhone?.value ?? null);

    if (wantEmail && cEmail && cEmail === wantEmail) {
      pushHit(out, {
        kali_entity_id: c.kali_entity_id,
        name: `${c.firstName} ${c.lastName}`.trim(),
        email: cEmail || null,
        source: "bloomerang",
        confidence: 100,
        matchedOn: "email",
      });
      continue;
    }
    if (wantPhone && cPhone && cPhone === wantPhone) {
      pushHit(out, {
        kali_entity_id: c.kali_entity_id,
        name: `${c.firstName} ${c.lastName}`.trim(),
        email: cEmail || null,
        source: "bloomerang",
        confidence: 90,
        matchedOn: "phone",
      });
      continue;
    }
    if (wantName && fullName === wantName) {
      pushHit(out, {
        kali_entity_id: c.kali_entity_id,
        name: `${c.firstName} ${c.lastName}`.trim(),
        email: cEmail || null,
        source: "bloomerang",
        confidence: 80,
        matchedOn: "exact_name",
      });
      continue;
    }
    if (wantName && fullName.includes(wantName)) {
      const corroborated =
        (wantEmail && cEmail && cEmail.includes(wantEmail)) ||
        (wantPhone && cPhone && cPhone.includes(wantPhone));
      pushHit(out, {
        kali_entity_id: c.kali_entity_id,
        name: `${c.firstName} ${c.lastName}`.trim(),
        email: cEmail || null,
        source: "bloomerang",
        confidence: corroborated ? 60 : 40,
        matchedOn: corroborated ? "name+attr" : "name_substring",
      });
    }
  }

  // ─── salesforce.contacts ─────────────────────────────────────────
  for (const c of sf.contacts) {
    const fullName = lc(`${c.FirstName} ${c.LastName}`);
    const cEmail = lc(c.Email ?? "");
    const cPhone = normalizePhone(c.Phone);

    if (wantEmail && cEmail && cEmail === wantEmail) {
      pushHit(out, {
        kali_entity_id: c.kali_entity_id,
        name: `${c.FirstName} ${c.LastName}`.trim(),
        email: c.Email,
        source: "salesforce",
        confidence: 100,
        matchedOn: "email",
      });
      continue;
    }
    if (wantPhone && cPhone && cPhone === wantPhone) {
      pushHit(out, {
        kali_entity_id: c.kali_entity_id,
        name: `${c.FirstName} ${c.LastName}`.trim(),
        email: c.Email,
        source: "salesforce",
        confidence: 90,
        matchedOn: "phone",
      });
      continue;
    }
    if (wantName && fullName === wantName) {
      pushHit(out, {
        kali_entity_id: c.kali_entity_id,
        name: `${c.FirstName} ${c.LastName}`.trim(),
        email: c.Email,
        source: "salesforce",
        confidence: 80,
        matchedOn: "exact_name",
      });
      continue;
    }
    if (wantName && fullName.includes(wantName)) {
      pushHit(out, {
        kali_entity_id: c.kali_entity_id,
        name: `${c.FirstName} ${c.LastName}`.trim(),
        email: c.Email,
        source: "salesforce",
        confidence: 40,
        matchedOn: "name_substring",
      });
    }
  }

  // ─── m365.users (staff only) ─────────────────────────────────────
  for (const u of m365.users) {
    const fullName = lc(u.displayName);
    const upn = lc(u.userPrincipalName);

    if (wantEmail && upn === wantEmail) {
      pushHit(out, {
        kali_entity_id: u.kali_entity_id,
        name: u.displayName,
        email: u.userPrincipalName,
        source: "m365",
        confidence: 100,
        matchedOn: "email",
      });
      continue;
    }
    if (wantName && fullName === wantName) {
      pushHit(out, {
        kali_entity_id: u.kali_entity_id,
        name: u.displayName,
        email: u.userPrincipalName,
        source: "m365",
        confidence: 80,
        matchedOn: "exact_name",
      });
      continue;
    }
    if (wantName && fullName.includes(wantName)) {
      pushHit(out, {
        kali_entity_id: u.kali_entity_id,
        name: u.displayName,
        email: u.userPrincipalName,
        source: "m365",
        confidence: 40,
        matchedOn: "name_substring",
      });
    }
  }

  // ─── zoom meeting participants ───────────────────────────────────
  // De-dupe by kali_entity_id since the same person may attend N meetings.
  const seen = new Set<string>();
  for (const m of zoom.meetings) {
    for (const p of m.participants) {
      if (seen.has(p.userId)) continue;
      seen.add(p.userId);
      const fullName = lc(p.name);
      const pEmail = lc(p.email ?? "");

      if (wantEmail && pEmail && pEmail === wantEmail) {
        pushHit(out, {
          kali_entity_id: p.userId,
          name: p.name,
          email: p.email,
          source: "zoom",
          confidence: 100,
          matchedOn: "email",
        });
        continue;
      }
      if (wantName && fullName === wantName) {
        pushHit(out, {
          kali_entity_id: p.userId,
          name: p.name,
          email: p.email,
          source: "zoom",
          confidence: 80,
          matchedOn: "exact_name",
        });
        continue;
      }
      if (wantName && fullName.includes(wantName)) {
        pushHit(out, {
          kali_entity_id: p.userId,
          name: p.name,
          email: p.email,
          source: "zoom",
          confidence: 40,
          matchedOn: "name_substring",
        });
      }
    }
  }

  const sorted = Array.from(out.values()).sort((a, b) => {
    if (b.confidence !== a.confidence) return b.confidence - a.confidence;
    return SOURCE_PRIORITY[b.source] - SOURCE_PRIORITY[a.source];
  });
  return { count: sorted.length, hits: sorted.slice(0, limit) };
}

/**
 * Aggregate everything we know about one entity across every connector.
 * Powers the demo "donor dossier" view — one tool call, full picture.
 */
export interface EntityProfile {
  kali_entity_id: string;
  /** Best display name we found across sources. */
  displayName: string | null;
  /** Best email we found. */
  email: string | null;
  /** Best phone. */
  phone: string | null;
  presentIn: ResolverSource[];
  bloomerang: {
    segment: string | null;
    lifetimeGiving: number | null;
    lastGiftDate: string | null;
    engagementLevel: string | null;
  } | null;
  salesforce: {
    isBoard: boolean;
    isMajorDonor: boolean;
    title: string | null;
    employerName: string | null;
    lifetimeGiving: number | null;
    totalGifts: number | null;
  } | null;
  m365: {
    department: string | null;
    jobTitle: string | null;
  } | null;
  zoom: {
    meetingCount: number;
    recentMeetings: { kali_entity_id: string; topic: string; startTime: string }[];
  } | null;
}

export async function entityProfile(
  kaliEntityId: string,
): Promise<EntityProfile | null> {
  const [bloom, sf, m365, zoom] = await Promise.all([
    getBloomerangSeed(),
    getSalesforceSeed(),
    getM365Seed(),
    getZoomSeed(),
  ]);

  const blRow = bloom.constituents.find((c) => c.kali_entity_id === kaliEntityId);
  const sfRow = sf.contacts.find((c) => c.kali_entity_id === kaliEntityId);
  const sfAccount = sfRow?.AccountId
    ? sf.accounts.find((a) => a.Id === sfRow.AccountId) ?? null
    : null;
  const m365Row = m365.users.find((u) => u.kali_entity_id === kaliEntityId);

  const zoomMeetings = zoom.meetings
    .filter((m) => m.participants.some((p) => p.userId === kaliEntityId))
    .sort((a, b) => b.startTime.localeCompare(a.startTime));

  const presentIn: ResolverSource[] = [];
  if (blRow) presentIn.push("bloomerang");
  if (sfRow) presentIn.push("salesforce");
  if (m365Row) presentIn.push("m365");
  if (zoomMeetings.length > 0) presentIn.push("zoom");

  if (presentIn.length === 0) return null;

  const displayName =
    (blRow ? `${blRow.firstName} ${blRow.lastName}`.trim() : null) ??
    (sfRow ? `${sfRow.FirstName} ${sfRow.LastName}`.trim() : null) ??
    m365Row?.displayName ??
    zoomMeetings[0]?.participants.find((p) => p.userId === kaliEntityId)?.name ??
    null;

  const email =
    (blRow?.primaryEmail.value || null) ??
    sfRow?.Email ??
    m365Row?.userPrincipalName ??
    zoomMeetings[0]?.participants.find((p) => p.userId === kaliEntityId)?.email ??
    null;

  const phone =
    blRow?.primaryPhone?.value ?? sfRow?.Phone ?? null;

  return {
    kali_entity_id: kaliEntityId,
    displayName,
    email,
    phone,
    presentIn,
    bloomerang: blRow
      ? {
          segment: blRow.donorSegment,
          lifetimeGiving: blRow.lifetimeGiving,
          lastGiftDate: blRow.lastGiftDate,
          engagementLevel: blRow.engagement.level,
        }
      : null,
    salesforce: sfRow
      ? {
          isBoard: sfRow.npsp__Board_Member__c,
          isMajorDonor: sfRow.npsp__Major_Donor__c,
          title: sfRow.Title,
          employerName: sfAccount?.Name ?? null,
          lifetimeGiving: sfRow.npsp__LifetimeGivingTotal__c,
          totalGifts: sfRow.npsp__TotalGifts__c,
        }
      : null,
    m365: m365Row
      ? {
          department: m365Row.department,
          jobTitle: m365Row.jobTitle ?? null,
        }
      : null,
    zoom:
      zoomMeetings.length > 0
        ? {
            meetingCount: zoomMeetings.length,
            recentMeetings: zoomMeetings.slice(0, 5).map((m) => ({
              kali_entity_id: m.kali_entity_id,
              topic: m.topic,
              startTime: m.startTime,
            })),
          }
        : null,
  };
}
