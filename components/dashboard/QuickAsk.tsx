"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CuteCard, CuteButton } from "../kawaii/CutePrimitives";
import { Mascot } from "../kawaii/Mascot";

interface QuickAskProps {
  tenantName: string;
}

const SUGGESTIONS = (orgName: string) => [
  `who should i call this week?`,
  `what grants close in 30 days for ${orgName}?`,
  `how's our cash, are we making payroll?`,
  `lapsed donors w/ matching gifts`,
];

export function QuickAsk({ tenantName }: QuickAskProps) {
  const router = useRouter();
  const [draft, setDraft] = useState("");

  const submit = (text?: string) => {
    const q = (text ?? draft).trim();
    if (!q) return;
    router.push(`/chat?seed=${encodeURIComponent(q)}`);
  };

  const orgName = tenantName.split(/\s+/).slice(0, 2).join(" ");

  return (
    <section>
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="kawaii-mono-tag">ask kali</h2>
      </div>

      <CuteCard tone="cloud" style={{ padding: 18 }}>
        <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
          <div style={{ flexShrink: 0 }}>
            <Mascot pose="wave" size={64} tiltDeg={4} />
          </div>
          <div style={{ flex: 1 }}>
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  submit();
                }
              }}
              rows={2}
              placeholder={`ask anything across ${orgName}'s data — donors, grants, finance, programs…`}
              style={{
                width: "100%",
                resize: "none",
                background: "white",
                border: "2px solid white",
                borderRadius: 14,
                padding: "10px 14px",
                fontSize: 14,
                color: "var(--ink)",
                outline: "none",
                boxShadow: "1px 2px 0 var(--sticker-shadow)",
                fontFamily: 'var(--font-quicksand), "Quicksand", "Inter", system-ui, sans-serif',
              }}
            />
            <div
              style={{
                marginTop: 12,
                display: "flex",
                flexWrap: "wrap",
                gap: 8,
                alignItems: "center",
              }}
            >
              {SUGGESTIONS(orgName).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => submit(s)}
                  style={{
                    background: "white",
                    border: "2px solid white",
                    borderRadius: 999,
                    padding: "6px 14px",
                    fontSize: 12,
                    fontWeight: 600,
                    color: "var(--ink)",
                    cursor: "pointer",
                    boxShadow: "1px 2px 0 var(--sticker-shadow)",
                    fontFamily: 'var(--font-quicksand), "Quicksand", "Inter", system-ui, sans-serif',
                  }}
                >
                  {s}
                </button>
              ))}
              <div style={{ marginLeft: "auto" }}>
                <CuteButton onClick={() => submit()} disabled={!draft.trim()} size="sm">
                  ask ↵
                </CuteButton>
              </div>
            </div>
          </div>
        </div>
      </CuteCard>
    </section>
  );
}
