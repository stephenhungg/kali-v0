// Projects the canonical EntityGraph into per-connector JSON shapes that
// resemble what each SaaS would return from its own API. Cross-references
// are preserved via the `kali_entity_id` field on every record.

import type { EntityGraph } from "../entities/types.ts";

export function projectAll(g: EntityGraph) {
  return {
    bloomerang: projectBloomerang(g),
    salesforce: projectSalesforce(g),
    sharepoint: projectSharepoint(g),
    m365: projectM365(g),
    powerAutomate: projectPowerAutomate(g),
    powerBI: projectPowerBI(g),
    quickbooks: projectQuickbooks(g),
    instrumentl: projectInstrumentl(g),
    knowbe4: projectKnowBe4(g),
    zoom: projectZoom(g),
    solana: projectSolana(g),
  };
}

// ── Bloomerang ──────────────────────────────────────────────────
function projectBloomerang(g: EntityGraph) {
  const constituents = g.people.filter(p => p.isDonor || p.isProspect).map(p => ({
    constituentId: p.id.replace("ppl_", "bl_"),
    kali_entity_id: p.id,
    type: "individual",
    firstName: p.firstName,
    lastName: p.lastName,
    primaryEmail: { value: p.email, type: "Personal" },
    primaryPhone: p.phone ? { value: p.phone, type: "Mobile" } : null,
    address: p.address,
    employer: p.employer,
    jobTitle: p.jobTitle,
    engagement: { score: Math.min(100, Math.round((p.lifetimeGiving ?? 0) / 100 + (p.donorSegment === "lapsed" ? -30 : 20))), level: p.donorSegment === "major" ? "Engaged Champion" : p.donorSegment === "lapsed" ? "At Risk" : "Active" },
    lifetimeGiving: p.lifetimeGiving ?? 0,
    firstGiftDate: p.firstGiftDate ?? null,
    lastGiftDate: p.lastGiftDate ?? null,
    donorSegment: p.donorSegment,
    customFields: { matchingGiftEligible: !!p.employer, preferredContactMethod: p.email ? "email" : "phone" },
  }));

  const transactions = g.donations.map(d => ({
    transactionId: d.id.replace("don_", "bl_tx_"),
    kali_entity_id: d.id,
    constituentId: d.donorId.replace("ppl_", "bl_"),
    amount: d.amount,
    date: d.date,
    paymentMethod: d.paymentMethod,
    isMatched: d.isMatched ?? false,
    matchedAmount: d.matchedAmount ?? 0,
    campaignId: d.campaignId,
    appealId: d.eventId,
    fundDesignation: d.programDesignation,
    acknowledged: d.acknowledged ?? false,
    thankYouSentDate: d.thankYouSentDate ?? null,
  }));

  const onlineForms = [
    { formId: "bl_form_001", name: "General Donation", url: "https://rivertowncf.bloomerang.co/give", active: true, ytdRaised: Math.round(transactions.filter(t => new Date(t.date).getFullYear() === new Date().getFullYear()).reduce((s, t) => s + t.amount, 0) * 0.4) },
    { formId: "bl_form_002", name: "Year-End Appeal", url: "https://rivertowncf.bloomerang.co/year-end", active: true, ytdRaised: 0 },
    { formId: "bl_form_003", name: "Giving Tuesday", url: "https://rivertowncf.bloomerang.co/giving-tuesday", active: false, ytdRaised: 0 },
    { formId: "bl_form_004", name: "Family Stabilization Emergency Fund", url: "https://rivertowncf.bloomerang.co/family-emergency", active: true, ytdRaised: 0 },
  ];

  return { constituents, transactions, onlineForms };
}

