/**
 * Tests for the Zoom connector against the medium fixture.
 */

import { describe, expect, test, beforeAll } from "bun:test";
import {
  zoomMeetingSchema,
  zoomParticipantSchema,
} from "./zoom.schema";
import {
  getAttendanceForPerson,
  getAttendees,
  getMeeting,
  getMeetingTranscript,
  getPhoneCallLogs,
  getZoomSeed,
  searchMeetings,
  searchTranscripts,
  zoom,
  __resetZoomSeedForTest,
} from "./zoom";
import { listConnectors, listTools } from "./registry";
import { resetSeedCache } from "./seed-loader";
import { makeCapturingContext } from "./test-helpers";
import type { ZoomSeed } from "./zoom.schema";

let seed: ZoomSeed;

beforeAll(async () => {
  seed = await getZoomSeed();
});

describe("zoom.schema", () => {
  test("medium fixture parses against the seed schema", () => {
    expect(seed.meetings.length).toBeGreaterThan(0);
  });

  test("medium fixture has the expected aggregate shape", () => {
    expect(seed.meetings.length).toBe(60);
    expect(seed.phoneCallLogs.length).toBe(0);
  });

  test("schemas accept individual rows", () => {
    expect(() => zoomMeetingSchema.parse(seed.meetings[0])).not.toThrow();
    expect(() => zoomParticipantSchema.parse(seed.meetings[0].participants[0])).not.toThrow();
  });

  test("transcript can be null on a meeting without one", () => {
    expect(seed.meetings.some((m) => m.transcript === null)).toBe(true);
  });

  test("transcript.text can be null even when transcript exists (audio-only)", () => {
    expect(
      seed.meetings.some((m) => m.transcript !== null && m.transcript.text === null),
    ).toBe(true);
  });
});

describe("searchMeetings", () => {
  test("filters by topicContains (case insensitive)", () => {
    const target = seed.meetings[0];
    const fragment = target.topic.split(" ")[0]!;
    const r = searchMeetings(seed, { topicContains: fragment.toUpperCase(), limit: 200 });
    expect(r.count).toBeGreaterThan(0);
    for (const m of r.meetings)
      expect(m.topic.toLowerCase().includes(fragment.toLowerCase())).toBe(true);
  });

  test("filters by hostKaliId", () => {
    const host = seed.meetings[0].hostId;
    const r = searchMeetings(seed, { hostKaliId: host, limit: 200 });
    for (const m of r.meetings) expect(m.hostKaliId).toBe(host);
  });

  test("date range narrows results", () => {
    const r = searchMeetings(seed, { startDate: "2025-06-01", endDate: "2026-12-31", limit: 200 });
    for (const m of r.meetings) {
      expect(m.startTime >= "2025-06-01").toBe(true);
      expect(m.startTime <= "2026-12-31").toBe(true);
    }
  });

  test("hasTranscriptOnly only includes meetings with a transcript", () => {
    const r = searchMeetings(seed, { hasTranscriptOnly: true, limit: 200 });
    for (const m of r.meetings) expect(m.hasTranscript).toBe(true);
  });

  test("hasRecordingOnly only includes meetings with a recording", () => {
    const r = searchMeetings(seed, { hasRecordingOnly: true, limit: 200 });
    for (const m of r.meetings) expect(m.hasRecording).toBe(true);
  });
});

describe("getMeeting", () => {
  test("returns the matching meeting", () => {
    const target = seed.meetings[2];
    const r = getMeeting(seed, target.kali_entity_id);
    expect(r).not.toBeNull();
    expect(r!.kali_entity_id).toBe(target.kali_entity_id);
  });

  test("returns null for unknown id", () => {
    expect(getMeeting(seed, "zoom_nope")).toBeNull();
  });
});

describe("getMeetingTranscript", () => {
  test("returns full transcript when text exists", () => {
    const m = seed.meetings.find(
      (x) => x.transcript !== null && x.transcript.text !== null,
    )!;
    const r = getMeetingTranscript(seed, m.kali_entity_id);
    expect(r).not.toBeNull();
    expect(r!.text).toBe(m.transcript!.text);
    expect(r!.textPending).toBe(false);
  });

  test("returns textPending=true when transcript exists without text", () => {
    const m = seed.meetings.find(
      (x) => x.transcript !== null && x.transcript.text === null,
    )!;
    const r = getMeetingTranscript(seed, m.kali_entity_id);
    expect(r!.text).toBeNull();
    expect(r!.textPending).toBe(true);
    expect(r!.vttUrl).not.toBeNull();
  });

  test("returns null for unknown meeting", () => {
    expect(getMeetingTranscript(seed, "zoom_nope")).toBeNull();
  });

  test("meeting without any transcript returns object with vttUrl=null and textPending=false", () => {
    const m = seed.meetings.find((x) => x.transcript === null)!;
    const r = getMeetingTranscript(seed, m.kali_entity_id);
    expect(r).not.toBeNull();
    expect(r!.vttUrl).toBeNull();
    expect(r!.text).toBeNull();
    expect(r!.textPending).toBe(false);
  });
});

