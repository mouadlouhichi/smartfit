'use client';

import { useEffect, useRef, useState } from 'react';
import { Send, Sparkles, Mic } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useStore } from '@/lib/store-context';
import {
  currentStreak,
  thisWeek,
  goalProgress,
  formatCalories,
  formatMinutes,
  formatDistance,
  relativeDay,
  categoryBreakdown,
  getPlan,
  todaysFocus,
} from '@smartfit/core';
import { cn } from '@/lib/utils';

interface Msg {
  id: string;
  role: 'user' | 'coach';
  text: string;
  chips?: { label: string; kcal?: string }[];
  time?: string;
}

const QUICK = [
  'How am I doing this week?',
  'What should I train today?',
  'How many calories did I burn?',
  'Am I on track for my goals?',
];

let n = 0;
const mid = () => `m_${Date.now()}_${n++}`;

export default function CoachPage() {
  const { state } = useStore();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMessages([
      {
        id: mid(),
        role: 'coach',
        text: greeting(state.profile.name),
      },
    ]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  function send(text: string) {
    const q = text.trim();
    if (!q) return;
    const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const userMsg: Msg = { id: mid(), role: 'user', text: q, time: now };
    const reply = coachReply(q, state);
    setMessages((m) => [...m, userMsg, { id: mid(), role: 'coach', ...reply, time: now }]);
    setInput('');
  }

  const hasData = state.sessions.length > 0;

  return (
    <div className="flex h-[calc(100dvh-140px)] flex-col lg:h-[calc(100dvh-120px)]">
      {/* Header */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md shadow-primary/30">
            <Sparkles className="h-5 w-5" />
          </span>
          <div>
            <h1 className="font-display text-lg font-extrabold leading-tight tracking-tight">AI Coach</h1>
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="h-2 w-2 rounded-full bg-primary animate-pulse-soft" /> Runs privately on your device
            </p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto rounded-3xl border border-border bg-card/60 p-4">
        {messages.map((m) => (
          <div key={m.id} className={cn('flex flex-col', m.role === 'user' ? 'items-end' : 'items-start')}>
            <div
              className={cn(
                'max-w-[85%] rounded-3xl px-4 py-3 text-sm leading-relaxed shadow-sm',
                m.role === 'user'
                  ? 'rounded-tr-md bg-primary text-primary-foreground'
                  : 'rounded-tl-md border border-border bg-card text-card-foreground',
              )}
            >
              {m.text}
            </div>
            {m.chips && (
              <div className="mt-3 flex gap-2.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {m.chips.map((c, i) => (
                  <div
                    key={i}
                    className="flex min-w-[120px] flex-col items-center gap-2 rounded-2xl border border-border bg-card px-4 py-3 shadow-sm"
                  >
                    <ProgressRing pct={60 + ((i * 13) % 35)} />
                    <p className="text-xs font-semibold">{c.label}</p>
                    {c.kcal && <p className="text-sm font-extrabold text-primary">{c.kcal}</p>}
                  </div>
                ))}
              </div>
            )}
            {m.time && <span className="mt-1 px-1 text-[10px] text-muted-foreground">{m.time}</span>}
          </div>
        ))}
      </div>

      {/* Quick replies */}
      <div className="mt-3 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {QUICK.map((q) => (
          <Button
            key={q}
            type="button"
            variant="outline"
            size="sm"
            onClick={() => send(q)}
            className="whitespace-nowrap rounded-full text-xs font-semibold text-clay hover:border-primary hover:text-primary"
          >
            {q}
          </Button>
        ))}
      </div>

      {/* Input */}
      <div className="mt-2 flex items-center gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send(input)}
          placeholder={hasData ? 'Ask your coach anything…' : 'Type a message…'}
          className="h-12 flex-1 rounded-full border-border bg-card pl-5 shadow-sm"
        />
        <Button
          type="button"
          onClick={() => send(input)}
          aria-label="Send"
          size="icon"
          className="h-12 w-12 shrink-0 rounded-full shadow-md shadow-primary/30"
        >
          <Send className="h-5 w-5" />
        </Button>
        <Button
          type="button"
          aria-label="Voice"
          variant="secondary"
          size="icon"
          className="hidden h-12 w-12 shrink-0 rounded-full sm:flex"
        >
          <Mic className="h-5 w-5" />
        </Button>
      </div>
    </div>
  );
}