// ── Salesforce NPSP ─────────────────────────────────────────────
function projectSalesforce(g: EntityGraph) {
  const accounts = g.organizations.map(o => ({
    Id: `001${o.id.slice(-15).padStart(15, "0")}`,
    kali_entity_id: o.id,
    Name: o.name,
    Type: o.type === "corporate_sponsor" ? "Corporate" : o.type === "foundation" ? "Foundation" : o.type === "government" ? "Government" : o.type === "vendor" ? "Vendor" : "Partner",
    Industry: o.industry ?? null,
    npsp__Matching_Gift_Account__c: o.hasMatchingGifts ?? false,
    npsp__Matching_Gift_Annual_Employer_Max__c: o.matchingGiftCap ?? null,
    Description: o.fundingFocus ? `Funding focus: ${o.fundingFocus.join(", ")}` : null,
  }));

  const contacts = g.people.filter(p => p.isDonor || p.isBoard || p.isProspect).map(p => ({
    Id: `003${p.id.slice(-15).padStart(15, "0")}`,
    kali_entity_id: p.id,
    FirstName: p.firstName,
    LastName: p.lastName,
    Email: p.email || null,
    Phone: p.phone || null,
    AccountId: p.employer ? `001${p.employer.slice(-15).padStart(15, "0")}` : null,
    Title: p.jobTitle ?? null,
    npsp__LastDonationDate__c: p.lastGiftDate ?? null,
    npsp__TotalGifts__c: g.donations.filter(d => d.donorId === p.id).length,
    npsp__LifetimeGivingTotal__c: p.lifetimeGiving ?? 0,
    npsp__Soft_Credit_Total__c: 0,
    npsp__Board_Member__c: p.isBoard,
    npsp__Major_Donor__c: p.donorSegment === "major",
    MailingStreet: p.address.street, MailingCity: p.address.city, MailingState: p.address.state, MailingPostalCode: p.address.zip,
  }));

  const opportunities = g.donations.map(d => ({
    Id: `006${d.id.slice(-15).padStart(15, "0")}`,
    kali_entity_id: d.id,
    Name: `Gift — ${g.people.find(p => p.id === d.donorId)?.firstName ?? ""} ${g.people.find(p => p.id === d.donorId)?.lastName ?? ""}`,
    npsp__Primary_Contact__c: `003${d.donorId.slice(-15).padStart(15, "0")}`,
    Amount: d.amount,
    CloseDate: d.date,
    StageName: "Posted",
    npsp__Type__c: d.paymentMethod === "in_kind" ? "In-Kind" : "Donation",
    CampaignId: d.campaignId ?? null,
    npsp__Matched_By__c: d.matchingOrgId ? `001${d.matchingOrgId.slice(-15).padStart(15, "0")}` : null,
  }));

  const campaigns = g.campaigns.map(c => ({
    Id: `701${c.id.slice(-15).padStart(15, "0")}`,
    kali_entity_id: c.id,
    Name: c.name,
    Type: c.type,
    StartDate: c.startDate, EndDate: c.endDate,
    ExpectedRevenue: c.goal,
    ActualCost: 0,
  }));

  return { accounts, contacts, opportunities, campaigns };
}

// ── SharePoint ───────────────────────────────────────────────────
function projectSharepoint(g: EntityGraph) {
  const sites = [
    { id: "site_internal", name: "Rivertown Internal", url: "https://rivertowncf.sharepoint.com/sites/internal" },
    { id: "site_board", name: "Board of Directors", url: "https://rivertowncf.sharepoint.com/sites/board" },
    { id: "site_grants", name: "Grants Library", url: "https://rivertowncf.sharepoint.com/sites/grants" },
    { id: "site_programs", name: "Programs", url: "https://rivertowncf.sharepoint.com/sites/programs" },
    { id: "site_finance", name: "Finance", url: "https://rivertowncf.sharepoint.com/sites/finance" },
  ];

  const files = g.documents.map(d => ({
    id: d.id.replace("doc_", "sp_"),
    kali_entity_id: d.id,
    name: d.title + (d.type === "annual_report" ? ".pdf" : ".docx"),
    type: d.type,
    siteId: d.type === "board_minutes" ? "site_board" : d.type === "grant_application" ? "site_grants" : d.type === "financial_statement" ? "site_finance" : d.type === "program_report" ? "site_programs" : "site_internal",
    createdBy: d.authorId,
    createdDateTime: d.createdDate,
    lastModifiedDateTime: d.modifiedDate,
    sizeBytes: d.sizeKb * 1024,
    tags: d.tags,
    body: d.body,
    sharingLinks: d.externalSharing ?? [],
    relatedGrant: d.grantId,
    relatedProgram: d.programId,
  }));

  return { sites, files };
}

