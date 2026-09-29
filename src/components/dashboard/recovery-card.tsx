'use client';

import { useMemo } from 'react';
import { Activity, Heart, Moon, Flame, TrendingUp, AlertTriangle, Plus } from 'lucide-react';
import Link from 'next/link';
import { useStore } from '@/lib/store-context';
import { useModals } from './modal-context';
import { cn } from '@/lib/utils';
import {
  dailyReadiness,
  dailyStrain,
  sleepOn,
  vitalsOn,
  toISODate,
  hasProAccess,
  sleepScore as computeSleepScore,
} from '@smartfit/core';

/**
 * Sonar-inspired tri-ring recovery hero: Sleep · Recovery (HRV/RHR) · Strain.
 * Replaces the volume-only Readiness card when the user has any biometric
 * data, but degrades gracefully to workout-only labels on a fresh account.
 */
export function RecoveryCard() {
  const { state } = useStore();
  const { openWith } = useModals();
  const pro = hasProAccess(state);
  const today = toISODate(new Date());
  const ready = useMemo(() => dailyReadiness(state, today), [state, today]);
  const strain = useMemo(() => dailyStrain(state, today), [state, today]);
  const sleep = sleepOn(state, today);
  const vitals = vitalsOn(state, today);

  const sleepPct = Math.min(100, computeSleepScore(sleep));
  const recPct = ready.score;
  const strainPct = Math.round((strain.score / 21) * 100);

  const labelColor =
    ready.label === 'Optimal'
      ? 'text-emerald-400'
      : ready.label === 'Good'
        ? 'text-primary'
        : ready.label === 'Moderate'
          ? 'text-amber-400'
          : ready.label === 'Low'
            ? 'text-rose-400'
            : 'text-muted-foreground';

  const hasAnyBiometric = !!sleep || !!vitals;

  return (
    <section
      aria-label="Daily recovery"
      className="bg-card rounded-[2rem] p-5 shadow-sm min-[420px]:p-6"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="bg-primary/10 text-primary flex h-9 w-9 items-center justify-center rounded-xl">
            <Activity className="h-4 w-4" aria-hidden />
          </span>
          <div>
            <p className="font-display text-base font-extrabold tracking-tight">
              Recovery <span className={cn('font-bold', labelColor)}>· {ready.label}</span>
            </p>
            <p className="text-muted-foreground text-xs">{ready.recommendation}</p>
          </div>
        </div>
        <button
          onClick={() => openWith({ kind: 'vitals' })}
          className="bg-secondary hover:bg-secondary/80 flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-bold transition-colors"
          aria-label="Log vitals or sleep"
        >
          <Plus className="h-3 w-3" /> Log
        </button>
      </div>

      {/* Tri-ring hero */}
      <div className="mt-5 flex items-center justify-center">
        <TriRing sleep={sleepPct} recovery={recPct} strain={strainPct} />
      </div>

      {/* Ring legend */}
      <div className="mt-4 grid grid-cols-3 gap-2 text-center text-[11px]">
        <RingLegend icon={Moon} label="Sleep" value={`${sleepPct}%`} color="#8b7ad8" />
        <RingLegend icon={Heart} label="Recovery" value={`${recPct}`} color="var(--volt)" />
        <RingLegend
          icon={Flame}
          label="Strain"
          value={`${strain.score.toFixed(1)}/21`}
          color="#f97316"
        />
      </div>

      {/* Strain target band */}
      <div className="mt-5">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Strain target today</span>
          <span className="font-bold">
            {ready.recommendedStrainMin} – {ready.recommendedStrainMax}
          </span>
        </div>
        <div className="bg-secondary relative mt-2 h-2.5 overflow-hidden rounded-full">
          <div
            className="via-primary absolute inset-0 bg-gradient-to-r from-emerald-400 to-rose-400"
            style={{
              clipPath: `inset(0 ${100 - (ready.recommendedStrainMax / 21) * 100}% 0 ${
                (ready.recommendedStrainMin / 21) * 100
              }%)`,
            }}
          />
          <div
            className="bg-foreground absolute top-1/2 h-4 w-1 -translate-y-1/2 rounded-full"
            style={{ left: `${Math.min(100, (strain.score / 21) * 100)}%` }}
            aria-label={`Current strain ${strain.score.toFixed(1)}`}
          />
        </div>
      </div>

      {/* Factor chips */}
      {ready.factors.length > 0 && (
        <ul className="mt-4 grid gap-1.5">
          {ready.factors.map((f, i) => (
            <li key={i} className="text-muted-foreground flex items-start gap-2 text-sm">
              {i === 0 && ready.label === 'Low' ? (
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" />
              ) : (
                <TrendingUp className="text-primary mt-0.5 h-4 w-4 shrink-0" />
              )}
              <span>{f}</span>
            </li>
          ))}
        </ul>
      )}

      {!hasAnyBiometric && (
        <div className="mt-4 rounded-2xl border border-dashed p-3 text-center">
          <p className="text-muted-foreground text-xs">
            Connect wearables or log sleep & HRV for a personalised recovery score.
          </p>
          <div className="mt-2 flex items-center justify-center gap-2">
            <button
              onClick={() => openWith({ kind: 'sleep' })}
              className="bg-secondary hover:bg-secondary/80 rounded-full px-3 py-1 text-xs font-bold"
            >
              Log sleep
            </button>
            <button
              onClick={() => openWith({ kind: 'vitals' })}
              className="bg-secondary hover:bg-secondary/80 rounded-full px-3 py-1 text-xs font-bold"
            >
              Log vitals
            </button>
          </div>
        </div>
      )}

      {/* Vitals snapshot grid */}
      {(vitals?.restingHR || vitals?.hrvRmssd || sleep) && (
        <div className="mt-5 grid grid-cols-4 gap-2 text-center">
          <VitalMini
            label="RHR"
            value={vitals?.restingHR ? `${Math.round(vitals.restingHR)}` : '—'}
            unit="bpm"
          />
          <VitalMini
            label="HRV"
            value={vitals?.hrvRmssd ? `${Math.round(vitals.hrvRmssd)}` : '—'}
            unit="ms"
          />
          <VitalMini
            label="Resp"
            value={vitals?.respiratoryRate ? `${vitals.respiratoryRate.toFixed(1)}` : '—'}
            unit="br/min"
          />
          <VitalMini
            label="SpO₂"
            value={vitals?.spo2 ? `${Math.round(vitals.spo2)}` : '—'}
            unit="%"
          />
        </div>
      )}

      {pro && (
        <Link
          href="/dashboard/progress"
          className="text-primary mt-4 flex items-center justify-center gap-1 text-xs font-bold hover:underline"
        >
          View 28-day recovery trends →
        </Link>
      )}
    </section>
  );
}

