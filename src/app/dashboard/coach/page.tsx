'use client';

import Link from 'next/link';
import { ArrowLeft, Sparkles } from 'lucide-react';
import {
  CoachAiSource,
  CoachComposer,
  CoachFreeLimitNotice,
  CoachMessages,
  CoachQuickReplies,
  useCoachConversation,
} from '@/components/dashboard/coach-panel';

/**
 * Full-screen coach. Shares the exact conversation logic used by the compact
 * dashboard panel, which in turn delegates every answer to `answerCoach` in
 * @smartfit/core — so the two surfaces can no longer drift apart or disagree
 * about what "this week" means. It answers with AI when the deployment has a
 * provider configured, and with the on-device engine when it does not (or when
 * the provider fails); there is no switch to flip.
 */
export default function CoachPage() {
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
    <div className="flex h-[calc(100dvh-140px)] flex-col lg:h-[calc(100dvh-120px)]">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          {/* The bottom nav hides itself on this route, so this is the only
              way back on a phone. */}
          <Link
            href="/dashboard"
            aria-label="Back to dashboard"
            className="bg-secondary hover:bg-secondary/70 grid h-11 w-11 shrink-0 place-items-center rounded-full transition-colors lg:hidden"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <span className="bg-primary text-primary-foreground shadow-primary/30 hidden h-11 w-11 shrink-0 items-center justify-center rounded-full shadow-md lg:flex">
            <Sparkles className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h1 className="font-display text-lg leading-tight font-extrabold tracking-tight">
              Your coach
            </h1>
            <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
              <span
                className={`h-2 w-2 rounded-full ${thinking ? 'animate-pulse-soft bg-chart-2' : 'bg-primary'}`}
                aria-hidden
              />
              <span className="truncate">
                {thinking
                  ? 'Thinking…'
                  : aiAvailable
                    ? `AI via ${aiHost}`
                    : 'Answered on this device'}
              </span>
            </p>
          </div>
        </div>
        {aiAvailable && <CoachAiSource host={aiHost} viaProxy={aiTransport === 'proxy'} />}
      </div>

      <CoachMessages
        messages={messages}
        pending={pending}
        aiHost={aiHost}
        onStop={stop}
        className="border-border bg-card/60 rounded-3xl border p-4"
      />

      <div className="mt-3">
        <CoachQuickReplies replies={quickReplies} onPick={send} disabled={thinking} />
      </div>

      <div className="mt-2">
        <CoachFreeLimitNotice show={capped && aiAvailable} />
        <CoachComposer onSend={send} disabled={thinking} />
      </div>
    </div>
  );
}
