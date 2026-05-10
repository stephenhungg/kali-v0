"use client";

import { useEffect, useRef } from "react";
import type { ChatMessage } from "../../hooks/useAgentStream";
import { Message } from "./Message";

interface ChatTranscriptProps {
  messages: ChatMessage[];
  onActivateCitation?: (kaliId: string) => void;
}

export function ChatTranscript({ messages, onActivateCitation }: ChatTranscriptProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const stickRef = useRef(true);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => {
      const fromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
      stickRef.current = fromBottom < 80;
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !stickRef.current) return;
    el.scrollTop = el.scrollHeight;
  }, [messages]);

  return (
    <div ref={scrollRef} className="h-full overflow-y-auto pb-4">
      <div className="divide-y divide-[var(--gray-line)]">
        {messages.map(m => (
          <Message key={m.id} message={m} onActivateCitation={onActivateCitation} />
        ))}
      </div>
    </div>
  );
}
