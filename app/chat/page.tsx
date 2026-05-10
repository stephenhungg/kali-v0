"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ChatTranscript } from "../../components/chat/ChatTranscript";
import { Composer } from "../../components/chat/Composer";
import { ConnectorDrawer } from "../../components/chat/ConnectorDrawer";
import { ConnectorMenu } from "../../components/chat/ConnectorMenu";
import { EmptyState } from "../../components/chat/EmptyState";
import { ReceiptsPanel } from "../../components/chat/ReceiptsPanel";
import { useAgentStream } from "../../hooks/useAgentStream";

export default function ChatPage() {
  // useSearchParams requires a Suspense boundary during prerender.
  return (
    <Suspense fallback={<div className="p-8 text-[var(--gray-ink)]">loading…</div>}>
      <ChatPageBody />
    </Suspense>
  );
}

function ChatPageBody() {
  const { messages, streaming, pulse, send, stop } = useAgentStream();
  const [draft, setDraft] = useState("");
  const [activeConnector, setActiveConnector] = useState<string | null>(null);

  const [showSourcesOnMobile, setShowSourcesOnMobile] = useState(false);
  const [showReceiptsOnMobile, setShowReceiptsOnMobile] = useState(false);

  // Auto-fire a query passed via ?seed= (used by Dashboard QuickAsk).
  const sp = useSearchParams();
  const seedFiredRef = useRef(false);
  useEffect(() => {
    if (seedFiredRef.current) return;
    const seed = sp.get("seed");
    if (seed && seed.trim().length > 0) {
      seedFiredRef.current = true;
      send(seed);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sp]);

  const submit = () => {
    const text = draft.trim();
    if (!text) return;
    send(text);
    setDraft("");
  };

  const pickPlaybook = (text: string) => {
    setDraft("");
    send(text);
  };

  // Citation chip clicks — for v0, just opens the connector drawer matching
  // the kali_entity_id prefix (ppl/org → donor crm; doc → sharepoint; etc.)
  const onActivateCitation = (kaliId: string) => {
    const prefix = kaliId.split("_")[0];
    const map: Record<string, string> = {
      ppl: "bloomerang", org: "salesforce", don: "bloomerang",
      grant: "instrumentl", doc: "sharepoint", eml: "m365",
      zoom: "zoom", flow: "powerautomate",
    };
    const id = map[prefix];
    if (id) setActiveConnector(id);
  };

  const empty = messages.length === 0;

  return (
    <div className="flex h-[calc(100dvh-64px)] flex-col">
      <div className="flex items-center justify-between gap-2 border-b border-[var(--mint-line)] bg-[var(--surface)] px-4 py-2 lg:hidden">
        <button
          type="button"
          onClick={() => setShowSourcesOnMobile(true)}
          className="rounded-full border border-[var(--mint-line)] bg-[var(--surface)] px-3 py-1.5 text-[11px] text-[var(--matcha-deep)]"
        >
          Sources
        </button>
        <button
          type="button"
          onClick={() => setShowReceiptsOnMobile(v => !v)}
          className="rounded-full border border-[var(--mint-line)] bg-[var(--surface)] px-3 py-1.5 text-[11px] text-[var(--matcha-deep)]"
        >
          {showReceiptsOnMobile ? "hide receipts" : "show receipts"}
        </button>
      </div>

      <div className="grid flex-1 grid-cols-1 overflow-hidden lg:grid-cols-[280px_minmax(0,1fr)_360px]">
        <div className="hidden lg:block">
          <ConnectorMenu pulse={pulse} onOpenConnector={setActiveConnector} />
        </div>

        <main className="flex min-w-0 flex-col overflow-hidden">
          <div className="flex-1 overflow-hidden">
            {empty ? (
              <div className="h-full overflow-y-auto">
                <EmptyState onPick={pickPlaybook} />
              </div>
            ) : (
              <ChatTranscript messages={messages} onActivateCitation={onActivateCitation} />
            )}
          </div>

          {showReceiptsOnMobile && (
            <div className="border-t border-[var(--mint-line)] lg:hidden">
              <div className="max-h-[40vh] overflow-y-auto">
                <ReceiptsPanel messages={messages} onActivateCitation={onActivateCitation} />
              </div>
            </div>
          )}

          <Composer
            value={draft}
            onChange={setDraft}
            onSubmit={submit}
            onStop={stop}
            streaming={streaming}
          />
        </main>

        <div className="hidden border-l border-[var(--mint-line)] lg:block">
          <ReceiptsPanel messages={messages} onActivateCitation={onActivateCitation} />
        </div>
      </div>

      {showSourcesOnMobile && (
        <MobileSourcesSheet
          onClose={() => setShowSourcesOnMobile(false)}
          pulse={pulse}
          onOpenConnector={(id) => { setShowSourcesOnMobile(false); setActiveConnector(id); }}
        />
      )}

      <ConnectorDrawer connectorId={activeConnector} onClose={() => setActiveConnector(null)} />
    </div>
  );
}

function MobileSourcesSheet({
  onClose,
  pulse,
  onOpenConnector,
}: {
  onClose: () => void;
  pulse: ReturnType<typeof useAgentStream>["pulse"];
  onOpenConnector: (id: string) => void;
}) {
  return (
    <div className="fixed inset-0 z-30 flex flex-col">
      <div className="absolute inset-0 bg-[var(--matcha-deep)]/30 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <div className="relative ml-auto h-full w-full max-w-sm bg-[var(--surface)]">
        <div className="flex items-center justify-between border-b border-[var(--mint-line)] px-4 py-3">
          <h2 className="r-display text-[20px] font-medium tracking-tight text-[var(--matcha-deep)]">Sources</h2>
          <button type="button" onClick={onClose} className="font-mono text-[11px] text-[var(--gray-ink)] hover:text-[var(--matcha-deep)]">close</button>
        </div>
        <div className="h-[calc(100%-56px)]">
          <ConnectorMenu pulse={pulse} onOpenConnector={onOpenConnector} />
        </div>
      </div>
    </div>
  );
}