function ProgressRing({ pct }: { pct: number }) {
  const r = 16;
  const c = 2 * Math.PI * r;
  return (
    <svg width="44" height="44" viewBox="0 0 44 44" className="-rotate-90">
      <circle cx="22" cy="22" r={r} fill="none" stroke="var(--secondary)" strokeWidth="4" />
      <circle
        cx="22"
        cy="22"
        r={r}
        fill="none"
        stroke="var(--primary)"
        strokeWidth="4"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c - (c * pct) / 100}
      />
    </svg>
  );
}

function greeting(name?: string) {
  const h = new Date().getHours();
  const part = h < 12 ? 'morning' : h < 18 ? 'afternoon' : 'evening';
  return `Good ${part}${name ? `, ${name}` : ''}! I'm your coach. Ask me about your week, today's session, calories, or your goals — it all stays on this device.`;
}

function coachReply(q: string, state: ReturnType<typeof useStore>['state']): Omit<Msg, 'id' | 'role' | 'time'> {
  const text = q.toLowerCase();
  const week = thisWeek(state);
  const streak = currentStreak(state);
  const plan = getPlan(state.profile.planId);
  const focus = todaysFocus(state);

  if (state.sessions.length === 0) {
    return {
      text: `You haven't logged a session yet. Once you do, I can break down your volume, calories and trends. For now, your plan is "${plan.name}" — tap the + button to log your first workout and I'll start tracking.`,
    };
  }

  if (text.includes('calor') || text.includes('burn') || text.includes('kcal')) {
    const recent = state.sessions[0];
    const weekSessions = state.sessions.filter((s) => s.date >= weekRangeStart());
    const byCat = new Map<string, number>();
    for (const s of weekSessions) byCat.set(s.categoryId, (byCat.get(s.categoryId) ?? 0) + s.calories);
    const chips = [...byCat.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([catId, kcal]) => ({
        label: state.categories.find((c) => c.id === catId)?.name ?? 'Activity',
        kcal: formatCalories(kcal),
      }));
    return {
      text: `You burned ${formatCalories(week.calories)} across ${week.workouts} session${week.workouts === 1 ? '' : 's'} this week${
        recent ? ` — your latest was ${formatCalories(recent.calories)} on ${relativeDay(recent.date)}` : ''
      }. Here's where it came from:`,
      chips: chips.length ? chips : undefined,
    };
  }

  if (text.includes('today') || text.includes('train') || text.includes('workout') || text.includes('should')) {
    const scheduled = state.schedule
      .filter((s) => s.active && s.weekday === new Date().getDay())
      .sort((a, b) => a.timeOfDay.localeCompare(b.timeOfDay));
    return {
      text: focus
        ? `Today's focus is ${focus}. ${
            scheduled.length ? `You've got ${scheduled.map((s) => s.title).join(', ')} scheduled.` : ''
          } Aim for quality over volume — warm up, hit your working sets, and log it when you're done.`
        : `Nothing's scheduled for today on your ${plan.name} plan. A light mobility or active-rest session still counts toward your streak of ${streak} day${streak === 1 ? '' : 's'}.`,
    };
  }

  if (text.includes('goal') || text.includes('track') || text.includes('on track') || text.includes('progress')) {
    const goals = state.goals.map((g) => ({ g, p: goalProgress(state, g) }));
    if (!goals.length) return { text: "You haven't set a goal yet. Add one from the Goals tab and I'll keep you honest." };
    const done = goals.filter((x) => x.p.done).length;
    return {
      text: `You're tracking ${goals.length} goal${goals.length === 1 ? '' : 's'} — ${done} complete. ${goals
        .map((x) => `${x.g.name}: ${x.p.current}/${x.p.target} (${Math.round(x.p.pct)}%)`)
        .join('. ')}.`,
    };
  }

  // default: weekly summary
  const breakdown = categoryBreakdown(state, state.sessions.filter((s) => s.date >= weekRangeStart()));
  const top = breakdown[0];
  return {
    text: `Here's your week: ${week.workouts} workout${week.workouts === 1 ? '' : 's'}, ${formatMinutes(
      week.minutes,
    )} active${week.distance ? `, ${formatDistance(week.distance)} covered` : ''}, and a ${streak}-day streak. ${
      top ? `Most of your time went to ${top.category.name}.` : ''
    } ${streak > 0 ? 'Keep the momentum going — consistency is everything.' : 'Log a session today to start a streak.'}`,
  };
}

function weekRangeStart(): string {
  const d = new Date();
  const day = (d.getDay() + 6) % 7; // Monday = 0
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - day);
  return d.toISOString().slice(0, 10);
}