function RingLegend({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="flex flex-col items-center gap-1">
      <Icon className="h-4 w-4" style={{ color }} />
      <span className="font-display text-sm font-extrabold tabular-nums" style={{ color }}>
        {value}
      </span>
      <span className="text-muted-foreground text-[10px] font-bold tracking-wider uppercase">
        {label}
      </span>
    </div>
  );
}

function VitalMini({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div className="bg-secondary rounded-xl px-2 py-2">
      <p className="text-muted-foreground text-[10px] font-bold tracking-wider uppercase">
        {label}
      </p>
      <p className="font-display text-lg leading-tight font-extrabold tabular-nums">{value}</p>
      <p className="text-muted-foreground text-[10px]">{unit}</p>
    </div>
  );
}

function TriRing({ sleep, recovery, strain }: { sleep: number; recovery: number; strain: number }) {
  const size = 180;
  const cx = size / 2;
  const cy = size / 2;
  const ring = (r: number, pct: number, color: string, width: number, dash = 0) => {
    const c = 2 * Math.PI * r;
    const len = (Math.max(0, Math.min(100, pct)) / 100) * c;
    return (
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={width}
        strokeLinecap="round"
        strokeDasharray={`${len} ${c}`}
        strokeDashoffset={-dash}
        transform={`rotate(-90 ${cx} ${cy})`}
        opacity={pct > 0 ? 1 : 0.2}
      />
    );
  };

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* Tracks */}
        <circle
          cx={cx}
          cy={cy}
          r={78}
          fill="none"
          stroke="rgba(139,122,216,0.12)"
          strokeWidth={9}
        />
        <circle cx={cx} cy={cy} r={64} fill="none" stroke="rgba(138,210,0,0.12)" strokeWidth={10} />
        <circle cx={cx} cy={cy} r={49} fill="none" stroke="rgba(249,115,22,0.12)" strokeWidth={9} />
        {/* Values */}
        {ring(78, sleep, '#8b7ad8', 9)}
        {ring(64, recovery, 'var(--volt)', 10)}
        {ring(49, strain, '#f97316', 9)}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <p className="text-muted-foreground text-[10px] font-bold tracking-widest uppercase">
          Readiness
        </p>
        <p className="font-display text-4xl font-extrabold tabular-nums">{recovery}</p>
        <p className="text-muted-foreground text-[10px]">/ 100</p>
      </div>
    </div>
  );
}
