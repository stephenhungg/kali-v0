/**
 * Zod schemas for the Zoom connector seed shape. Mirrors Zoom's REST API
 * response shapes (`/users/{userId}/meetings`, `/meetings/{id}/recordings`).
 */

import { z } from "zod";

export const zoomParticipantSchema = z.object({
  userId: z.string(),
  name: z.string(),
  email: z.string().nullable(),
});
export type ZoomParticipant = z.infer<typeof zoomParticipantSchema>;

export const zoomRecordingFileSchema = z.object({
  recordingType: z.string(),
  fileSize: z.number(),
  playUrl: z.string(),
});

export const zoomTranscriptSchema = z.object({
  vttUrl: z.string(),
  text: z.string().nullable(),
});

export const zoomMeetingSchema = z.object({
  meetingId: z.string(),
  kali_entity_id: z.string(),
  hostId: z.string(),
  topic: z.string(),
  startTime: z.string(),
  duration: z.number(),
  type: z.number(),
  participants: z.array(zoomParticipantSchema),
  recordingFiles: z.array(zoomRecordingFileSchema),
  transcript: zoomTranscriptSchema.nullable(),
});
export type ZoomMeeting = z.infer<typeof zoomMeetingSchema>;

export const zoomPhoneCallLogSchema = z.object({
  callId: z.string(),
  direction: z.string(),
  startTime: z.string(),
  durationSec: z.number(),
});
export type ZoomPhoneCallLog = z.infer<typeof zoomPhoneCallLogSchema>;

export const zoomSeedSchema = z.object({
  meetings: z.array(zoomMeetingSchema),
  phoneCallLogs: z.array(zoomPhoneCallLogSchema),
});
export type ZoomSeed = z.infer<typeof zoomSeedSchema>;
