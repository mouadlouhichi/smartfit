'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Crown, Loader2, Send, Sparkles, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useStore } from '@/lib/store-context';
import { useI18n } from '@/lib/i18n-context';
import { useAuth } from '@/lib/firebase/auth-context';
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
import {
  CoachAiError,
  resolveCoachAvailability,
  streamAiCoach,
  type CoachAvailability,
  type CoachTurn,
} from '@/lib/ai-coach';
import { Ring } from './ring';
import { CoachText } from './coach-text';
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
  /** True while tokens are still arriving — shows the live caret + Stop. */
  streaming?: boolean;
}

const now = () => new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Pacing. Local answers are instant to compute, but snapping them in feels
 * broken next to a slow AI reply — so every answer keeps a short visible
 * "thinking" beat. Fast AI endpoints get the same treatment (a longer hold).
 */
const LOCAL_THINK_MS = 650;
const AI_MIN_THINK_MS = 1200;

/** Free-tier AI reply counter (per calendar day, per account/device). Pro = unlimited. */
const AI_USE_KEY = 'smartfit.coach.aiUses';

/**
 * The conversation itself, so a reload does not wipe the thread. Bounded: the
 * last 40 bubbles are plenty for a chat, and a runaway log would slow every
 * render down. The account suffix is important: two people sharing a browser
 * must never see one another's questions or training context.
 */
const CHAT_KEY = 'smartfit.coach.chat.v1';
const CHAT_KEEP = 40;
const scopedKey = (base: string, owner: string) => `${base}.${owner}`;

function readChat(owner: string): CoachMessage[] {
  try {
    const raw = localStorage.getItem(scopedKey(CHAT_KEY, owner));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as { v?: number; messages?: unknown };
    if (parsed.v !== 1 || !Array.isArray(parsed.messages)) return [];
    return parsed.messages
      .filter(
        (m): m is CoachMessage =>
          !!m &&
          typeof m === 'object' &&
          (m as CoachMessage).role !== undefined &&
          typeof (m as CoachMessage).text === 'string' &&
          typeof (m as CoachMessage).id === 'number',
      )
      .filter((m) => m.role === 'user' || m.role === 'coach')
      .map((m) => ({ ...m, streaming: false }))
      .slice(-CHAT_KEEP);
  } catch {
    return [];
  }
}

function writeChat(owner: string, messages: CoachMessage[]) {
  try {
    localStorage.setItem(
      scopedKey(CHAT_KEY, owner),
      JSON.stringify({
        v: 1,
        messages: messages
          .filter((m) => m.text.trim().length > 0)
          .slice(-CHAT_KEEP)
          .map(({ streaming: _streaming, ...rest }) => rest),
      }),
    );
  } catch {
    /* private mode / quota — the thread just does not survive the reload */
  }
}

/**
 * The turns the provider sees. The on-device engine answers from the stored
 * state, so only text matters here — chips, notices and timestamps are UI.
 */
export function toCoachTurns(messages: CoachMessage[]): CoachTurn[] {
  return messages
    .filter((m) => m.text.trim().length > 0)
    .map((m) => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.text }) as CoachTurn);
}

function readAiUses(owner: string): number {
  try {
    const raw = localStorage.getItem(scopedKey(AI_USE_KEY, owner));
    if (!raw) return 0;
    const parsed = JSON.parse(raw) as { d?: string; n?: number };
    return parsed.d === toISODate(new Date()) ? (parsed.n ?? 0) : 0;
  } catch {
    return 0;
  }
}

function writeAiUse(owner: string, count: number) {
  try {
    localStorage.setItem(
      scopedKey(AI_USE_KEY, owner),
      JSON.stringify({ d: toISODate(new Date()), n: count }),
    );
  } catch {
    /* storage unavailable — the cap simply stays soft */
  }
}

/**
 * One honest sentence about why an AI answer did not arrive — the athlete sees
 * this under a coach bubble that was answered from their own data instead.
 */
