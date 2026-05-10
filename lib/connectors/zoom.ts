/**
 * Zoom connector — meetings, transcripts, attendees, phone call logs.
 *
 * Powers cross-tool donor intelligence (e.g. "which lapsed donors attended
 * the spring gala") by exposing meeting attendance keyed on `kali_entity_id`.
 * Transcript search lets the agent reach into recorded board meetings,
 * donor strategy sessions, and program reviews to ground answers in actual
 * conversations.
 *
 * Real-OAuth path: Zoom OAuth + REST API + Webhook. Cloud Recording access
 * requires a paid Zoom tier. ~2 weeks for production.
 */

import { z } from "zod";
import type { Connector, ToolDefinition } from "./base";
import { registerConnector } from "./registry";
import { loadSeed, type SeedSize } from "./seed-loader";
import { makeToolFactory } from "./_tool-factory";
import {
  zoomMeetingSchema,
  zoomPhoneCallLogSchema,
  zoomSeedSchema,
  type ZoomMeeting,
  type ZoomSeed,
} from "./zoom.schema";

/* ─── seed access ─────────────────────────────────────────────────────── */

let seedPromise: Promise<ZoomSeed> | null = null;

export async function getZoomSeed(size?: SeedSize): Promise<ZoomSeed> {
  if (!seedPromise) {
    seedPromise = loadSeed("zoom", zoomSeedSchema, size ? { size } : {});
  }
  return seedPromise;
}

export function __resetZoomSeedForTest(): void {
  seedPromise = null;
}

/* ─── pure queries ────────────────────────────────────────────────────── */

const SEARCH_LIMIT = 30;

export interface SearchMeetingsArgs {
  topicContains?: string;
  hostKaliId?: string;
  startDate?: string;
  endDate?: string;
  hasTranscriptOnly?: boolean;
  hasRecordingOnly?: boolean;
  limit?: number;
}

export interface MeetingSummary {
  kali_entity_id: string;
  meetingId: string;
  topic: string;
  startTime: string;
  durationMin: number;
  hostKaliId: string;
  attendeeCount: number;
  attendeeKaliIds: string[];
  hasRecording: boolean;
  hasTranscript: boolean;
}

function toMeetingSummary(m: ZoomMeeting): MeetingSummary {
  return {
    kali_entity_id: m.kali_entity_id,
    meetingId: m.meetingId,
    topic: m.topic,
    startTime: m.startTime,
    durationMin: m.duration,
    hostKaliId: m.hostId,
    attendeeCount: m.participants.length,
    attendeeKaliIds: m.participants.map((p) => p.userId),
    hasRecording: m.recordingFiles.length > 0,
    hasTranscript: m.transcript !== null,
  };
}

export function searchMeetings(
  seed: ZoomSeed,
  args: SearchMeetingsArgs,
): { count: number; meetings: MeetingSummary[] } {
  const limit = Math.min(args.limit ?? SEARCH_LIMIT, 200);
  const out: ZoomMeeting[] = [];
  for (const m of seed.meetings) {
    if (
      args.topicContains &&
      !m.topic.toLowerCase().includes(args.topicContains.toLowerCase())
    )
      continue;
    if (args.hostKaliId && m.hostId !== args.hostKaliId) continue;
    if (args.startDate && m.startTime < args.startDate) continue;
    if (args.endDate && m.startTime > args.endDate) continue;
    if (args.hasTranscriptOnly && m.transcript === null) continue;
    if (args.hasRecordingOnly && m.recordingFiles.length === 0) continue;
    out.push(m);
  }
  return { count: out.length, meetings: out.slice(0, limit).map(toMeetingSummary) };
}

export function getMeeting(
  seed: ZoomSeed,
  kaliEntityId: string,
): ZoomMeeting | null {
  return seed.meetings.find((m) => m.kali_entity_id === kaliEntityId) ?? null;
}

export interface MeetingTranscriptResult {
  kali_entity_id: string;
  topic: string;
  startTime: string;
  vttUrl: string | null;
  text: string | null;
  /** True when there's a transcript record but the text body is null (audio-only). */
  textPending: boolean;
}

export function getMeetingTranscript(
  seed: ZoomSeed,
  kaliEntityId: string,
): MeetingTranscriptResult | null {
  const m = getMeeting(seed, kaliEntityId);
  if (!m) return null;
  if (m.transcript === null) {
    return {
      kali_entity_id: m.kali_entity_id,
      topic: m.topic,
      startTime: m.startTime,
      vttUrl: null,
      text: null,
      textPending: false,
    };
  }
  return {
    kali_entity_id: m.kali_entity_id,
    topic: m.topic,
    startTime: m.startTime,
    vttUrl: m.transcript.vttUrl,
    text: m.transcript.text,
    textPending: m.transcript.text === null,
  };
}

