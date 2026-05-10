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

  // Stick state — true means "follow latest content." Flips off when the user
  // scrolls up to read; flips back on when they scroll near the bottom OR when
  // they send a new message (we always pin to the new turn).
  const stickRef = useRef(true);
  const lastUserMsgCountRef = useRef(0);

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
    if (!el) return;
    const userMsgCount = messages.filter(m => m.role === "user").length;
    // If the user just sent a new message, FORCE scroll to bottom regardless
    // of where they were reading. ChatGPT-style: new turn always pulls focus.
    const newUserMessage = userMsgCount > lastUserMsgCountRef.current;
    lastUserMsgCountRef.current = userMsgCount;

    if (newUserMessage || stickRef.current) {
      // Smooth scroll for new turns, instant for in-progress streaming.
      el.scrollTo({
        top: el.scrollHeight,
        behavior: newUserMessage ? "smooth" : "auto",
      });
      stickRef.current = true;
    }
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