// ── M365 ─────────────────────────────────────────────────────────
function projectM365(g: EntityGraph) {
  const staff = g.people.filter(p => p.isStaff);
  const users = staff.map(s => ({
    id: s.id.replace("ppl_", "m365_"),
    kali_entity_id: s.id,
    userPrincipalName: s.email,
    displayName: `${s.firstName} ${s.lastName}`,
    jobTitle: s.staffRole,
    department: s.staffRole?.includes("Develop") ? "Development" : s.staffRole?.includes("Program") ? "Programs" : s.staffRole?.includes("Finance") ? "Finance" : s.staffRole?.includes("Communic") ? "Communications" : "Operations",
    accountEnabled: true,
  }));

  const messages = g.emails.map(e => ({
    id: e.id.replace("eml_", "m365_msg_"),
    kali_entity_id: e.id,
    conversationId: e.threadId,
    from: { emailAddress: { name: g.people.find(p => p.id === e.fromId)?.firstName, address: g.people.find(p => p.id === e.fromId)?.email } },
    toRecipients: e.toIds.map(tid => ({ emailAddress: { address: g.people.find(p => p.id === tid)?.email } })),
    subject: e.subject,
    bodyPreview: e.snippet,
    receivedDateTime: e.date,
    hasAttachments: e.hasAttachment ?? false,
    importance: "normal",
  }));

  const calendars = g.calendarEvents.map(c => ({
    id: c.id.replace("cal_", "m365_cal_"),
    kali_entity_id: c.id,
    organizer: { emailAddress: { address: g.people.find(p => p.id === c.ownerId)?.email } },
    subject: c.title,
    start: { dateTime: c.start, timeZone: "America/Los_Angeles" },
    end: { dateTime: c.end, timeZone: "America/Los_Angeles" },
    attendees: c.attendeeIds.map(aid => ({ emailAddress: { address: g.people.find(p => p.id === aid)?.email } })),
    location: c.location ? { displayName: c.location } : null,
  }));

  const distributionLists = [
    { id: "dl_1", displayName: "All Staff", members: staff.length },
    { id: "dl_2", displayName: "Leadership", members: staff.filter(s => s.staffRole?.includes("Director")).length },
    { id: "dl_3", displayName: "Board", members: g.people.filter(p => p.isBoard).length },
    { id: "dl_4", displayName: "Development Team", members: staff.filter(s => s.staffRole?.includes("Develop") || s.staffRole?.includes("Gift") || s.staffRole?.includes("Grant")).length },
    { id: "dl_5", displayName: "Programs Team", members: staff.filter(s => s.staffRole?.includes("Program")).length },
  ];

  return { users, messages, calendars, distributionLists };
}

// ── Power Automate ──────────────────────────────────────────────
function projectPowerAutomate(g: EntityGraph) {
  return {
    flows: g.powerAutomateFlows.map(f => ({
      flowId: f.id.replace("flow_", "pa_"),
      kali_entity_id: f.id,
      displayName: f.name,
      description: f.description,
      trigger: f.trigger,
      state: f.active ? "Started" : "Stopped",
      createdTime: f.createdDate,
      runs: {
        total: f.runHistory.length,
        succeeded: f.runHistory.filter(r => r.status === "success").length,
        failed: f.runHistory.filter(r => r.status === "failure").length,
        avgDurationMs: Math.round(f.runHistory.reduce((s, r) => s + r.durationMs, 0) / Math.max(1, f.runHistory.length)),
        history: f.runHistory.slice(-20),
      },
      ownerId: f.ownerId,
    })),
  };
}

// ── Power BI ────────────────────────────────────────────────────
function projectPowerBI(g: EntityGraph) {
  return {
    dashboards: g.powerBIDashboards.map(d => ({
      id: d.id.replace("dash_", "pbi_"),
      kali_entity_id: d.id,
      displayName: d.name,
      embedUrl: `https://app.powerbi.com/dashboardEmbed?dashboardId=${d.id}`,
      tiles: d.metrics.map((m, i) => ({
        tileId: `tile_${d.id}_${i}`,
        title: m.name,
        currentValue: m.value,
        previousValue: Math.round(m.value / (1 + m.trendPct)),
        trendPct: m.trendPct,
      })),
    })),
  };
}

