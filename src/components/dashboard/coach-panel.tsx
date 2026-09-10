'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Crown, LoaderCircle, Send, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useStore } from '@/lib/store-context';
import { useModals } from './modal-context';
import {
  FREE_COACH_REPLIES_PER_DAY,
  answerCoach,
  coachGreeting,
  hasProAccess,
  toISODate,
  COACH_QUICK_REPLIES,
  type CoachChip,
} from '@smartfit/core';
import { aiCoachEnabled, aiHost, askAiCoach } from '@/lib/ai-coach';
import { Ring } from './ring';
import { cn } from '@/lib/utils';

export interface CoachMessage {
  id: number;
  role: 'user' | 'coach';
  text: string;
  chips?: CoachChip[];
  time: string;
  /** True when an AI provider produced this answer (badge + honest label). */
  ai?: boolean;
  /** Small print under a bubble, e.g. the AI-unavailable fallback note. */
  notice?: string;
}

const now = () => new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

type ThinkingMode = 'local' | 'ai';

/** Where the athlete's AI-answers preference lives (opt-in, per browser). */
const AI_PREF_KEY = 'smartfit.aiCoach';

/** Free-tier AI reply counter (per calendar day, per browser). Pro = unlimited. */
const AI_USE_KEY = 'smartfit.coach.aiUses';

function readAiUses(): number {
  try {
    const raw = localStorage.getItem(AI_USE_KEY);
    if (!raw) return 0;
    const parsed = JSON.parse(raw) as { d?: string; n?: number };
    return parsed.d === toISODate(new Date()) ? (parsed.n ?? 0) : 0;
  } catch {
    return 0;
  }
}

function writeAiUse(count: number) {
  try {
    localStorage.setItem(AI_USE_KEY, JSON.stringify({ d: toISODate(new Date()), n: count }));
  } catch {
    /* storage unavailable — the cap simply stays soft */
  }
}

/**
 * Shared conversation state for every coach surface.
 *
 * Default answers come from `answerCoach` in @smartfit/core — one
 * deterministic, unit-tested, on-device engine. When (and only when) the
 * deployment configures an AI endpoint AND the athlete switches "AI answers"
 * on, questions go to that provider instead; any AI failure transparently
 * falls back to the on-device engine with a visible note.
 */
