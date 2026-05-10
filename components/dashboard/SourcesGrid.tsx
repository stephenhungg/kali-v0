"use client";

import { useEffect, useState } from "react";
import { findDisplay, formatRelative, type ConnectorDisplay } from "../../lib/connectors/status";
import { ConnectorDrawer } from "../chat/ConnectorDrawer";
import { CuteCard, CutePill } from "../kawaii/CutePrimitives";

interface BackendSyncEntry {
  connectorId: string;
  label: string;
  status: "never" | "syncing" | "connected" | "error";
  lastSyncAt: string | null;
  lastSuccessAt: string | null;
  recordCount?: number;
  lastError?: string;
}

interface SourcesGridProps {
  selectedConnectors: string[];
}

const TILE_TONE: Record<string, "cloud" | "mochi" | "matcha" | "lemon" | "neutral" | "sakura"> = {
  bloomerang: "mochi",
  salesforce: "matcha",
  m365: "cloud",
  zoom: "cloud",
  sharepoint: "lemon",
  instrumentl: "matcha",
  quickbooks: "matcha",
  solana: "lemon",
  powerbi: "matcha",
  powerautomate: "lemon",
  knowbe4: "sakura",
  x402: "sakura",
  causecoin: "lemon",
  context: "neutral",
};

export function SourcesGrid({ selectedConnectors }: SourcesGridProps) {
  const [backend, setBackend] = useState<BackendSyncEntry[] | null>(null);
  const [activeConnector, setActiveConnector] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/connectors/status")
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((data) => {
        if (alive) setBackend(data.connectors ?? []);
      })
      .catch(() => {
        if (alive) setBackend([]);
      });
    return () => {
      alive = false;
    };
  }, []);

  const tiles =
    backend
      ?.filter(
        (b) => selectedConnectors.length === 0 || selectedConnectors.includes(b.connectorId),
      )
      .map((b) => ({ entry: b, display: findDisplay(b.connectorId) }))
      .filter((t) => t.display) ?? [];

  return (
    <section>
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="kawaii-mono-tag">your sources · {tiles.length} connected</h2>
        <button
          type="button"
          onClick={() => setActiveConnector("mailchimp")}
          className="kawaii-mono-tag"
          style={{
            color: "var(--sakura)",
            background: "transparent",
            border: "none",
            cursor: "pointer",
            padding: 0,
          }}
        >
          + add source
        </button>
      </div>

      {backend === null ? (
        <CuteCard tone="paper">
          <div style={{ fontSize: 12, color: "var(--mute)" }}>loading…</div>
        </CuteCard>
      ) : tiles.length === 0 ? (
        <CuteCard tone="cloud">
          <div style={{ fontSize: 13, color: "var(--ink)", lineHeight: 1.5 }}>
            no sources connected yet.{" "}
            <button
              type="button"
              onClick={() => setActiveConnector("bloomerang")}
              style={{
                color: "var(--sakura)",
                background: "transparent",
                border: "none",
                padding: 0,
                cursor: "pointer",
                textDecoration: "underline",
                textUnderlineOffset: 3,
                fontWeight: 600,
              }}
            >
              add one
            </button>{" "}
            to get started.
          </div>
        </CuteCard>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
            gap: 12,
          }}
        >
          {tiles.map(({ entry, display }, i) => (
            <SourceTile
              key={entry.connectorId}
              entry={entry}
              display={display!}
              onOpen={() => setActiveConnector(entry.connectorId)}
              indexHint={i}
            />
          ))}
        </div>
      )}

      <ConnectorDrawer connectorId={activeConnector} onClose={() => setActiveConnector(null)} />
    </section>
  );
}

function SourceTile({
  entry,
  display,
  onOpen,
  indexHint,
}: {
  entry: BackendSyncEntry;
  display: ConnectorDisplay;
  onOpen: () => void;
  indexHint: number;
}) {
  const isOk = entry.status === "connected";
  const tone = TILE_TONE[entry.connectorId] ?? "neutral";
  return (
    <button
      type="button"
      onClick={onOpen}
      data-connector-id={entry.connectorId}
      className="sticker-pop"
      style={{
        animationDelay: `${indexHint * 40}ms`,
        textAlign: "left",
        background: tilePalette(tone),
        border: "3px solid white",
        borderRadius: 16,
        padding: "12px 14px",
        cursor: "pointer",
        boxShadow: "2px 3px 0 var(--sticker-shadow)",
        transform: "rotate(-0.3deg)",
        transition: "transform 120ms ease",
        display: "flex",
        gap: 10,
        alignItems: "flex-start",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "rotate(0deg) translateY(-1px)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "rotate(-0.3deg)";
      }}
    >
      <span
        style={{
          flexShrink: 0,
          width: 36,
          height: 36,
          borderRadius: 12,
          background: "white",
          border: "2px solid white",
          color: "var(--ink)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: 'var(--font-quicksand), "Quicksand", system-ui, sans-serif',
          fontWeight: 800,
          fontSize: 16,
          boxShadow: "1px 2px 0 var(--sticker-shadow)",
        }}
      >
        {display.monogram}
      </span>
      <span style={{ minWidth: 0, flex: 1 }}>
        <span
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            fontSize: 14,
            fontWeight: 700,
            color: "var(--ink)",
            fontFamily: 'var(--font-quicksand), "Quicksand", system-ui, sans-serif',
          }}
        >
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {display.label}
          </span>
        </span>
        <span style={{ display: "block", fontSize: 11, color: "var(--mute)", marginTop: 2 }}>
          {isOk
            ? `${entry.recordCount?.toLocaleString() ?? "—"} recs · ${formatRelative(
                entry.lastSuccessAt ?? entry.lastSyncAt,
              )}`
            : entry.lastError?.slice(0, 40) ?? "needs setup"}
        </span>
        <span style={{ marginTop: 6, display: "inline-block" }}>
          <CutePill tone={isOk ? "matcha" : "sakura"}>
            {isOk ? "connected" : "needs setup"}
          </CutePill>
        </span>
      </span>
    </button>
  );
}

function tilePalette(
  tone: "cloud" | "mochi" | "matcha" | "lemon" | "neutral" | "sakura",
): string {
  switch (tone) {
    case "cloud":
      return "var(--cloud)";
    case "mochi":
      return "var(--mochi)";
    case "matcha":
      return "var(--matcha-pale)";
    case "lemon":
      return "#F4FAF5";
    case "sakura":
      return "#C5E0CA";
    case "neutral":
    default:
      return "var(--paper)";
  }
}
