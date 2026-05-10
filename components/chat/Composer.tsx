"use client";

import { useEffect, useRef, type KeyboardEvent } from "react";

interface ComposerProps {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  onStop?: () => void;
  streaming: boolean;
  placeholder?: string;
}

export function Composer({ value, onChange, onSubmit, onStop, streaming, placeholder }: ComposerProps) {
  const taRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 180) + "px";
  }, [value]);

  function onKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!streaming && value.trim()) onSubmit();
    }
  }

  return (
    <div className="sticky bottom-0 z-10 border-t border-[var(--mint-line)] bg-[var(--surface)] px-4 pb-[calc(env(safe-area-inset-bottom,0px)+12px)] pt-3 sm:px-6">
      <div className="mx-auto flex max-w-3xl items-end gap-2">
        <div className="flex flex-1 items-end gap-2 rounded-md border border-[var(--mint-line)] bg-[var(--surface)] px-3 py-2 transition-colors focus-within:border-[var(--matcha-mid)] focus-within:bg-[var(--mint-pale)]/40">
          <textarea
            ref={taRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={onKey}
            rows={1}
            placeholder={placeholder ?? "Ask anything across your stack — donors, grants, finance, programs…"}
            disabled={streaming}
            className="max-h-[180px] flex-1 resize-none bg-transparent font-sans text-[15px] text-[var(--matcha-deep)] outline-none placeholder:text-[var(--gray-ink)] disabled:opacity-60"
          />
          {streaming ? (
            <button
              type="button"
              onClick={onStop}
              className="shrink-0 rounded border border-[var(--strawberry-deep)]/40 bg-[var(--strawberry-soft)]/40 px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.12em] text-[var(--strawberry-deep)] transition-colors hover:bg-[var(--strawberry-soft)]/60"
            >
              stop
            </button>
          ) : (
            <button
              type="button"
              onClick={onSubmit}
              disabled={!value.trim()}
              className="shrink-0 rounded bg-[var(--matcha-deep)] px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.12em] text-[var(--cream)] transition-transform hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-40"
            >
              ask ↵
            </button>
          )}
        </div>
      </div>
      <div className="mx-auto mt-1.5 flex max-w-3xl items-center justify-between font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--gray-ink)]">
        <span>kali · single agent · cited answers</span>
        <span className="hidden sm:inline">↵ to send · shift+↵ for newline</span>
      </div>
    </div>
  );
}