export function useCoachConversation() {
  const { state } = useStore();
  const [messages, setMessages] = useState<CoachMessage[]>([]);
  const [thinking, setThinking] = useState(false);
  const [thinkingLabel, setThinkingLabel] = useState('Reviewing your training log…');
  const [thinkingMode, setThinkingMode] = useState<ThinkingMode>('local');
  const idRef = useRef(0);
  const localTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const aliveRef = useRef(true);
  const aiAbortRef = useRef<AbortController | null>(null);

  const aiAvailable = useMemo(() => aiCoachEnabled(), []);
  const aiHost_ = useMemo(() => (aiAvailable ? aiHost() : ''), [aiAvailable]);
  const [aiOn, setAiOn] = useState(false);
  const pro = hasProAccess(state);
  const [aiUses, setAiUses] = useState(readAiUses);
  const capped = !pro && aiUses >= FREE_COACH_REPLIES_PER_DAY;

  function recordAiUse() {
    const next = readAiUses() + 1;
    writeAiUse(next);
    setAiUses(next);
  }

  useEffect(() => {
    setMessages([
      { id: idRef.current++, role: 'coach', text: coachGreeting(state.profile.name), time: now() },
    ]);
    // Greet once per mount, not on every state change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep timers and an in-flight free-provider request from outliving the
  // surface that started them. This also keeps a slow mobile tab from adding
  // an answer after the user has navigated away.
  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
      if (localTimerRef.current !== null) clearTimeout(localTimerRef.current);
      aiAbortRef.current?.abort();
    };
  }, []);

  // Restore the opt-in preference (default stays OFF — nothing leaves the
  // device unless the athlete explicitly asked for it).
  useEffect(() => {
    if (!aiAvailable) return;
    try {
      setAiOn(localStorage.getItem(AI_PREF_KEY) === '1');
    } catch {
      /* private mode — stay off */
    }
  }, [aiAvailable]);

  function toggleAi() {
    setAiOn((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(AI_PREF_KEY, next ? '1' : '0');
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  function finishLocalAnswer(question: string) {
    // A short async beat makes the free/on-device path feel like a considered
    // coach response and, importantly, gives keyboard and screen-reader users
    // a visible loading state just like the optional free AI provider.
    setThinkingMode('local');
    setThinkingLabel('Reviewing your training log…');
    setThinking(true);
    localTimerRef.current = setTimeout(() => {
      if (!aliveRef.current) return;
      const answer = answerCoach(question, state);
      setMessages((m) => [
        ...m,
        { id: idRef.current++, role: 'coach', text: answer.text, chips: answer.chips, time: now() },
      ]);
      localTimerRef.current = null;
      setThinking(false);
    }, 420);
  }

  function send(text: string) {
    const question = text.trim();
    if (!question || thinking) return;
    const stamp = now();
    setMessages((m) => [...m, { id: idRef.current++, role: 'user', text: question, time: stamp }]);

    if (aiAvailable && aiOn && !capped) {
      setThinkingMode('ai');
      setThinkingLabel('Thinking with your free AI coach…');
      setThinking(true);
      const controller = new AbortController();
      aiAbortRef.current = controller;
      void askAiCoach(question, state, { signal: controller.signal })
        .then((answer) => {
          if (!aliveRef.current) return;
          recordAiUse();
          setMessages((m) => [
            ...m,
            { id: idRef.current++, role: 'coach', text: answer, time: now(), ai: true },
          ]);
        })
        .catch(() => {
          if (!aliveRef.current || controller.signal.aborted) return;
          // The on-device engine never fails — degrade with an honest note.
          const local = answerCoach(question, state);
          setMessages((m) => [
            ...m,
            {
              id: idRef.current++,
              role: 'coach',
              text: local.text,
              chips: local.chips,
              time: now(),
              notice: 'AI unavailable right now — answered from your on-device data.',
            },
          ]);
        })
        .finally(() => {
          if (aliveRef.current) {
            aiAbortRef.current = null;
            setThinking(false);
            setThinkingLabel('Reviewing your training log…');
          }
        });
      return;
    }

    finishLocalAnswer(question);
  }

  return {
    messages,
    send,
    thinking,
    thinkingLabel,
    thinkingMode,
    aiAvailable,
    aiOn,
    aiHost: aiHost_,
    toggleAi,
    capped,
    quickReplies: useMemo(() => [...COACH_QUICK_REPLIES], []),
  };
}

/** Free-tier limit notice with the Pro upsell — sits above the composer. */
export function CoachFreeLimitNotice({ show }: { show: boolean }) {
  const { openWith } = useModals();
  if (!show) return null;
  return (
    <div className="bg-secondary mb-2 flex items-center justify-between gap-2 rounded-xl px-3 py-2">
      <p className="text-xs font-medium">
        Free AI replies used for today ({FREE_COACH_REPLIES_PER_DAY}). Pro is unlimited.
      </p>
      <Button size="sm" variant="outline" onClick={() => openWith({ kind: 'pro' })}>
        <Crown className="h-3.5 w-3.5" /> Go Pro
      </Button>
    </div>
  );
}

/** Opt-in switch for AI answers, shown only when an endpoint is configured. */
export function CoachAiToggle({
  on,
  onToggle,
  host,
  className,
}: {
  on: boolean;
  onToggle: () => void;
  host: string;
  className?: string;
}) {
  return (
    <div className={cn('grid gap-1', className)}>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        onClick={onToggle}
        className={cn(
          'inline-flex w-fit items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-bold transition-colors',
          on
            ? 'bg-primary text-primary-foreground border-transparent'
            : 'border-border bg-card text-foreground hover:border-primary/50',
        )}
      >
        <Sparkles className="h-3.5 w-3.5" aria-hidden />
        AI answers {on ? 'on' : 'off'}
        <span
          className={cn(
            'relative ml-0.5 h-4 w-7 rounded-full transition-colors',
            on ? 'bg-primary-foreground/35' : 'bg-secondary',
          )}
          aria-hidden
        >
          <span
            className={cn(
              'bg-card absolute top-0.5 h-3 w-3 rounded-full transition-all',
              on ? 'left-3.5' : 'left-0.5',
            )}
          />
        </span>
      </button>
      {on && host && (
        <p className="text-muted-foreground max-w-sm text-[11px] leading-snug">
          Your question plus a summary of your training stats is sent to <b>{host}</b>. Off means
          every answer is computed on this device.
        </p>
      )}
    </div>
  );
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

/** A calm loading bubble shared by the local coach and the free AI path. */
function TypingBubble({ label, mode }: { label: string; mode: ThinkingMode }) {
  return (
    <div
      className="animate-fade-in flex flex-col items-start"
      role="status"
      aria-live="polite"
      aria-label={label}
    >
      <div className="border-border bg-card text-card-foreground flex max-w-[92%] items-center gap-3 rounded-3xl rounded-tl-md border px-4 py-3.5 shadow-sm">
        <span className="bg-primary/10 text-primary flex h-8 w-8 shrink-0 items-center justify-center rounded-full">
          <Sparkles className="h-4 w-4 animate-pulse" aria-hidden />
        </span>
        <span className="min-w-0">
          <span className="block text-xs font-extrabold">{label}</span>
          <span className="text-muted-foreground mt-0.5 flex items-center gap-1 text-[10px]">
            {mode === 'ai'
              ? 'Using a privacy-limited summary of your stats'
              : 'Keeping everything on this device'}
            <span className="dot-typing ml-1 inline-flex gap-0.5" aria-hidden>
              <span className="bg-muted-foreground/70 h-1 w-1 rounded-full" />
              <span className="bg-muted-foreground/70 h-1 w-1 rounded-full" />
              <span className="bg-muted-foreground/70 h-1 w-1 rounded-full" />
            </span>
          </span>
        </span>
      </div>
    </div>
  );
}

export function CoachMessages({
  messages,
  className,
  thinking = false,
  thinkingLabel = 'Reviewing your training log…',
  thinkingMode = 'local',
}: {
  messages: CoachMessage[];
  className?: string;
  thinking?: boolean;
  thinkingLabel?: string;
  thinkingMode?: ThinkingMode;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, thinking]);

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
                : 'border-border bg-card text-card-foreground animate-fade-in rounded-tl-md border',
            )}
          >
            {m.text}
          </div>
          {m.notice && (
            <p className="text-muted-foreground mt-1 max-w-[88%] px-1 text-[11px] italic">
              {m.notice}
            </p>
          )}
          {m.chips && m.chips.length > 0 && <CoachChips chips={m.chips} />}
          <span className="text-muted-foreground mt-1 flex items-center gap-1.5 px-1 text-[10px]">
            {m.ai && (
              <span className="bg-primary/10 text-primary inline-flex items-center gap-0.5 rounded-full px-1.5 py-px text-[9px] font-extrabold tracking-wide uppercase">
                <Sparkles className="h-2.5 w-2.5" aria-hidden /> AI
              </span>
            )}
            {m.time}
          </span>
        </div>
      ))}
      {thinking && <TypingBubble label={thinkingLabel} mode={thinkingMode} />}
    </div>
  );
}

