'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Send, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useStore } from '@/lib/store-context';
import { answerCoach, coachGreeting, COACH_QUICK_REPLIES, type CoachChip } from '@smartfit/core';
import { Ring } from './ring';
import { cn } from '@/lib/utils';

export interface CoachMessage {
  id: number;
  role: 'user' | 'coach';
  text: string;
  chips?: CoachChip[];
  time: string;
}

const now = () => new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

/**
 * Shared conversation state for every coach surface.
 *
 * The answers themselves come from `answerCoach` in @smartfit/core — one
 * deterministic, unit-tested engine rather than a copy per screen.
 */
export function useCoachConversation() {
  const { state } = useStore();
  const [messages, setMessages] = useState<CoachMessage[]>([]);
  const idRef = useRef(0);

  useEffect(() => {
    setMessages([
      { id: idRef.current++, role: 'coach', text: coachGreeting(state.profile.name), time: now() },
    ]);
    // Greet once per mount, not on every state change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function send(text: string) {
    const question = text.trim();
    if (!question) return;
    const stamp = now();
    const answer = answerCoach(question, state);
    setMessages((m) => [
      ...m,
      { id: idRef.current++, role: 'user', text: question, time: stamp },
      { id: idRef.current++, role: 'coach', text: answer.text, chips: answer.chips, time: stamp },
    ]);
  }

  return { messages, send, quickReplies: useMemo(() => [...COACH_QUICK_REPLIES], []) };
}

/**
 * A chip's ring shows its real share of the period total — previously these
 * were decorative values (`60 + i * 13`) rendered next to genuine calorie
 * figures, which read as data.
 */
export function CoachChips({ chips }: { chips: CoachChip[] }) {
  return (
    <div className="mt-3 flex [scrollbar-width:none] gap-3 overflow-x-auto pb-1 [&::-webkit-scrollbar]:hidden">
      {chips.map((c) => (
        <div
          key={c.label}
          className="border-border bg-card flex min-w-[132px] items-center gap-3 rounded-2xl border px-4 py-3 shadow-sm"
        >
          <span className="min-w-0 flex-1">
            <span className="text-muted-foreground block truncate text-xs font-medium">
              {c.label}
            </span>
            <span className="text-foreground block text-sm font-extrabold">{c.value}</span>
          </span>
          <Ring pct={c.pct} size={40} stroke={4}>
            <span className="text-[10px] font-bold tabular-nums">{c.pct}%</span>
          </Ring>
        </div>
      ))}
    </div>
  );
}

export function CoachMessages({
  messages,
  className,
}: {
  messages: CoachMessage[];
  className?: string;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  return (
    <div ref={scrollRef} className={cn('flex-1 space-y-4 overflow-y-auto', className)}>
      {messages.map((m) => (
        <div
          key={m.id}
          className={cn('flex flex-col', m.role === 'user' ? 'items-end' : 'items-start')}
        >
          <div
            className={cn(
              'max-w-[88%] rounded-3xl px-4 py-3 text-sm leading-relaxed shadow-sm',
              m.role === 'user'
                ? 'bg-primary text-primary-foreground rounded-tr-md'
                : 'border-border bg-card text-card-foreground rounded-tl-md border',
            )}
          >
            {m.text}
          </div>
          {m.chips && m.chips.length > 0 && <CoachChips chips={m.chips} />}
          <span className="text-muted-foreground mt-1 px-1 text-[10px]">{m.time}</span>
        </div>
      ))}
    </div>
  );
}

export function CoachComposer({
  onSend,
  placeholder = 'Ask your coach anything…',
}: {
  onSend: (text: string) => void;
  placeholder?: string;
}) {
  const [input, setInput] = useState('');

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim()) return;
    onSend(input);
    setInput('');
  }

  return (
    <form onSubmit={submit} className="flex items-center gap-2">
      <Input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder={placeholder}
        aria-label="Message your coach"
        className="border-border bg-card h-12 flex-1 rounded-full pl-5 shadow-sm"
      />
      <Button
        type="submit"
        aria-label="Send"
        size="icon"
        disabled={!input.trim()}
        className="shadow-primary/30 h-12 w-12 shrink-0 rounded-full shadow-md"
      >
        <Send className="h-5 w-5" />
      </Button>
    </form>
  );
}

export function CoachQuickReplies({
  replies,
  onPick,
}: {
  replies: string[];
  onPick: (text: string) => void;
}) {
  return (
    <div className="flex [scrollbar-width:none] gap-2 overflow-x-auto pb-1 [&::-webkit-scrollbar]:hidden">
      {replies.map((q) => (
        <Button
          key={q}
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onPick(q)}
          className="hover:border-primary hover:text-primary rounded-full text-xs font-semibold whitespace-nowrap"
        >
          {q}
        </Button>
      ))}
    </div>
  );
}

/** Compact coach used in the dashboard's right-hand column. */
export function CoachPanel({ className }: { className?: string }) {
  const { messages, send, quickReplies } = useCoachConversation();

  return (
    <div
      className={cn(
        'border-border bg-card/70 flex h-full min-h-[560px] flex-col overflow-hidden rounded-[2rem] border shadow-sm',
        className,
      )}
    >
      <div className="flex justify-center pt-5">
        <span className="bg-primary text-primary-foreground shadow-primary/30 inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold shadow-md">
          <Sparkles className="h-4 w-4" /> Your coach
        </span>
      </div>

      <CoachMessages messages={messages} className="px-5 py-6" />

      <div className="px-5 pb-3">
        <CoachQuickReplies replies={quickReplies} onPick={send} />
      </div>

      <div className="p-4 pt-1">
        <CoachComposer onSend={send} placeholder="Type something…" />
      </div>
    </div>
  );
}
