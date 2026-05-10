/**
 * Zod schemas for the Salesforce NPSP connector seed shape.
 *
 * The seed is produced by `lib/seed/project.ts::projectSalesforce`. Real
 * Salesforce Ids are 18-character alphanumerics; we use a stable derivation
 * (`<prefix><kali_id padded>`) so accounts/contacts/opps cross-reference
 * deterministically with the entity graph.
 *
 * NPSP-specific custom fields (prefixed `npsp__`) come from the Nonprofit
 * Success Pack data model and are mapped 1:1 from the entity graph.
 */

import { z } from "zod";

export const accountTypeSchema = z.enum([
  "Corporate",
  "Foundation",
  "Government",
  "Vendor",
  "Partner",
]);
export type AccountType = z.infer<typeof accountTypeSchema>;

export const accountSchema = z.object({
  Id: z.string(),
  kali_entity_id: z.string(),
  Name: z.string(),
  Type: accountTypeSchema,
  Industry: z.string().nullable(),
  npsp__Matching_Gift_Account__c: z.boolean(),
  npsp__Matching_Gift_Annual_Employer_Max__c: z.number().nullable(),
  Description: z.string().nullable(),
});
export type Account = z.infer<typeof accountSchema>;

export const contactSchema = z.object({
  Id: z.string(),
  kali_entity_id: z.string(),
  FirstName: z.string(),
  LastName: z.string(),
  Email: z.string().nullable(),
  Phone: z.string().nullable(),
  AccountId: z.string().nullable(),
  Title: z.string().nullable(),
  npsp__LastDonationDate__c: z.string().nullable(),
  npsp__TotalGifts__c: z.number(),
  npsp__LifetimeGivingTotal__c: z.number(),
  npsp__Soft_Credit_Total__c: z.number(),
  npsp__Board_Member__c: z.boolean(),
  npsp__Major_Donor__c: z.boolean(),
  MailingStreet: z.string(),
  MailingCity: z.string(),
  MailingState: z.string(),
  MailingPostalCode: z.string(),
});
export type Contact = z.infer<typeof contactSchema>;

export const opportunitySchema = z.object({
  Id: z.string(),
  kali_entity_id: z.string(),
  Name: z.string(),
  npsp__Primary_Contact__c: z.string(),
  Amount: z.number(),
  CloseDate: z.string(),
  StageName: z.string(),
  npsp__Type__c: z.string(),
  CampaignId: z.string().nullable(),
  npsp__Matched_By__c: z.string().nullable(),
});
export type Opportunity = z.infer<typeof opportunitySchema>;

export const campaignSchema = z.object({
  Id: z.string(),
  kali_entity_id: z.string(),
  Name: z.string(),
  Type: z.string(),
  StartDate: z.string(),
  EndDate: z.string(),
  ExpectedRevenue: z.number(),
  ActualCost: z.number(),
});
export type Campaign = z.infer<typeof campaignSchema>;

export const salesforceSeedSchema = z.object({
  accounts: z.array(accountSchema),
  contacts: z.array(contactSchema),
  opportunities: z.array(opportunitySchema),
  campaigns: z.array(campaignSchema),
});
export type SalesforceSeed = z.infer<typeof salesforceSeedSchema>;
