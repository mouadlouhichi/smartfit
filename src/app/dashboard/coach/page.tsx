'use client';

import { Sparkles } from 'lucide-react';
import {
  CoachAiToggle,
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
 * about what "this week" means. When an AI endpoint is configured, athletes
 * can opt in to AI answers here; the on-device engine stays the fallback.
 */
export default function CoachPage() {
  const {
    messages,
    send,
    thinking,
    pending,
    aiAvailable,
    aiOn,
    aiHost,
    aiTransport,
    toggleAi,
    stop,
    quickReplies,
    capped,
  } = useCoachConversation();

  return (
    <div className="flex h-[calc(100dvh-140px)] flex-col lg:h-[calc(100dvh-120px)]">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="bg-primary text-primary-foreground shadow-primary/30 flex h-11 w-11 items-center justify-center rounded-full shadow-md">
            <Sparkles className="h-5 w-5" />
          </span>
          <div>
            <h1 className="font-display text-lg leading-tight font-extrabold tracking-tight">
              Your coach
            </h1>
            <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
              <span
                className={`h-2 w-2 rounded-full ${thinking ? 'animate-pulse-soft bg-chart-2' : 'bg-primary'}`}
                aria-hidden
              />
              {thinking
                ? 'Thinking…'
                : aiAvailable && aiOn
                  ? `AI answers on via ${aiHost} — streams as it writes, falls back on-device`
                  : 'Worked out on this device from your own data'}
            </p>
          </div>
        </div>
        {aiAvailable && (
          <CoachAiToggle
            on={aiOn}
            onToggle={toggleAi}
            host={aiHost}
            viaProxy={aiTransport === 'proxy'}
          />
        )}
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
        <CoachFreeLimitNotice show={capped && aiOn && aiAvailable} />
        <CoachComposer onSend={send} disabled={thinking} />
      </div>
    </div>
  );
}