function aiFallbackNotice(
  error: unknown,
  stopped: boolean,
  t: (key: string, vars?: Record<string, string | number>) => string,
): string {
  if (stopped) return t('coach.notice.stopped');
  const message = (error instanceof Error ? error.message : '').replace(/\s+/g, ' ').trim();
  if (/took too long|did not respond in time/i.test(message)) {
    return t('coach.notice.timeout');
  }
  if (/not configured/i.test(message)) {
    return t('coach.notice.unconfigured');
  }
  if (/rate limit|quota|\(429\)/i.test(message)) {
    return t('coach.notice.quota');
  }
  // A rejected key, an unknown model, a provider-side outage: the provider's
  // own words are the most useful thing an operator can see here, so pass them
  // through (shortened) instead of hiding them behind "unavailable".
  if (message) {
    const detail = message.length > 150 ? `${message.slice(0, 149)}…` : message;
    return t('coach.notice.unavailable', { detail });
  }
  return t('coach.notice.offline');
}

/**
 * Shared conversation state for every coach surface.
 *
 * Answers come from the deployment's configured AI provider when there is
 * one, and from `answerCoach` in @smartfit/core — one deterministic,
 * unit-tested, on-device engine — otherwise. There is no switch: any AI
 * failure falls back to the on-device engine with a visible note, so the
 * coach always answers even with no provider, no network, or no key.
 */