describe("searchTranscripts", () => {
  test("finds a known word in the transcript corpus", () => {
    const m = seed.meetings.find(
      (x) => x.transcript !== null && x.transcript.text !== null,
    )!;
    const word = m.transcript!.text!.split(/\s+/)[0]!.replace(/[^a-zA-Z]/g, "");
    if (!word) return; // word boundary edge case
    const r = searchTranscripts(seed, { query: word });
    expect(r.count).toBeGreaterThan(0);
    expect(r.hits.some((h) => h.kali_entity_id === m.kali_entity_id)).toBe(true);
  });

  test("snippet includes the matched query", () => {
    const m = seed.meetings.find(
      (x) => x.transcript !== null && x.transcript.text !== null,
    )!;
    const word = m.transcript!.text!.split(/\s+/)[0]!.replace(/[^a-zA-Z]/g, "");
    if (!word) return;
    const r = searchTranscripts(seed, { query: word });
    for (const h of r.hits)
      expect(h.snippet.toLowerCase()).toContain(word.toLowerCase());
  });

  test("unknown query yields zero hits", () => {
    const r = searchTranscripts(seed, { query: "xyzzy_nonsense_token_qqq" });
    expect(r.count).toBe(0);
  });

  test("limit caps the hit list", () => {
    const r = searchTranscripts(seed, { query: "a", limit: 2 });
    expect(r.hits.length).toBeLessThanOrEqual(2);
  });
});

describe("getAttendees", () => {
  test("returns the participant list for a known meeting", () => {
    const m = seed.meetings[0];
    const r = getAttendees(seed, m.kali_entity_id);
    expect(r).not.toBeNull();
    expect(r!.attendees.length).toBe(m.participants.length);
  });

  test("returns null for unknown meeting", () => {
    expect(getAttendees(seed, "zoom_nope")).toBeNull();
  });
});

describe("getAttendanceForPerson", () => {
  test("counts the meetings someone attended", () => {
    const personKali = seed.meetings[0].participants[0].userId;
    const r = getAttendanceForPerson(seed, { attendeeKaliId: personKali });
    expect(r.attendedCount).toBeGreaterThan(0);
    for (const m of r.meetings) {
      const meeting = seed.meetings.find((x) => x.kali_entity_id === m.kali_entity_id)!;
      expect(meeting.participants.some((p) => p.userId === personKali)).toBe(true);
    }
  });

  test("date range narrows attendance count", () => {
    const personKali = seed.meetings[0].participants[0].userId;
    const r = getAttendanceForPerson(seed, {
      attendeeKaliId: personKali,
      startDate: "2026-01-01",
    });
    for (const m of r.meetings) expect(m.startTime >= "2026-01-01").toBe(true);
  });

  test("unknown person → 0 attendance", () => {
    const r = getAttendanceForPerson(seed, { attendeeKaliId: "ppl_nope" });
    expect(r.attendedCount).toBe(0);
  });
});

describe("getPhoneCallLogs", () => {
  test("returns empty in the medium seed (no phone data yet)", () => {
    const r = getPhoneCallLogs(seed, {});
    expect(r.count).toBe(0);
  });
});

describe("Connector / registry integration", () => {
  test("zoom registered itself", () => {
    expect(listConnectors().some((c) => c.id === "zoom")).toBe(true);
  });

  test("exposes all expected tools", () => {
    const names = zoom.tools.map((t) => t.name).sort();
    expect(names).toEqual(
      [
        "zoom.getAttendanceForPerson",
        "zoom.getAttendees",
        "zoom.getMeeting",
        "zoom.getMeetingTranscript",
        "zoom.getPhoneCallLogs",
        "zoom.searchMeetings",
        "zoom.searchTranscripts",
      ].sort(),
    );
  });

  test("listTools() includes every zoom tool", () => {
    const all = listTools().map((t) => t.name);
    for (const t of zoom.tools) expect(all).toContain(t.name);
  });

  test("init is idempotent", async () => {
    await zoom.init!();
    await zoom.init!();
  });
});

describe("Tool handlers (audit)", () => {
  test("searchMeetings handler audits", async () => {
    const tool = zoom.tools.find((t) => t.name === "zoom.searchMeetings")!;
    const ctx = makeCapturingContext();
    const out = (await tool.handler(
      { hasTranscriptOnly: true, limit: 5 },
      ctx,
    )) as { meetings: { kali_entity_id: string; hasTranscript: boolean }[] };
    expect(out.meetings.length).toBeLessThanOrEqual(5);
    for (const m of out.meetings) expect(m.hasTranscript).toBe(true);
    expect(ctx.entries[0].source).toBe("zoom");
    expect(ctx.entries[0].toolName).toBe("zoom.searchMeetings");
    expect(ctx.entries[0].recordIds).toEqual(out.meetings.map((m) => m.kali_entity_id));
  });

  test("invalid input rejected by zod", () => {
    const tool = zoom.tools.find((t) => t.name === "zoom.searchTranscripts")!;
    expect(() => tool.input.parse({ query: "" })).toThrow();
  });
});

describe("__resetZoomSeedForTest", () => {
  test("forces a fresh load", async () => {
    __resetZoomSeedForTest();
    resetSeedCache();
    const fresh = await getZoomSeed();
    expect(fresh.meetings.length).toBeGreaterThan(0);
  });
});
