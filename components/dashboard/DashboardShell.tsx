"use client";

import { StatCards } from "./StatCards";
import { SourcesGrid } from "./SourcesGrid";
import { RecentActivity } from "./RecentActivity";
import { QuickAsk } from "./QuickAsk";
import { Mascot } from "../kawaii/Mascot";
import { StickerLogo } from "../kawaii/StickerLogo";
import { StickerAccent } from "../kawaii/StickerAccent";

interface DashboardShellProps {
  tenantName: string;
  tenantMission?: string;
  selectedConnectors: string[];
  tenantId: string;
}

export function DashboardShell({
  tenantName,
  tenantMission,
  selectedConnectors,
  tenantId,
}: DashboardShellProps) {
  return (
    <div className="kawaii-page">
      <div className="mx-auto max-w-6xl px-4 pt-8 pb-12 sm:px-6 sm:pt-10 sm:pb-16">
        {/* Hero greeting + mascot peek */}
        <header
          style={{
            display: "grid",
            gridTemplateColumns: "1fr auto",
            gap: 24,
            alignItems: "end",
            marginBottom: 32,
          }}
        >
          <div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                marginBottom: 18,
              }}
            >
              <StickerLogo size={84} />
              <span className="kawaii-mono-tag" style={{ color: "var(--mute)" }}>
                · {currentGreetingTime()} ·
              </span>
            </div>
            <h1
              className="kawaii-display"
              style={{
                fontSize: "clamp(36px, 5vw, 56px)",
                lineHeight: 1.0,
                color: "var(--ink)",
                margin: 0,
              }}
            >
              <span style={{ color: "var(--ink)" }}>{tenantName}</span>{" "}
              <span style={{ color: "var(--sakura)", fontStyle: "italic", fontWeight: 600 }}>
                at a glance
              </span>
              <StickerAccent prop="sakura" size={28} tiltDeg={20} style={{ marginLeft: 8 }} />
            </h1>
            {tenantMission && (
              <p
                style={{
                  marginTop: 14,
                  maxWidth: 640,
                  fontSize: 15,
                  lineHeight: 1.55,
                  color: "var(--mute)",
                }}
              >
                {tenantMission}
              </p>
            )}
          </div>
          <div className="hidden md:block" style={{ marginBottom: -8 }}>
            <Mascot pose="read" size={132} tiltDeg={-6} />
          </div>
        </header>

        <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
          <StatCards tenantName={tenantName} />

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(0, 2fr) minmax(0, 3fr)",
              gap: 24,
            }}
            className="dashboard-row"
          >
            <RecentActivity tenantId={tenantId} />
            <SourcesGrid selectedConnectors={selectedConnectors} />
          </div>

          <QuickAsk tenantName={tenantName} />
        </div>
      </div>

      {/* responsive: stack the row on mobile */}
      <style jsx>{`
        @media (max-width: 900px) {
          .dashboard-row {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}

function currentGreetingTime(): string {
  const h = new Date().getHours();
  if (h < 5) return "late night";
  if (h < 12) return "good morning";
  if (h < 17) return "good afternoon";
  if (h < 21) return "good evening";
  return "late night";
}