export function useCoachConversation() {
  const { t } = useI18n();
  const { state } = useStore();
  const { user, mode } = useAuth();
  // Firebase uid isolates cloud accounts; local and signed-out sessions use
  // separate buckets as well, rather than falling back to one global thread.
  const ownerKey = user?.uid ?? (mode === 'cloud' ? 'signed-out' : 'local');
  const [messages, setMessages] = useState<CoachMessage[]>([]);
  const hydratedOwnerRef = useRef<string | null>(null);
  /**
   * Which kind of answer is in flight (null = idle). Drives the thinking
   * bubble, the composer's loading state, and the stop button for AI calls.
   */
  const [pending, setPending] = useState<'ai' | 'local' | null>(null);
  const thinking = pending !== null;
  const idRef = useRef(0);
  /** Synchronous send lock — state updates lag a same-tick double tap. */
  const busyRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const stoppedRef = useRef(false);
  /** False after unmount — a slow free endpoint must not push late answers. */
  const aliveRef = useRef(true);

  /**
   * Which transport can answer: this deployment's own proxy (key on the
   * server) or a directly configured public endpoint. Probed once — the answer
   * only changes when the deployment does.
   */
  const [ai, setAi] = useState<CoachAvailability>({
    available: false,
    transport: 'none',
    host: '',
    model: '',
  });
  const aiAvailable = ai.available;
  const aiHost_ = ai.host;
  const pro = hasProAccess(state);
  const [aiUses, setAiUses] = useState(() => readAiUses(ownerKey));
  const capped = !pro && aiUses >= FREE_COACH_REPLIES_PER_DAY;

  function recordAiUse() {
    const next = readAiUses(ownerKey) + 1;
    writeAiUse(ownerKey, next);
    setAiUses(next);
  }

  useEffect(() => {
    hydratedOwnerRef.current = ownerKey;
    setMessages([
      { id: idRef.current++, role: 'coach', text: coachGreeting(state.profile.name), time: now() },
    ]);
    // Greet once per account bucket, not on every state change.
  }, [ownerKey, state.profile.name]);

  // Navigating away cancels an in-flight free-provider request (and any
  // pending on-device beat) so late answers never land in the next screen.
  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
      abortRef.current?.abort();
    };
  }, [ownerKey]);

  // Restore the account-scoped thread, so a reload does not wipe the
  // conversation or expose it to another person using this browser.
  useEffect(() => {
    const restored = readChat(ownerKey);
    setAiUses(readAiUses(ownerKey));
    if (restored.length > 0) {
      idRef.current = Math.max(...restored.map((m) => m.id)) + 1;
      setMessages(restored);
    }
  }, [ownerKey]);

  useEffect(() => {
    let alive = true;
    void resolveCoachAvailability().then((next) => {
      if (alive) setAi(next);
    });
    return () => {
      alive = false;
    };
  }, []);

  // Persist the thread (debounced — tokens arrive in bursts while streaming).
  useEffect(() => {
    if (messages.length === 0 || hydratedOwnerRef.current !== ownerKey) return;
    const t = setTimeout(() => writeChat(ownerKey, messages), 400);
    return () => clearTimeout(t);
  }, [messages, ownerKey]);

  /** Abort an in-flight AI request; the coach falls back to on-device data. */
  function stop() {
    stoppedRef.current = true;
    abortRef.current?.abort();
  }

  function send(text: string) {
    const question = text.trim();
    if (!question || busyRef.current) return;
    busyRef.current = true;
    const stamp = now();
    setMessages((m) => [...m, { id: idRef.current++, role: 'user', text: question, time: stamp }]);

    if (aiAvailable && !capped) {
      setPending('ai');
      const started = Date.now();
      const controller = new AbortController();
      abortRef.current = controller;
      const history = toCoachTurns(messages);
      void (async () => {
        /** The bubble takes its id from here the moment the first token lands. */
        let id: number | null = null;
        let streamed = '';
        let flushTimer: ReturnType<typeof setTimeout> | null = null;
        const flush = () => {
          if (id === null) return;
          const text = streamed;
          setMessages((m) => m.map((x) => (x.id === id ? { ...x, text } : x)));
        };
        const settle = (patch: Partial<CoachMessage>) => {
          if (id === null) return;
          const target = id;
          setMessages((m) =>
            m.map((x) => (x.id === target ? { ...x, streaming: false, ...patch } : x)),
          );
        };
        try {
          for await (const delta of streamAiCoach(question, state, {
            history,
            signal: controller.signal,
            transport: ai.transport,
          })) {
            if (!aliveRef.current) return;
            if (id === null) {
              // Free endpoints are slow; fast ones shouldn't flash — hold the
              // thinking state for a readable minimum before the first token.
              const hold = AI_MIN_THINK_MS - (Date.now() - started);
              if (hold > 0) await wait(hold);
              if (!aliveRef.current) return;
              if (!stoppedRef.current) recordAiUse();
              id = idRef.current++;
              const created = id;
              setMessages((m) => [
                ...m,
                { id: created, role: 'coach', text: '', time: now(), ai: true, streaming: true },
              ]);
            }
            streamed += delta;
            // One render per ~60ms instead of one per token.
            if (!flushTimer) {
              flushTimer = setTimeout(() => {
                flushTimer = null;
                flush();
              }, 60);
            }
          }
          if (flushTimer) {
            clearTimeout(flushTimer);
            flushTimer = null;
          }
          if (id === null) throw new CoachAiError(t('coach.error.empty'));
          flush();
          const trimmed = streamed.trim();
          if (!trimmed) throw new CoachAiError(t('coach.error.empty'));
          settle(
            stoppedRef.current
              ? { text: trimmed, notice: t('coach.notice.incompleteStopped') }
              : { text: trimmed },
          );
        } catch (e) {
          if (flushTimer) {
            clearTimeout(flushTimer);
            flushTimer = null;
          }
          if (!aliveRef.current) return;
          // Already streaming? Keep what arrived instead of swapping the
          // athlete's half-answer for a different one.
          if (id !== null && streamed.trim()) {
            flush();
            settle({
              text: streamed.trim(),
              notice: stoppedRef.current
                ? t('coach.notice.incompleteStopped')
                : t('coach.notice.incompleteDrop'),
            });
            return;
          }
          // Nothing arrived: the on-device engine never fails — degrade with
          // an honest note. The console line matters: the browser's own
          // `POST /api/coach 4xx/5xx` says nothing about the cause, and this
          // is where an operator finds the provider's own words.
          if (e instanceof Error) console.warn('[coach] AI answer failed:', e.message);
          const local = answerCoach(question, state);
          await wait(400);
          if (!aliveRef.current) return;
          const stopped = stoppedRef.current;
          const notice = aiFallbackNotice(e, stoppedRef.current, t);
          setMessages((m) => [
            ...m,
            {
              id: idRef.current++,
              role: 'coach',
              text: local.text,
              chips: local.chips,
              time: now(),
              notice,
            },
          ]);
        } finally {
          abortRef.current = null;
          stoppedRef.current = false;
          busyRef.current = false;
          if (aliveRef.current) setPending(null);
        }
      })();
      return;
    }

    // On-device answers compute instantly; hold a short visible think so the
    // reply never snaps in and double-sends are impossible while it's busy.
    setPending('local');
    const answer = answerCoach(question, state);
    void wait(LOCAL_THINK_MS + Math.round(Math.random() * 250)).then(() => {
      if (!aliveRef.current) return;
      setMessages((m) => [
        ...m,
        {
          id: idRef.current++,
          role: 'coach',
          text: answer.text,
          chips: answer.chips,
          time: now(),
        },
      ]);
      busyRef.current = false;
      setPending(null);
    });
  }

  return {
    messages,
    send,
    thinking,
    pending,
    aiAvailable,
    aiHost: aiHost_,
    aiTransport: ai.transport,
    stop,
    capped,
    quickReplies: useMemo(() => [...COACH_QUICK_REPLIES], []),
  };
}