// ── QuickBooks ──────────────────────────────────────────────────
function projectQuickbooks(g: EntityGraph) {
  const accounts = [
    { id: "qb_acct_1", name: "Operating Checking", type: "Bank", balance: 1250000 + Math.round(Math.random() * 350000) },
    { id: "qb_acct_2", name: "Restricted Checking", type: "Bank", balance: 480000 },
    { id: "qb_acct_3", name: "Savings", type: "Bank", balance: 1100000 },
    { id: "qb_acct_4", name: "Investments", type: "Other Asset", balance: 2400000 },
    { id: "qb_acct_5", name: "Accounts Receivable", type: "Accounts Receivable", balance: 145000 },
    { id: "qb_acct_6", name: "Accounts Payable", type: "Accounts Payable", balance: -85000 },
  ];
  const transactions = g.qbTransactions.map(t => ({
    id: t.id.replace("qb_", "qb_tx_"),
    kali_entity_id: t.id,
    txnDate: t.date,
    txnType: t.type === "income" ? "Deposit" : t.type === "expense" ? "Bill" : "Transfer",
    accountRef: t.account,
    amount: t.amount,
    category: t.category,
    classRef: t.programId ? g.tenant.programs.find(p => p.id === t.programId)?.name : null,
    vendorRef: t.vendorId,
    memo: t.memo,
  }));
  // P&L last 12 months synthesized from transactions
  const last12 = new Date(); last12.setMonth(last12.getMonth() - 12);
  const pnl = {
    period: "trailing-12-months",
    totalRevenue: g.donations.filter(d => new Date(d.date) >= last12).reduce((s, d) => s + d.amount, 0) + g.grants.filter(gr => gr.amountAwarded && gr.awardedDate && new Date(gr.awardedDate) >= last12).reduce((s, gr) => s + (gr.amountAwarded ?? 0), 0),
    totalExpenses: transactions.filter(t => t.txnType === "Bill" && new Date(t.txnDate) >= last12).reduce((s, t) => s + t.amount, 0),
    netIncome: 0,
  };
  pnl.netIncome = pnl.totalRevenue - pnl.totalExpenses;
  // budget vs actual per program
  const budgetVsActual = g.tenant.programs.map(p => {
    const ytdExpenses = transactions.filter(t => t.classRef === p.name && t.txnType === "Bill").reduce((s, t) => s + t.amount, 0);
    return { programId: p.id, programName: p.name, budgetAnnual: p.budgetAnnual, ytdActual: ytdExpenses, pctExecuted: Math.round((ytdExpenses / p.budgetAnnual) * 100) };
  });
  return { accounts, transactions, pnl, budgetVsActual };
}

// ── Instrumentl ─────────────────────────────────────────────────
function projectInstrumentl(g: EntityGraph) {
  const grants = g.grants.map(gr => {
    const funder = g.organizations.find(o => o.id === gr.funderId);
    const program = g.tenant.programs.find(p => p.id === gr.programId);
    return {
      grantId: gr.id.replace("grant_", "inst_"),
      kali_entity_id: gr.id,
      title: `${funder?.name ?? "Funder"} — ${program?.name ?? "General Operating"} Grant`,
      funderName: funder?.name ?? "Unknown Funder",
      funderId: gr.funderId,
      amountRange: { min: Math.round(gr.amount * 0.8), max: Math.round(gr.amount * 1.2) },
      requestedAmount: gr.amount,
      awardedAmount: gr.amountAwarded ?? null,
      status: gr.status,
      deadline: gr.deadline,
      submittedDate: gr.submittedDate,
      awardedDate: gr.awardedDate,
      reportDueDate: gr.reportDueDate,
      fitScore: gr.fitScore,
      programArea: program?.name,
      fundingFocus: funder?.fundingFocus ?? [],
      notes: gr.notes,
      relatedDocuments: gr.documents,
    };
  });
  const funders = g.organizations.filter(o => o.type === "foundation" || o.type === "government").map(f => ({
    funderId: f.id,
    name: f.name,
    type: f.type,
    fundingFocus: f.fundingFocus ?? [],
    totalGivingPerYearEstimate: Math.round(2_000_000 + Math.random() * 18_000_000),
    typicalGrantSize: Math.round(50_000 + Math.random() * 250_000),
  }));
  return { grants, funders };
}