export function CoachComposer({
  onSend,
  placeholder = 'Ask your coach anything…',
  disabled = false,
}: {
  onSend: (text: string) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  const [input, setInput] = useState('');

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || disabled) return;
    onSend(input);
    setInput('');
  }

  return (
    <form onSubmit={submit} className="flex items-center gap-2">
      <Input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder={disabled ? 'Your coach is thinking…' : placeholder}
        aria-label="Message your coach"
        disabled={disabled}
        aria-busy={disabled}
        className="border-border bg-card h-12 flex-1 rounded-full pl-5 shadow-sm sm:h-12"
      />
      <Button
        type="submit"
        aria-label={disabled ? 'Coach is thinking' : 'Send'}
        aria-busy={disabled}
        size="icon"
        disabled={disabled || !input.trim()}
        className="shadow-primary/30 h-12 w-12 shrink-0 rounded-full shadow-md sm:h-12 sm:w-12"
      >
        {disabled ? (
          <LoaderCircle className="h-5 w-5 animate-spin" aria-hidden />
        ) : (
          <Send className="h-5 w-5" aria-hidden />
        )}
      </Button>
    </form>
  );
}

export function CoachQuickReplies({
  replies,
  onPick,
  disabled = false,
}: {
  replies: string[];
  onPick: (text: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex [scrollbar-width:none] gap-2 overflow-x-auto pb-1 [&::-webkit-scrollbar]:hidden">
      {replies.map((q) => (
        <Button
          key={q}
          type="button"
          variant="outline"
          disabled={disabled}
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
  const {
    messages,
    send,
    thinking,
    thinkingLabel,
    thinkingMode,
    aiAvailable,
    aiOn,
    aiHost,
    toggleAi,
    quickReplies,
    capped,
  } = useCoachConversation();

  return (
    <div
      className={cn(
        'border-border bg-card/70 flex h-full min-h-[560px] flex-col overflow-hidden rounded-[2rem] border shadow-sm',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3 px-5 pt-5">
        <span className="bg-primary text-primary-foreground shadow-primary/30 inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold shadow-md">
          <Sparkles className="h-4 w-4" /> Your coach
        </span>
        {aiAvailable && (
          <CoachAiToggle on={aiOn} onToggle={toggleAi} host={aiHost} className="justify-self-end" />
        )}
      </div>

      <CoachMessages
        messages={messages}
        thinking={thinking}
        thinkingLabel={thinkingLabel}
        thinkingMode={thinkingMode}
        className="px-5 py-6"
      />

      <div className="px-5 pb-3">
        <CoachQuickReplies replies={quickReplies} onPick={send} disabled={thinking} />
      </div>

      <div className="p-4 pt-1">
        <CoachFreeLimitNotice show={capped && aiOn && aiAvailable} />
        <CoachComposer onSend={send} placeholder="Type something…" disabled={thinking} />
      </div>
    </div>
  );
}
