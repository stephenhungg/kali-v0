"use client";

import { StatCards } from "./StatCards";
import { SourcesGrid } from "./SourcesGrid";
import { RecentActivity } from "./RecentActivity";
import { QuickAsk } from "./QuickAsk";

interface DashboardShellProps {
  tenantName: string;
  tenantMission?: string;
  selectedConnectors: string[];
  /** Stable id for seeding the forged activity feed. */
  seedId: string;
}

export function DashboardShell({ tenantName, tenantMission, selectedConnectors, seedId }: DashboardShellProps) {
  const firstName = tenantName.split(/\s+/)[0];

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      {/* Hero greeting */}
      <header className="mb-8 flex flex-col gap-2">
        <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--gray-ink)]">
          welcome back · {currentGreetingTime()}
        </span>
        <h1 className="r-display text-[40px] font-medium leading-[0.95] tracking-tight text-[var(--matcha-deep)] sm:text-[56px]">
          {tenantName}{" "}
          <span className="r-italic font-light text-[var(--matcha-mid)]">at a glance.</span>
        </h1>
        {tenantMission && (
          <p className="max-w-2xl text-[14px] leading-relaxed text-[var(--matcha-deep)]/70">
            {tenantMission}
          </p>
        )}
      </header>

      <div className="flex flex-col gap-8">
        <StatCards tenantName={tenantName} />

        <div className="grid gap-6 lg:grid-cols-[2fr_3fr]">
          <RecentActivity seed={seedId} />
          <SourcesGrid selectedConnectors={selectedConnectors} />
        </div>

        <QuickAsk tenantName={tenantName} />
      </div>
    </div>
  );
}

function currentGreetingTime(): string {
  const h = new Date().getHours();
  if (h < 5) return "late night";
  if (h < 12) return "morning";
  if (h < 17) return "afternoon";
  if (h < 21) return "evening";
  return "night";
}