export interface TranscriptSearchHit {
  kali_entity_id: string;
  topic: string;
  startTime: string;
  /** Surrounding context where the query matched. */
  snippet: string;
  matchCount: number;
}

export function searchTranscripts(
  seed: ZoomSeed,
  args: { query: string; limit?: number },
): { count: number; hits: TranscriptSearchHit[] } {
  const limit = Math.min(args.limit ?? 20, 100);
  const q = args.query.toLowerCase();
  const hits: TranscriptSearchHit[] = [];
  for (const m of seed.meetings) {
    if (m.transcript === null || m.transcript.text === null) continue;
    const text = m.transcript.text;
    const lower = text.toLowerCase();
    let idx = lower.indexOf(q);
    if (idx === -1) continue;
    let matchCount = 0;
    while (idx !== -1) {
      matchCount++;
      idx = lower.indexOf(q, idx + q.length);
    }
    const firstIdx = lower.indexOf(q);
    const start = Math.max(0, firstIdx - 80);
    const end = Math.min(text.length, firstIdx + q.length + 80);
    hits.push({
      kali_entity_id: m.kali_entity_id,
      topic: m.topic,
      startTime: m.startTime,
      snippet: (start > 0 ? "…" : "") + text.slice(start, end) + (end < text.length ? "…" : ""),
      matchCount,
    });
  }
  return { count: hits.length, hits: hits.slice(0, limit) };
}

export function getAttendees(
  seed: ZoomSeed,
  kaliEntityId: string,
): { kali_entity_id: string; topic: string; attendees: ZoomMeeting["participants"] } | null {
  const m = getMeeting(seed, kaliEntityId);
  if (!m) return null;
  return {
    kali_entity_id: m.kali_entity_id,
    topic: m.topic,
    attendees: m.participants,
  };
}

export interface AttendanceResult {
  attendeeKaliId: string;
  attendedCount: number;
  meetings: { kali_entity_id: string; topic: string; startTime: string }[];
}

export function getAttendanceForPerson(
  seed: ZoomSeed,
  args: { attendeeKaliId: string; startDate?: string; endDate?: string },
): AttendanceResult {
  const meetings: AttendanceResult["meetings"] = [];
  for (const m of seed.meetings) {
    if (args.startDate && m.startTime < args.startDate) continue;
    if (args.endDate && m.startTime > args.endDate) continue;
    if (m.participants.some((p) => p.userId === args.attendeeKaliId)) {
      meetings.push({ kali_entity_id: m.kali_entity_id, topic: m.topic, startTime: m.startTime });
    }
  }
  return {
    attendeeKaliId: args.attendeeKaliId,
    attendedCount: meetings.length,
    meetings,
  };
}

export function getPhoneCallLogs(
  seed: ZoomSeed,
  args: { startDate?: string; endDate?: string; limit?: number },
) {
  const limit = Math.min(args.limit ?? 100, 1_000);
  let logs = seed.phoneCallLogs;
  if (args.startDate) logs = logs.filter((l) => l.startTime >= args.startDate!);
  if (args.endDate) logs = logs.filter((l) => l.startTime <= args.endDate!);
  return { count: logs.length, calls: logs.slice(0, limit) };
}

/* ─── tool definitions ────────────────────────────────────────────────── */

const meetingSummarySchema = z.object({
  kali_entity_id: z.string(),
  meetingId: z.string(),
  topic: z.string(),
  startTime: z.string(),
  durationMin: z.number(),
  hostKaliId: z.string(),
  attendeeCount: z.number().int().nonnegative(),
  attendeeKaliIds: z.array(z.string()),
  hasRecording: z.boolean(),
  hasTranscript: z.boolean(),
});

const transcriptResultSchema = z.object({
  kali_entity_id: z.string(),
  topic: z.string(),
  startTime: z.string(),
  vttUrl: z.string().nullable(),
  text: z.string().nullable(),
  textPending: z.boolean(),
});

const transcriptHitSchema = z.object({
  kali_entity_id: z.string(),
  topic: z.string(),
  startTime: z.string(),
  snippet: z.string(),
  matchCount: z.number().int().nonnegative(),
});

const attendanceResultSchema = z.object({
  attendeeKaliId: z.string(),
  attendedCount: z.number().int().nonnegative(),
  meetings: z.array(
    z.object({
      kali_entity_id: z.string(),
      topic: z.string(),
      startTime: z.string(),
    }),
  ),
});

