'use client';

import { Fragment, useMemo } from 'react';
import { parseCoachText, type CoachSpan } from '@/lib/coach-text';
import { cn } from '@/lib/utils';

function renderSpans(spans: CoachSpan[]) {
  return spans.map((span, i) =>
    span.code ? (
      <code
        key={i}
        className="bg-secondary rounded-md px-1 py-0.5 font-mono text-[0.85em] whitespace-nowrap"
      >
        {span.text}
      </code>
    ) : span.bold ? (
      <strong key={i} className="font-extrabold">
        {span.text}
      </strong>
    ) : span.italic ? (
      <em key={i}>{span.text}</em>
    ) : (
      <Fragment key={i}>{span.text}</Fragment>
    ),
  );
}

/**
 * Renders a coach answer. Plain React nodes only — model output is never
 * interpreted as HTML — with just enough structure (paragraphs, bullets,
 * bold, inline code) for a real training answer to be readable.
 */
export function CoachText({ text, className }: { text: string; className?: string }) {
  const blocks = useMemo(() => parseCoachText(text), [text]);
  if (blocks.length === 0) return null;
  return (
    <div className={cn('grid gap-2', className)}>
      {blocks.map((block, i) =>
        block.type === 'list' ? (
          <ul key={i} className="grid gap-1.5">
            {block.items.map((item, j) => (
              <li key={j} className="flex gap-2">
                <span
                  className="bg-primary mt-[0.45em] h-1.5 w-1.5 shrink-0 rounded-full"
                  aria-hidden
                />
                <span className="min-w-0 whitespace-pre-line">{renderSpans(item)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p key={i} className="whitespace-pre-line">
            {renderSpans(block.spans)}
          </p>
        ),
      )}
    </div>
  );
}
