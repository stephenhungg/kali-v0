"use client";

interface CitationChipProps {
  number: number;
  kaliId: string;
  onActivate?: (kaliId: string) => void;
}

/**
 * Inline citation chip rendered for `[N]` markers in the assistant answer.
 * The number is the 1-based index Claude emitted. The kali_entity_id comes
 * from the `citations` array on the `done` event (resolved by lib/agent/render).
 */
export function CitationChip({ number, kaliId, onActivate }: CitationChipProps) {
  return (
    <button
      type="button"
      onClick={() => onActivate?.(kaliId)}
      title={kaliId}
      className="ml-0.5 inline-flex h-[18px] min-w-[20px] items-center justify-center rounded border border-[var(--matcha-mid)] bg-[var(--surface)] px-1 align-baseline font-mono text-[10px] font-medium text-[var(--matcha-mid)] transition-colors hover:bg-[var(--matcha-mid)] hover:text-[var(--cream)]"
    >
      {number}
    </button>
  );
}