const makeTool = makeToolFactory<ZoomSeed>("zoom", getZoomSeed);

const tools: ToolDefinition[] = [
  makeTool({
    name: "zoom.searchMeetings",
    description:
      "Search Zoom meetings. Filter by topic substring, host (kali_entity_id), date range, or whether a recording / transcript exists. Returns meeting summaries with attendee kali_entity_ids — useful for cross-referencing donors who attended events.",
    domain: "comms",
    input: z.object({
      topicContains: z.string().optional(),
      hostKaliId: z.string().optional(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      hasTranscriptOnly: z.boolean().optional(),
      hasRecordingOnly: z.boolean().optional(),
      limit: z.number().int().positive().max(200).optional(),
    }),
    output: z.object({
      count: z.number().int().nonnegative(),
      meetings: z.array(meetingSummarySchema),
    }),
    collectRecordIds: (out) => out.meetings.map((m) => m.kali_entity_id),
    run: (seed, input) => searchMeetings(seed, input),
  }),

  makeTool({
    name: "zoom.getMeeting",
    description:
      "Get a Zoom meeting's full record by kali_entity_id, including the participant list with names + emails.",
    domain: "comms",
    input: z.object({ kali_entity_id: z.string() }),
    output: zoomMeetingSchema.nullable(),
    collectRecordIds: (out) => (out ? [out.kali_entity_id] : []),
    run: (seed, input) => getMeeting(seed, input.kali_entity_id),
  }),

  makeTool({
    name: "zoom.getMeetingTranscript",
    description:
      "Get a Zoom meeting transcript. Returns text + vtt URL when available. `textPending` is true when a transcript exists but text wasn't extracted (audio-only).",
    domain: "comms",
    input: z.object({ kali_entity_id: z.string() }),
    output: transcriptResultSchema.nullable(),
    collectRecordIds: (out) => (out ? [out.kali_entity_id] : []),
    run: (seed, input) => getMeetingTranscript(seed, input.kali_entity_id),
  }),

  makeTool({
    name: "zoom.searchTranscripts",
    description:
      "Full-text search across every Zoom meeting transcript. Returns hits with kali_entity_id, topic, startTime, and a context snippet. Use this to find when something specific was discussed.",
    domain: "comms",
    input: z.object({
      query: z.string().min(1),
      limit: z.number().int().positive().max(100).optional(),
    }),
    output: z.object({
      count: z.number().int().nonnegative(),
      hits: z.array(transcriptHitSchema),
    }),
    collectRecordIds: (out) => out.hits.map((h) => h.kali_entity_id),
    run: (seed, input) => searchTranscripts(seed, input),
  }),

  makeTool({
    name: "zoom.getAttendees",
    description:
      "Get the participant list for one Zoom meeting by kali_entity_id (names + emails + kali_entity_ids).",
    domain: "comms",
    input: z.object({ kali_entity_id: z.string() }),
    output: z
      .object({
        kali_entity_id: z.string(),
        topic: z.string(),
        attendees: z.array(
          z.object({
            userId: z.string(),
            name: z.string(),
            email: z.string().nullable(),
          }),
        ),
      })
      .nullable(),
    collectRecordIds: (out) => (out ? out.attendees.map((a) => a.userId) : []),
    run: (seed, input) => getAttendees(seed, input.kali_entity_id),
  }),

  makeTool({
    name: "zoom.getAttendanceForPerson",
    description:
      "Count and list every Zoom meeting a given person (kali_entity_id) attended in an optional date range. Powers 'this donor attended N events in 2025'.",
    domain: "comms",
    input: z.object({
      attendeeKaliId: z.string(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
    }),
    output: attendanceResultSchema,
    collectRecordIds: (out) => out.meetings.map((m) => m.kali_entity_id),
    run: (seed, input) => getAttendanceForPerson(seed, input),
  }),

  makeTool({
    name: "zoom.getPhoneCallLogs",
    description: "Get Zoom Phone call logs in a date range.",
    domain: "comms",
    input: z.object({
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      limit: z.number().int().positive().max(1_000).optional(),
    }),
    output: z.object({
      count: z.number().int().nonnegative(),
      calls: z.array(zoomPhoneCallLogSchema),
    }),
    collectRecordIds: () => [],
    run: (seed, input) => getPhoneCallLogs(seed, input),
  }),
];

export const zoom: Connector = {
  id: "zoom",
  label: "Zoom",
  domain: "comms",
  tools,
  init: async () => {
    await getZoomSeed();
  },
};

let registered = false;
export function ensureRegistered(): void {
  if (registered) return;
  registerConnector(zoom);
  registered = true;
}

ensureRegistered();
