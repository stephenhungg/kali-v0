"use client";

import { useMemo } from "react";

interface RecentActivityProps {
  /** Used to seed the deterministic forged feed so it's stable per-tenant. */
  seed: string;
}

const TEMPLATES: Array<{ kind: string; tmpl: (n: number) => string; minsAgo: [number, number] }> = [
  { kind: "sync", tmpl: n => `Bloomerang sync · ${n} new donations`, minsAgo: [2, 8] },
  { kind: "agent", tmpl: () => `Sarah asked: "who should I call this week?"`, minsAgo: [12, 22] },
  { kind: "sync", tmpl: n => `Salesforce sync · ${n} contacts updated`, minsAgo: [28, 44] },
  { kind: "alert", tmpl: () => `2 grants close in the next 14 days · Open Society Foundation tops fit`, minsAgo: [62, 90] },
  { kind: "agent", tmpl: () => `Marcus asked: "what's my cash runway?"`, minsAgo: [110, 160] },
  { kind: "sync", tmpl: n => `M365 indexed ${n} new emails`, minsAgo: [200, 280] },
  { kind: "alert", tmpl: () => `Donor anomaly: 3 lapsed donors > $5K reactivated this week`, minsAgo: [340, 420] },
  { kind: "agent", tmpl: () => `Priya exported a donor list (314 records)`, minsAgo: [520, 620] },
];

const ICON_BY_KIND: Record<string, string> = {
  sync: "↻",
  agent: "·",
  alert: "!",
};

const ACCENT_BY_KIND: Record<string, string> = {
  sync: "var(--matcha-mid)",
  agent: "var(--matcha-deep)",
  alert: "var(--strawberry-deep)",
};

function djb2(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function RecentActivity({ seed }: RecentActivityProps) {
  const items = useMemo(() => {
    const seedNum = djb2(seed || "default");
    return TEMPLATES.map((t, i) => {
      const span = t.minsAgo[1] - t.minsAgo[0];
      const mins = t.minsAgo[0] + ((seedNum >> i) % span);
      // Numeric value for templates that need it (e.g. donations count).
      const n = ((seedNum >> (i + 5)) % 28) + 4;
      return {
        id: `act_${i}`,
        kind: t.kind,
        text: t.tmpl(n),
        timeAgo: minsAgoLabel(mins),
      };
    });
  }, [seed]);

  return (
    <section>
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--gray-ink)]">
          recent activity
        </h2>
      </div>
      <ul className="chat-card divide-y divide-[var(--mint-line-soft)] rounded">
        {items.map(item => (
          <li key={item.id} className="flex items-start gap-3 px-3 py-2.5">
            <span
              className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full font-mono text-[10px] font-medium"
              style={{ background: "var(--mint-pale)", color: ACCENT_BY_KIND[item.kind] }}
            >
              {ICON_BY_KIND[item.kind]}
            </span>
            <span className="min-w-0 flex-1 text-[13px] leading-snug text-[var(--matcha-deep)]">
              {item.text}
            </span>
            <span className="shrink-0 font-mono text-[10px] text-[var(--gray-ink)]">
              {item.timeAgo}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function minsAgoLabel(m: number): string {
  if (m < 60) return `${m}m ago`;
  if (m < 60 * 24) return `${Math.round(m / 60)}h ago`;
  return `${Math.round(m / 60 / 24)}d ago`;
}