/** Free-tier limit notice with the Pro upsell — sits above the composer. */
export function CoachFreeLimitNotice({ show }: { show: boolean }) {
  const { openWith } = useModals();
  const { t } = useI18n();
  if (!show) return null;
  return (
    <div className="bg-secondary mb-2 flex items-center justify-between gap-2 rounded-xl px-3 py-2">
      <p className="text-xs font-medium">
        {t('coach.limit', { used: FREE_COACH_REPLIES_PER_DAY })}
      </p>
      <Button size="sm" variant="outline" onClick={() => openWith({ kind: 'pro' })}>
        <Crown className="h-3.5 w-3.5" /> {t('coach.goPro')}
      </Button>
    </div>
  );
}

/**
 * Where the coach's answers come from — a label, not a control.
 *
 * AI answers are used whenever the deployment has a provider configured; the
 * on-device engine is the fallback. The switch that used to live here is gone
 * (the operator configures AI once, per deployment, in the environment), but
 * the disclosure stays: a question plus a summary of the training data really
 * does leave the device, and the athlete is entitled to know where it goes.
 */
export function CoachAiSource({
  host,
  viaProxy = false,
  className,
}: {
  host: string;
  /** True when answers go through this deployment's own /api/coach route. */
  viaProxy?: boolean;
  className?: string;
}) {
  return (
    <p className={cn('text-muted-foreground max-w-sm text-[11px] leading-snug', className)}>
      <Sparkles className="mr-1 inline h-3 w-3 align-[-1px]" aria-hidden />
      Answers come from AI (<b>{host || 'your provider'}</b>)
      {viaProxy ? ' through this app’s server — the key never reaches your browser' : ''}. Your
      question and a summary of your training stats are sent there; if the provider fails or has no
      key, the coach answers on this device from the same data.
    </p>
  );
}

/**
 * A chip's ring shows its real share of the period total — previously these
 * were decorative values (`60 + i * 13`) rendered next to genuine calorie
 * figures, which read as data.
 */
