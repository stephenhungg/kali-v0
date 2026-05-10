/**
 * Zod schemas for the Microsoft 365 connector seed shape.
 *
 * Fields mirror Microsoft Graph's user/message/calendar shapes loosely (`from`
 * and `toRecipients` use the `emailAddress` wrapper, calendar `start`/`end`
 * carry `dateTime` + `timeZone`, etc.) so the production migration to Graph
 * API is mostly a transport swap.
 */

import { z } from "zod";

export const m365UserSchema = z.object({
  id: z.string(),
  kali_entity_id: z.string(),
  userPrincipalName: z.string(),
  displayName: z.string(),
  jobTitle: z.string().nullable().optional(),
  department: z.string(),
  accountEnabled: z.boolean(),
});
export type M365User = z.infer<typeof m365UserSchema>;

const emailAddressSchema = z.object({
  name: z.string().optional(),
  address: z.string().optional(),
});

export const m365MessageSchema = z.object({
  id: z.string(),
  kali_entity_id: z.string(),
  conversationId: z.string(),
  from: z.object({ emailAddress: emailAddressSchema }),
  toRecipients: z.array(z.object({ emailAddress: emailAddressSchema })),
  subject: z.string(),
  bodyPreview: z.string(),
  receivedDateTime: z.string(),
  hasAttachments: z.boolean(),
  importance: z.string(),
});
export type M365Message = z.infer<typeof m365MessageSchema>;

const dateTimeTzSchema = z.object({
  dateTime: z.string(),
  timeZone: z.string(),
});

export const m365CalendarEventSchema = z.object({
  id: z.string(),
  kali_entity_id: z.string(),
  organizer: z.object({ emailAddress: emailAddressSchema }),
  subject: z.string(),
  start: dateTimeTzSchema,
  end: dateTimeTzSchema,
  attendees: z.array(z.object({ emailAddress: emailAddressSchema })),
  location: z.object({ displayName: z.string() }).nullable(),
});
export type M365CalendarEvent = z.infer<typeof m365CalendarEventSchema>;

export const m365DistributionListSchema = z.object({
  id: z.string(),
  displayName: z.string(),
  members: z.number().int().nonnegative(),
});
export type M365DistributionList = z.infer<typeof m365DistributionListSchema>;

export const m365SeedSchema = z.object({
  users: z.array(m365UserSchema),
  messages: z.array(m365MessageSchema),
  calendars: z.array(m365CalendarEventSchema),
  distributionLists: z.array(m365DistributionListSchema),
});
export type M365Seed = z.infer<typeof m365SeedSchema>;
