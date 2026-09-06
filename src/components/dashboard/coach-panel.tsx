'use client';

import { useEffect, useRef, useState } from 'react';
import { Sparkles, Mic } from 'lucide-react';
import { useStore } from '@/lib/store-context';
import {
  currentStreak,
  thisWeek,
  goalProgress,
  formatCalories,
  formatMinutes,
  formatDistance,
  relativeDay,
  getPlan,
  todaysFocus,
  type FitnessState,
} from '@smartfit/core';
import { cn } from '@/lib/utils';

interface Chip {
  label: string;
  kcal: string;
}
interface Reply {
  text: string;
  chips?: Chip[];
}

const QUICK = ['Start workout', 'Log water', 'How did I sleep?', 'Calories today'];

function weekRangeStart(): string {
  const d = new Date();
  const day = (d.getDay() + 6) % 7;
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - day);
  return d.toISOString().slice(0, 10);
}

function coachReply(q: string, state: FitnessState): Reply {
  const text = q.toLowerCase();
  const week = thisWeek(state);
  const streak = currentStreak(state);
  const plan = getPlan(state.profile.planId);
  const focus = todaysFocus(state);

  if (state.sessions.length === 0) {
    return {
      text: `Welcome! Your plan is "${plan.name}". Tap the bolt to log your first workout and I'll track calories, streaks and trends for you.`,
    };
  }

  if (text.includes('calor') || text.includes('burn') || text.includes('kcal')) {
    const weekSessions = state.sessions.filter((s) => s.date >= weekRangeStart());
    const byCat = new Map<string, number>();
    for (const s of weekSessions) byCat.set(s.categoryId, (byCat.get(s.categoryId) ?? 0) + s.calories);
    const chips: Chip[] = [...byCat.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([catId, kcal]) => ({
        label: state.categories.find((c) => c.id === catId)?.name ?? 'Activity',
        kcal: formatCalories(kcal),
      }));
    return {
      text: `You burned ${formatCalories(week.calories)} across ${week.workouts} activities this week.`,
      chips: chips.length ? chips : undefined,
    };
  }

  if (text.includes('start') || text.includes('workout') || text.includes('today') || text.includes('train')) {
    return {
      text: focus
        ? `Today's focus is ${focus}. Ready when you are — tap the bolt to log it and keep your ${streak}-day streak going.`
        : `Nothing scheduled today on ${plan.name}. A light session still counts toward your ${streak}-day streak.`,
    };
  }

  if (text.includes('goal') || text.includes('track') || text.includes('on track')) {
    const goals = state.goals.map((g) => ({ g, p: goalProgress(state, g) }));
    if (!goals.length) return { text: "You haven't set a goal yet. Add one from Goals and I'll keep you honest." };
    return {
      text: goals
        .map((x) => `${x.g.name}: ${x.p.current}/${x.p.target} (${Math.round(x.p.pct)}%)`)
        .join('. ') + '.',
    };
  }

  if (text.includes('water')) return { text: 'Hydration logging is on the roadmap — for now, aim for 30–35ml per kg of body weight.' };
  if (text.includes('sleep') || text.includes('recover')) {
    return { text: 'Aim for 7–9 hours after hard sessions. Stretching post-workout helps sleep quality — set an evening routine.' };
  }

  const latest = state.sessions[0];
  return {
    text: `${week.workouts} workout${week.workouts === 1 ? '' : 's'} · ${formatMinutes(week.minutes)} active${
      week.distance ? ` · ${formatDistance(week.distance)}` : ''
    } this week${latest ? ` — last was ${relativeDay(latest.date)} (${formatCalories(latest.calories)})` : ''}. Consistency is everything.`,
  };
}

export function CoachPanel({ className }: { className?: string }) {
  const { state } = useStore();
  const [messages, setMessages] = useState<{ id: number; role: 'user' | 'coach'; text: string; chips?: Chip[]; time: string }[]>(
    [],
  );
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const idRef = useRef(0);

  useEffect(() => {
    const now = new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    setMessages([
      {
        id: idRef.current++,
        role: 'coach',
        text: 'You burned 420 kcal across 3 activities this week. Ask me anything about your training.',
        chips: [
          { label: 'Running', kcal: '120kcal' },
          { label: 'Push up', kcal: '200kcal' },
        ],
        time: now,
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
    const time = new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    const reply = coachReply(q, state);
    setMessages((m) => [
      ...m,
      { id: idRef.current++, role: 'user', text: q, time },
      { id: idRef.current++, role: 'coach', ...reply, time },
    ]);
    setInput('');
  }

  return (
    <div
      className={cn(
        'flex h-full min-h-[560px] flex-col overflow-hidden rounded-[2rem] border border-border bg-card/70 shadow-sm',
        className,
      )}
    >
      {/* Header */}
      <div className="flex justify-center pt-5">
        <span className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-bold text-white shadow-md shadow-primary/30">
          <Sparkles className="h-4 w-4" /> AI Chatbot
        </span>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-5 py-6">
        {messages.map((m) => (
          <div key={m.id} className={cn('flex flex-col', m.role === 'user' ? 'items-end' : 'items-start')}>
            <div
              className={cn(
                'max-w-[88%] rounded-3xl px-4 py-3 text-sm font-medium leading-relaxed shadow-sm',
                m.role === 'user'
                  ? 'rounded-tr-md bg-secondary text-foreground'
                  : 'rounded-tl-md border border-border bg-card text-foreground',
              )}
            >
              {m.text}
            </div>
            {m.chips && (
              <div className="mt-3 flex gap-3 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {m.chips.map((c, i) => (
                  <div
                    key={i}
                    className="flex min-w-[120px] items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 shadow-sm"
                  >
                    <span className="flex-1">
                      <span className="block text-xs font-medium text-muted-foreground">{c.label}</span>
                      <span className="block text-sm font-extrabold text-foreground">{c.kcal}</span>
                    </span>
                    <MiniRing pct={55 + i * 20} />
                  </div>
                ))}
              </div>
            )}
            <span className="mt-1 px-1 text-[11px] text-muted-foreground">
              {m.role === 'user' ? '' : '2 hours ago'}
            </span>
          </div>
        ))}
      </div>

      {/* Quick chips */}
      <div className="flex gap-2 overflow-x-auto px-5 pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {QUICK.map((q) => (
          <button
            key={q}
            onClick={() => send(q)}
            className="whitespace-nowrap rounded-full border border-border bg-card px-4 py-2 text-xs font-semibold text-clay transition-colors hover:border-primary hover:text-primary"
          >
            {q}
          </button>
        ))}
      </div>

      {/* Input */}
      <div className="flex items-center gap-2 p-4 pt-1">
        <div className="flex flex-1 items-center gap-2 rounded-full border border-border bg-card px-5 py-3 shadow-sm">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && send(input)}
            placeholder="Type something.."
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          <button
            aria-label="Voice"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-muted-foreground"
          >
            <Mic className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

function MiniRing({ pct }: { pct: number }) {
  const r = 15;
  const c = 2 * Math.PI * r;
  return (
    <svg width="40" height="40" viewBox="0 0 40 40" className="-rotate-90">
      <circle cx="20" cy="20" r={r} fill="none" stroke="var(--secondary)" strokeWidth="4" />
      <circle
        cx="20"
        cy="20"
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
