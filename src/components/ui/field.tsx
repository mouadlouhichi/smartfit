'use client';

import * as React from 'react';
import { Label } from './label';
import { cn } from '@/lib/utils';

type ControlProps = {
  id?: string;
  'aria-describedby'?: string;
  'aria-invalid'?: boolean;
};

export interface FieldProps {
  /**
   * Stable id for the control (also used as the label's `htmlFor`).
   * Resolution: the child's own id wins, then this prop, then `useId()`.
   * E2E depends on explicit ids (`p-weight`, `log-filter`, …) — pass them here.
   */
  id?: string;
  label: React.ReactNode;
  /** Persistent help text, announced via `aria-describedby`. */
  hint?: React.ReactNode;
  /** Validation message: `role="alert"` + invalid styling on the control. */
  error?: string | null;
  className?: string;
  /** A single form control (Input, Select, …). */
  children: React.ReactElement<ControlProps>;
}

/**
 * The standard labelled-control pattern: label + control + optional hint and
 * error, with the accessibility wiring (htmlFor, aria-describedby,
 * aria-invalid) that hand-stacked fields kept missing. See
 * `docs/design-system.md` §4 for the full contract.
 */
export function Field({ id, label, hint, error, className, children }: FieldProps) {
  const autoId = React.useId();
  const controlId = children.props.id ?? id ?? autoId;
  const hintId = hint ? `${controlId}-hint` : undefined;
  const errorId = error ? `${controlId}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;

  const control = React.cloneElement(children, {
    id: controlId,
    'aria-describedby': describedBy,
    'aria-invalid': error ? true : children.props['aria-invalid'],
  });

  return (
    <div className={cn('grid content-start gap-1.5', className)}>
      <Label htmlFor={controlId}>{label}</Label>
      {control}
      {hint ? (
        <p id={hintId} className="text-muted-foreground text-xs">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} role="alert" className="text-destructive text-xs font-medium">
          {error}
        </p>
      ) : null}
    </div>
  );
}
