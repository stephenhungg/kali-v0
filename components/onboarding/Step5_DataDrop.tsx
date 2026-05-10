"use client";

import { useCallback, useState } from "react";
import type { StepProps } from "./OnboardingShell";
import type { UploadRecord } from "../../lib/supabase/types";
import { fakeIngestStats, type FakeIngestStats } from "../../lib/onboarding/fake-ingestion";
import { SidebarNote } from "./Step1_Signup";

interface FileRow {
  id: string;
  file: File;
  status: "queued" | "uploading" | "indexed" | "error";
  progress: number; // 0-1
  stats?: FakeIngestStats;
  errorMsg?: string;
}

export function Step5DataDrop({ state, setState, next, back, skip }: StepProps) {
  const [rows, setRows] = useState<FileRow[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [busy, setBusy] = useState(false);

  const ingestFile = useCallback(async (file: File) => {
    const id = `r_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`;
    const stats = fakeIngestStats({ name: file.name, size: file.size, type: file.type });
    setRows(prev => [...prev, { id, file, status: "uploading", progress: 0, stats }]);

    // Animate progress 0 → 1 over stats.durationMs while we upload.
    const start = Date.now();
    const tick = () => {
      const elapsed = Date.now() - start;
      const pct = Math.min(1, elapsed / stats.durationMs);
      setRows(prev => prev.map(r => r.id === id ? { ...r, progress: pct } : r));
      if (pct < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);

    // Real fetch (theater on the server too — file content discarded).
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/onboarding/upload", { method: "POST", body: fd });
      if (!res.ok) throw new Error(`server ${res.status}`);
      const data = await res.json();
      // Server re-issues stats from filename hash; trust those if present.
      const finalStats: FakeIngestStats = data.stats ?? stats;
      const record: UploadRecord = data.record;
      // Wait at least durationMs before flipping to "indexed" so the bar finishes.
      const remain = Math.max(0, stats.durationMs - (Date.now() - start));
      setTimeout(() => {
        setRows(prev => prev.map(r => r.id === id ? { ...r, status: "indexed", progress: 1, stats: finalStats } : r));
      }, remain);
      return record;
    } catch (e: any) {
      setRows(prev => prev.map(r => r.id === id ? { ...r, status: "error", errorMsg: e?.message ?? "upload failed" } : r));
      return null;
    }
  }, []);

  const onFiles = useCallback((files: FileList | File[]) => {
    Array.from(files).forEach(ingestFile);
  }, [ingestFile]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer?.files?.length) onFiles(e.dataTransfer.files);
  }, [onFiles]);

  const advance = async () => {
    setBusy(true);
    await next();
  };

  const totalRecords = rows.filter(r => r.status === "indexed").reduce((s, r) => s + (r.stats?.recordsExtracted ?? 0), 0);
  const stillUploading = rows.some(r => r.status === "uploading" || r.status === "queued");

  return (
    <div className="grid gap-8 sm:grid-cols-[1fr_240px]">
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--gray-ink)]">
            drop your historical data
          </span>
          <h1 className="r-display text-[36px] font-medium leading-[0.95] tracking-tight text-[var(--matcha-deep)] sm:text-[44px]">
            Drop your last 990, donor exports, board minutes —{" "}
            <span className="r-italic font-light text-[var(--matcha-mid)]">we'll index it.</span>
          </h1>
          <p className="text-[14px] leading-relaxed text-[var(--matcha-deep)]/70">
            CSV, PDF, XLSX, anything. We extract entities, resolve duplicates, embed for semantic search. {totalRecords > 0 ? `${totalRecords.toLocaleString()} records indexed so far.` : "No files yet — drop one or skip to use the demo data."}
          </p>
        </div>

        <label
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          className={`flex flex-col items-center justify-center gap-2 rounded border-2 border-dashed p-8 text-center transition-colors ${
            dragOver
              ? "border-[var(--matcha-mid)] bg-[var(--mint-pale)]"
              : "border-[var(--mint-line)] bg-[var(--surface-raised)] hover:border-[var(--matcha-mid)]"
          }`}
        >
          <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--matcha-mid)]">
            drag files here
          </span>
          <span className="text-[14px] text-[var(--matcha-deep)]">
            or click to browse
          </span>
          <span className="font-mono text-[10px] text-[var(--gray-ink)]">
            CSV · PDF · XLSX · DOCX · QBO · up to 50MB each
          </span>
          <input
            type="file"
            multiple
            accept=".csv,.pdf,.xlsx,.xls,.docx,.doc,.qbo,.txt,.json"
            onChange={(e) => e.target.files && onFiles(e.target.files)}
            className="hidden"
          />
        </label>

        {rows.length > 0 && (
          <ul className="flex flex-col gap-2">
            {rows.map(r => (
              <FileRowView key={r.id} row={r} />
            ))}
          </ul>
        )}

        <div className="mt-3 flex items-center justify-between">
          <button
            type="button"
            onClick={back}
            className="font-mono text-[11px] text-[var(--gray-ink)] hover:text-[var(--matcha-deep)]"
          >
            ← back
          </button>
          <div className="flex items-center gap-3">
            {rows.length === 0 && (
              <button
                type="button"
                onClick={skip}
                className="font-mono text-[11px] text-[var(--gray-ink)] underline-offset-2 hover:text-[var(--matcha-deep)] hover:underline"
              >
                skip — use demo data
              </button>
            )}
            <button
              type="button"
              onClick={advance}
              disabled={busy || stillUploading}
              className="rounded bg-[var(--matcha-deep)] px-5 py-2.5 font-mono text-[12px] uppercase tracking-[0.14em] text-[var(--cream)] transition-transform hover:scale-[1.02] disabled:opacity-40"
            >
              {busy ? "saving…" : stillUploading ? "indexing…" : "continue →"}
            </button>
          </div>
        </div>
      </div>

      <SidebarNote
        title="What we extract"
        body="Donors, donations, grants, programs, board members, vendors, partner orgs — plus the relationships between them. PDFs become searchable chunks. Spreadsheets become rows. We never write back."
      />
    </div>
  );
}

