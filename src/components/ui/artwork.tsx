'use client';

import { useState, type CSSProperties } from 'react';
import { cn } from '@/lib/utils';

/** Explicit dimensions prevent layout shifts. Tenant images load in the browser, never an SSR proxy. */
export function Artwork({
  src,
  alt = '',
  className,
  style,
  fallback = '/images/branding/strength-cover.webp',
  eager = false,
}: {
  src: string;
  alt?: string;
  className?: string;
  style?: CSSProperties;
  fallback?: string;
  eager?: boolean;
}) {
  return (
    <ArtworkImage
      key={`${src}:${fallback}`}
      src={src}
      alt={alt}
      className={className}
      style={style}
      fallback={fallback}
      eager={eager}
    />
  );
}
function ArtworkImage({
  src,
  alt,
  className,
  style,
  fallback,
  eager,
}: Required<Pick<Parameters<typeof Artwork>[0], 'src' | 'alt' | 'fallback' | 'eager'>> &
  Pick<Parameters<typeof Artwork>[0], 'className' | 'style'>) {
  const [failed, setFailed] = useState(0);
  if (failed >= 2 || (failed > 0 && !fallback))
    return (
      <div
        aria-hidden
        className={cn('bg-gradient-to-br from-lime-300 via-emerald-800 to-slate-950', className)}
        style={style}
      />
    );
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={failed ? fallback : src}
      alt={alt}
      width={1440}
      height={960}
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
      referrerPolicy="no-referrer"
      className={cn('object-cover', className)}
      style={style}
      onError={() => setFailed((n) => n + 1)}
    />
  );
}

/** Original decorative line illustrations, hidden from assistive technology. */
export function WorkspaceIllustration({
  kind = 'training',
  className,
}: {
  kind?: 'training' | 'support' | 'coaching';
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 240 180"
      fill="none"
      aria-hidden="true"
      className={cn('h-36 w-48 shrink-0', className)}
    >
      <ellipse cx="120" cy="152" rx="88" ry="13" fill="currentColor" opacity=".07" />
      <circle cx="120" cy="86" r="66" fill="#b4ef65" opacity=".22" />
      <circle cx="181" cy="37" r="11" fill="#a78bfa" />
      <path
        d="M34 66h14m-7-7v14M193 115h16m-8-8v16"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        opacity=".4"
      />
      {kind === 'support' ? (
        <>
          <rect x="49" y="35" width="125" height="77" rx="19" fill="#172923" />
          <path d="m76 110-7 21 34-21" fill="#172923" />
          <path
            d="M72 58h61M72 72h77M72 86h38"
            stroke="#bef264"
            strokeWidth="6"
            strokeLinecap="round"
          />
          <rect x="122" y="96" width="65" height="43" rx="14" fill="#a78bfa" />
          <circle cx="140" cy="117" r="3" fill="#172923" />
          <circle cx="154" cy="117" r="3" fill="#172923" />
          <circle cx="168" cy="117" r="3" fill="#172923" />
        </>
      ) : kind === 'coaching' ? (
        <>
          <circle cx="89" cy="58" r="20" fill="#a78bfa" />
          <circle cx="150" cy="68" r="17" fill="#bef264" />
          <path d="M52 132v-20a37 37 0 0 1 74 0v20" fill="#172923" />
          <path d="M122 136v-19a30 30 0 0 1 60 0v19" fill="#668e50" />
          <rect x="95" y="100" width="47" height="44" rx="11" fill="#bef264" />
          <path
            d="m108 121 8 8 14-18"
            stroke="#172923"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      ) : (
        <>
          <rect
            x="64"
            y="28"
            width="111"
            height="123"
            rx="18"
            fill="#172923"
            transform="rotate(-8 64 28)"
          />
          <rect x="81" y="47" width="70" height="9" rx="4" fill="#bef264" />
          <path
            d="M83 120V90m24 30V77m24 43V66"
            stroke="#bef264"
            strokeWidth="11"
            strokeLinecap="round"
          />
          <circle cx="169" cy="126" r="26" fill="#a78bfa" />
          <path
            d="m157 126 9 9 16-19"
            stroke="#172923"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      )}
    </svg>
  );
}
