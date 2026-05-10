"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface QuickAskProps {
  tenantName: string;
}

const SUGGESTIONS = (orgName: string) => [
  `Who should I call this week?`,
  `What grants close in the next 30 days for ${orgName}?`,
  `Where's our cash, are we gonna make payroll?`,
  `Show me lapsed donors with matching gifts`,
];

export function QuickAsk({ tenantName }: QuickAskProps) {
  const router = useRouter();
  const [draft, setDraft] = useState("");

  const submit = (text?: string) => {
    const q = (text ?? draft).trim();
    if (!q) return;
    router.push(`/chat?seed=${encodeURIComponent(q)}`);
  };

  const orgName = tenantName.split(/\s+/).slice(0, 2).join(" "); // first two words for brevity

  return (
    <section>
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--gray-ink)]">
          ask kali
        </h2>
      </div>

      <div className="chat-card flex items-end gap-2 rounded p-3">
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
          placeholder={`Ask anything across ${orgName}'s data — donors, grants, finance, programs…`}
          className="max-h-[120px] flex-1 resize-none bg-transparent font-sans text-[15px] text-[var(--matcha-deep)] outline-none placeholder:text-[var(--gray-ink)]"
        />
        <button
          type="button"
          onClick={() => submit()}
          disabled={!draft.trim()}
          className="shrink-0 rounded bg-[var(--matcha-deep)] px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.12em] text-[var(--cream)] transition-transform hover:scale-[1.02] disabled:opacity-40"
        >
          ask ↵
        </button>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {SUGGESTIONS(orgName).map(s => (
          <button
            key={s}
            type="button"
            onClick={() => submit(s)}
            className="rounded-full border border-[var(--mint-line)] bg-[var(--surface)] px-3 py-1.5 text-[12px] text-[var(--matcha-deep)] transition-colors hover:border-[var(--matcha-mid)] hover:bg-[var(--mint-pale)]"
          >
            {s}
          </button>
        ))}
      </div>
    </section>
  );
}