function FileRowView({ row }: { row: FileRow }) {
  return (
    <li className="row-rise flex items-center gap-3 rounded border border-[var(--mint-line)] bg-[var(--surface)] px-3 py-2.5">
      <span
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded font-mono text-[10px] font-medium uppercase"
        style={{ background: "var(--mint-pale)", color: "var(--matcha-deep)" }}
      >
        {(row.file.name.split(".").pop() ?? "").slice(0, 4)}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center justify-between gap-2">
          <span className="truncate text-[13px] font-medium text-[var(--matcha-deep)]">{row.file.name}</span>
          <span className="shrink-0 font-mono text-[10px] text-[var(--gray-ink)]">
            {formatBytes(row.file.size)}
          </span>
        </span>
        <div className="mt-1 flex items-center gap-2">
          <div className="h-1 flex-1 overflow-hidden rounded-full bg-[var(--mint-line)]">
            <div
              className="h-full bg-[var(--matcha-mid)] transition-all"
              style={{ width: `${Math.round(row.progress * 100)}%` }}
            />
          </div>
          <span className="shrink-0 font-mono text-[10px] tabular-nums text-[var(--gray-ink)]">
            {row.status === "indexed"
              ? `✓ ${row.stats?.recordsExtracted.toLocaleString()} records · ${row.stats?.entitiesResolved.toLocaleString()} entities`
              : row.status === "error"
              ? `error: ${row.errorMsg}`
              : `${Math.round(row.progress * 100)}% · ${row.stats?.category ?? ""}`}
          </span>
        </div>
      </span>
    </li>
  );
}

function formatBytes(b: number): string {
  if (b < 1024) return `${b}B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)}KB`;
  return `${(b / 1024 / 1024).toFixed(1)}MB`;
}