export function CoachChips({ chips }: { chips: CoachChip[] }) {
  return (
    <div className="mt-3 flex min-w-0 [scrollbar-width:none] gap-3 overflow-x-auto pb-1 [&::-webkit-scrollbar]:hidden">
      {chips.map((c) => (
        <div
          key={c.label}
          className="border-border bg-card flex w-[132px] shrink-0 items-center gap-3 rounded-2xl border px-4 py-3 shadow-sm"
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

/**
 * Coach is thinking — the loading face of the chat.
 *
 * Shown for every in-flight answer (on-device too, see `LOCAL_THINK_MS`).
 * Rotating status lines + a live elapsed timer make slow free AI endpoints
 * legible instead of looking frozen, and an AI request can be stopped from
 * here (the conversation then answers on-device).
 */
function ThinkingBubble({ ai, host, onStop }: { ai: boolean; host?: string; onStop?: () => void }) {
  const { t } = useI18n();
  const captions = ai
    ? [
        host ? t('coach.thinking.host', { host }) : t('coach.thinking.ai'),
        t('coach.thinking.log'),
        t('coach.thinking.week'),
        t('coach.thinking.almost'),
      ]
    : [t('coach.thinking.scan'), t('coach.thinking.adding')];

  const [step, setStep] = useState(0);
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    const rotate = setInterval(() => setStep((s) => s + 1), ai ? 2600 : 800);
    return () => clearInterval(rotate);
  }, [ai]);

  useEffect(() => {
    const tick = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(tick);
  }, []);

  const slow = ai && seconds >= 10;

  return (
    <div className="flex flex-col items-start">
      <div className="border-border bg-card text-card-foreground flex max-w-[88%] items-center gap-3 rounded-3xl rounded-tl-md border px-4 py-3.5 shadow-sm">
        <span className="bg-primary/10 text-primary flex h-7 w-7 shrink-0 items-center justify-center rounded-full">
          <Sparkles className="animate-pulse-soft h-3.5 w-3.5" aria-hidden />
        </span>
        <span className="dot-typing flex items-center gap-1.5" aria-hidden>
          <span className="bg-muted-foreground/70 h-1.5 w-1.5 rounded-full" />
          <span className="bg-muted-foreground/70 h-1.5 w-1.5 rounded-full" />
          <span className="bg-muted-foreground/70 h-1.5 w-1.5 rounded-full" />
        </span>
      </div>
      <span className="text-muted-foreground mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 px-1 text-[11px]">
        <span aria-live="polite">
          {slow ? t('coach.thinking.slow') : captions[step % captions.length]}
        </span>
        {ai && seconds >= 3 && (
          <span className="tabular-nums opacity-80" aria-hidden>
            {seconds}s
          </span>
        )}
        {ai && onStop && (
          <button
            type="button"
            onClick={onStop}
            className="text-muted-foreground hover:text-foreground hover:bg-secondary inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold transition-colors"
          >
            <Square className="h-2.5 w-2.5 fill-current" aria-hidden /> {t('coach.stop')}
          </button>
        )}
      </span>
      <span className="text-muted-foreground/80 mt-0.5 px-1 text-[10px] italic">
        {slow ? t('coach.source.slow') : ai ? t('coach.source.summary') : t('coach.source.local')}
      </span>
    </div>
  );
}

export function CoachMessages({
  messages,
  className,
  pending = null,
  aiHost,
  onStop,
}: {
  messages: CoachMessage[];
  className?: string;
  /** `'ai'` or `'local'` while an answer is in flight; `null` when idle. */
  pending?: 'ai' | 'local' | null;
  /** Shown in the thinking status ("Asking <host>…") for AI answers. */
  aiHost?: string;
  /** Cancels an in-flight AI request (Stop in the thinking bubble). */
  onStop?: () => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  /** A token stream replaces the thinking bubble as soon as it starts. */
  const streaming = messages.some((m) => m.streaming);
  const thinking = pending !== null && !streaming;

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
            {m.role === 'user' ? (
              <span className="whitespace-pre-line">{m.text}</span>
            ) : (
              <CoachText text={m.text} />
            )}
            {m.streaming && (
              <span className="text-muted-foreground mt-2 flex items-center gap-2 text-[11px]">
                <span className="dot-typing flex items-center gap-1" aria-hidden>
                  <span className="bg-muted-foreground/70 h-1 w-1 rounded-full" />
                  <span className="bg-muted-foreground/70 h-1 w-1 rounded-full" />
                  <span className="bg-muted-foreground/70 h-1 w-1 rounded-full" />
                </span>
                <span aria-live="polite" className="sr-only">
                  Answer streaming
                </span>
                {onStop && (
                  <button
                    type="button"
                    onClick={onStop}
                    className="hover:text-foreground hover:bg-secondary inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold transition-colors"
                  >
                    <Square className="h-2.5 w-2.5 fill-current" aria-hidden /> Stop
                  </button>
                )}
              </span>
            )}
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
      {pending !== null && (
        <ThinkingBubble
          ai={pending === 'ai'}
          host={aiHost}
          onStop={pending === 'ai' ? onStop : undefined}
        />
      )}
    </div>
  );
}

export function CoachComposer({
  onSend,
  placeholder,
  disabled = false,
}: {
  onSend: (text: string) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  const [input, setInput] = useState('');
  const { t } = useI18n();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || disabled) return;
    onSend(input);
    setInput('');
  }

  return (
    <form onSubmit={submit} className="flex items-center gap-2" aria-busy={disabled}>
      <Input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder={placeholder ?? t('coach.composer.askPlaceholder')}
        aria-label={t('coach.composer.aria')}
        className="border-border bg-card h-12 flex-1 rounded-full pl-5 shadow-sm sm:h-12"
      />
      <Button
        type="submit"
        aria-label={t('coach.send')}
        size="icon"
        disabled={disabled || !input.trim()}
        className="shadow-primary/30 h-12 w-12 shrink-0 rounded-full shadow-md sm:h-12 sm:w-12"
      >
        {disabled ? (
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
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
    <div className="flex min-w-0 [scrollbar-width:none] gap-2 overflow-x-auto pb-1 [&::-webkit-scrollbar]:hidden">
      {replies.map((q) => (
        <Button
          key={q}
          type="button"
          variant="outline"
          disabled={disabled}
          onClick={() => onPick(q)}
          className="hover:border-primary hover:text-primary shrink-0 rounded-full text-xs font-semibold whitespace-nowrap"
        >
          {q}
        </Button>
      ))}
    </div>
  );
}

/** Compact coach used in the dashboard's right-hand column. */
export function CoachPanel({ className }: { className?: string }) {
  const { t } = useI18n();
  const {
    messages,
    send,
    thinking,
    pending,
    aiAvailable,
    aiHost,
    aiTransport,
    stop,
    quickReplies,
    capped,
  } = useCoachConversation();

  return (
    <div
      className={cn(
        'border-border bg-card/70 flex h-full min-w-0 flex-col overflow-hidden rounded-[2rem] border shadow-sm',
        className,
      )}
    >
      <div className="flex min-w-0 items-start justify-between gap-3 px-5 pt-5">
        <span className="bg-primary text-primary-foreground shadow-primary/30 inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold shadow-md">
          <Sparkles className="h-4 w-4" /> {t('coach.title')}
        </span>
        {aiAvailable && (
          <CoachAiSource
            host={aiHost}
            viaProxy={aiTransport === 'proxy'}
            className="max-w-[15rem] text-right"
          />
        )}
      </div>

      <CoachMessages
        messages={messages}
        pending={pending}
        aiHost={aiHost}
        onStop={stop}
        className="px-5 py-6"
      />

      <div className="px-5 pb-3">
        <CoachQuickReplies replies={quickReplies} onPick={send} disabled={thinking} />
      </div>

      <div className="p-4 pt-1">
        <CoachFreeLimitNotice show={capped && aiAvailable} />
        <CoachComposer
          onSend={send}
          placeholder={t('coach.composer.placeholder')}
          disabled={thinking}
        />
      </div>
    </div>
  );
}