// ── KnowBe4 ─────────────────────────────────────────────────────
function projectKnowBe4(g: EntityGraph) {
  const userResults = g.knowBe4Results.map(r => {
    const u = g.people.find(p => p.id === r.userId);
    return {
      kbUserId: r.userId.replace("ppl_", "kb_"),
      kali_entity_id: r.userId,
      userName: u ? `${u.firstName} ${u.lastName}` : "Unknown",
      email: u?.email ?? null,
      department: u?.staffRole?.includes("Develop") ? "Development" : u?.staffRole?.includes("Program") ? "Programs" : u?.staffRole?.includes("Finance") ? "Finance" : "Operations",
      riskScore: r.riskScore,
      trainingCompletionPercent: r.trainingCompletionPct,
      phishingTests: r.phishingTests,
      flagged: r.flagged ?? [],
    };
  });
  const orgPosture = {
    overallRisk: Math.round(userResults.reduce((s, u) => s + u.riskScore, 0) / Math.max(1, userResults.length)),
    overallTrainingCompletion: Math.round(userResults.reduce((s, u) => s + u.trainingCompletionPercent, 0) / Math.max(1, userResults.length)),
    flaggedUserCount: userResults.filter(u => (u.flagged?.length ?? 0) > 0).length,
    lastPhishingCampaignDate: new Date(Date.now() - 14 * 86400000).toISOString().slice(0, 10),
  };
  return { userResults, orgPosture };
}

// ── Zoom ───────────────────────────────────────────────────────
function projectZoom(g: EntityGraph) {
  const meetings = g.zoomMeetings.map(z => ({
    meetingId: z.id.replace("zoom_", "zm_"),
    kali_entity_id: z.id,
    hostId: z.hostId,
    topic: z.topic,
    startTime: z.startTime,
    duration: z.durationMin,
    type: 2,
    participants: z.attendeeIds.map(aid => {
      const p = g.people.find(pp => pp.id === aid);
      return { userId: aid, name: p ? `${p.firstName} ${p.lastName}` : "Guest", email: p?.email ?? null };
    }),
    recordingFiles: z.hasRecording ? [{ recordingType: "shared_screen_with_speaker_view", fileSize: Math.round(z.durationMin * 18 * 1024 * 1024), playUrl: `https://us02web.zoom.us/rec/play/${z.id}` }] : [],
    transcript: z.hasTranscript ? { vttUrl: `https://us02web.zoom.us/rec/transcript/${z.id}.vtt`, text: z.transcriptText ?? null } : null,
  }));
  const phoneCallLogs = []; // empty for v1, structure ready
  return { meetings, phoneCallLogs };
}

// ── Solana ─────────────────────────────────────────────────────
function projectSolana(g: EntityGraph) {
  return {
    treasury: {
      walletAddress: "rivertowncf7Hp9YJK8Lm3X2N4P5Q6R7S8T9U0V1W2X3Y",
      balanceUsdc: Math.round(425_000 + Math.random() * 75_000),
      balanceSol: Math.round((4.2 + Math.random() * 0.8) * 100) / 100,
      cluster: "devnet",
      explorerUrl: "https://explorer.solana.com/address/rivertowncf7Hp9YJK8Lm3X2N4P5Q6R7S8T9U0V1W2X3Y?cluster=devnet",
    },
    transactions: g.solanaTxs.map(t => ({
      signature: t.signature,
      kali_entity_id: t.id,
      type: t.type,
      amountUsdc: t.amountUsdc,
      blockTime: Math.floor(new Date(t.date).getTime() / 1000),
      fromWallet: t.fromWallet,
      toWallet: t.toWallet,
      recipientId: t.recipientId,
      reference: t.reference,
      feeLamports: t.feeLamports,
      feeUsd: t.feeLamports * 0.00000003 * 165,
      status: t.status,
      explorerUrl: `https://explorer.solana.com/tx/${t.signature}?cluster=devnet`,
    })),
  };
}
