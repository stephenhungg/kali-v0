"use client";

import { forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useRef, type KeyboardEvent } from "react";

export interface ComposerHandle {
  /** Move keyboard focus into the textarea. Used after each turn so users can keep typing. */
  focus: () => void;
}

interface ComposerProps {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  onStop?: () => void;
  streaming: boolean;
  placeholder?: string;
}

export const Composer = forwardRef<ComposerHandle, ComposerProps>(function Composer(
  { value, onChange, onSubmit, onStop, streaming, placeholder },
  ref,
) {
  const taRef = useRef<HTMLTextAreaElement>(null);

  useImperativeHandle(ref, () => ({
    focus: () => taRef.current?.focus(),
  }), []);

  // Focus on mount.
  useEffect(() => {
    taRef.current?.focus();
  }, []);

  // Auto-grow up to ~6 lines.
  useLayoutEffect(() => {
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

  const canSend = !streaming && value.trim().length > 0;

  return (
    <div className="shrink-0 border-t border-[var(--mint-line)] bg-[var(--surface)] px-4 pb-[calc(env(safe-area-inset-bottom,0px)+12px)] pt-3 sm:px-6">
      <div className="mx-auto flex max-w-3xl items-end gap-2">
        <div
          className={`flex flex-1 items-end gap-2 rounded-md border bg-[var(--surface)] px-3 py-2 transition-colors ${
            streaming
              ? "border-[var(--mint-line)] bg-[var(--mint-pale)]/20"
              : "border-[var(--mint-line)] focus-within:border-[var(--matcha-mid)] focus-within:bg-[var(--mint-pale)]/40"
          }`}
        >
          <textarea
            ref={taRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={onKey}
            rows={1}
            placeholder={
              streaming
                ? "Kali is thinking… type your next question now."
                : placeholder ?? "Ask anything across your stack — or follow up on the answer above."
            }
            className="max-h-[180px] flex-1 resize-none bg-transparent font-sans text-[15px] text-[var(--matcha-deep)] outline-none placeholder:text-[var(--gray-ink)]"
          />
          {streaming ? (
            <button
              type="button"
              onClick={onStop}
              title="Stop generating"
              aria-label="Stop generating"
              className="shrink-0 rounded border border-[var(--strawberry-deep)]/40 bg-[var(--strawberry-soft)]/40 px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.12em] text-[var(--strawberry-deep)] transition-colors hover:bg-[var(--strawberry-soft)]/60"
            >
              ■ stop
            </button>
          ) : (
            <button
              type="button"
              onClick={onSubmit}
              disabled={!canSend}
              title={canSend ? "Send (Enter)" : "Type a question"}
              aria-label="Send"
              className="shrink-0 rounded bg-[var(--matcha-deep)] px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.12em] text-[var(--cream)] transition-transform hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-40"
            >
              ask ↵
            </button>
          )}
        </div>
      </div>
      <div className="mx-auto mt-1.5 flex max-w-3xl items-center justify-between font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--gray-ink)]">
        <span className="flex items-center gap-1.5">
          {streaming && <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--matcha-mid)] blink-soft" />}
          {streaming ? "kali is thinking" : "kali · 70+ tools · cited answers"}
        </span>
        <span className="hidden sm:inline">↵ send · shift+↵ newline · esc clear</span>
      </div>
    </div>
  );
});
