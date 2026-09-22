# UI/UX + Contrast Audit — 2026-09-22

A full-product pass over every frontend surface (dashboard, run, body, admin,
tenant storefront/console, landing, auth, onboarding): a WCAG contrast audit
computed numerically against the live token values, a UX/keyboard sweep, and a
component modernization to bring the primitives up to the 2026 bar while
keeping the signed-off "Axel" design language intact.

## How it was audited

- **Contrast** — every token pair in `globals.css` (27 tokens × 2 themes) was
  ratio-checked against the surfaces it actually renders on, including
  alpha-composited `text-white/NN` values over the `card-hero` gradient stops
  (`#0d0e0a / #171811 / #1f2117`), charcoal rails, and `/10` badge tints.
- **Tokens vs. reality** — a source scan for hardcoded hex outside
  `globals.css` (251 hits) to find components that had escaped the token
  system.
- **Keyboard/focus** — every raw `<button>` (108) checked for focus styling;
  every `role="tablist"` group checked for the WAI-ARIA tabs pattern.
- **Type** — sub-11px type inventory across all surfaces.

## Findings → fixes

### Contrast defects (all fixed, values verified)

| Where | Was | Now |
| --- | --- | --- |
| Toast success icon, **light theme** | `text-primary` (#161616) on the always-charcoal pill — **1.07:1, invisible** | `text-volt` — 8.7:1 on the pill in both themes |
| DatePicker out-of-range days | `muted-foreground/30` — 1.5:1 (light) / 2.0:1 (dark) | `/70` — 3.1:1 / 5.7:1 (clearly disabled, still perceivable) |
| Today's-workout "% this week" caption | `white/40` on the hero — 3.76:1, sub-AA at 11px | `white/55` — 6.1:1 |
| Run-home weekday labels | `white/45` — 4.38:1 at 10px | `white/55` — 6.1:1 |
| Storefront hero eyebrow | 9px at `white/45` | 10px at `white/55` (6.3:1) |
| Console sidebar micro-labels | 9px | 10px |

The token system itself is **AA-clean**: all 27 tokens pass 4.5:1 text /
3:1 graphics on every surface they're used with, in both themes. Every defect
above came from components that had escaped the tokens.

### Brand coherence — three greens on one screen

The dashboard home was rendering three different greens at once: the brand
volt `#8AD200` (FAB, buttons, badges), a neon `#A8FF00` (28 uses: overview
program tiles, AI-suggested card, Today's-workout switcher/glow), and a
"growth" green `#3AC14E` (5 uses). The neon pass also hardcoded always-dark
surfaces (`#151515`, `#1a1a1a`, `#0e0e0e`) that ignored the theme system.

- All `#A8FF00` → volt tokens (`bg-volt`, `from-volt to-volt-dim`, volt
  glows) — the dashboard home now reads as one brand.
- `#3AC14E` "Growing" chip → `bg-volt/15 text-volt-soft` (12.5:1). The
  muscle-map figure keeps its reference green — it's SVG data, not UI.
- Hardcoded dark surfaces → tokens (`ink-card`, `charcoal-2`, white overlays
  for hovers) so the always-dark hero cards stay in the design system.
- **AI Suggested** rows are now theme-adaptive (`bg-secondary/60`,
  `text-muted-foreground`) instead of forcing black rows inside light cards.
- `tests/design-tokens.test.ts` locks the two off-brand greens out of `src/`.

### Keyboard & focus

- **~100 interactive elements** relied on the browser-default focus ring (no
  design-system indicator). Added a `:focus-visible` baseline in
  `@layer base` (2px `--ring` outline) — components that style focus
  themselves keep their exact look, so nothing double-rings.
- **Six hand-rolled `role="tablist"` groups** (overview programs, workout-day
  switcher, body mode, progress ranges, profile sections, muscle-map view)
  had no arrow-key support. New `useTablist` hook: roving tabindex,
  arrows/Home/End with wrap, automatic activation. Pro-locked ranges take
  focus via `noActivate` without popping the paywall while arrowing.

### 2026 component modernization (all token-driven, no new hex in primitives)

- **Button** — dark-theme primary is now the signature volt CTA
  (volt-soft→volt gradient, ink text, glow, inset highlight), identical to
  the session runner's `.btn-volt`; light theme keeps the ink pill.
- **Card** — layered "soft elevation": ambient shadow pair in light, inset
  light edge + deeper drop in dark (a single `shadow-sm` is invisible on a
  near-black canvas).
- **Progress** — volt energy gradient fill + soft glow in dark.
- **Skeleton** — sheen sweep over the pulse (`skeleton-sheen`,
  reduced-motion aware) so loading reads as "fetching", not "frozen".
- **Toast** — charcoal glass (blur + hairline border).
- **StatCard** — `tabular-nums` so ticking numbers don't jiggle.

## What was deliberately left alone

- The frozen surfaces (dashboard rail, `MobileNav`, global log CTA) per
  `docs/design-system.md`.
- The session runner's always-dark micro-palette (`#edebe6` etc.) — a
  deliberate scoped system, all values contrast-verified on its surfaces.
- The muscle-map reference data colors (pinned by the new test).
- All E2E stability contracts (ids, label copy) — none touched.

## Verification

`pnpm typecheck && pnpm lint && pnpm test` (213 tests, +4 new) and the
production build are green. Every changed color pair was re-verified
numerically against its actual surface, both themes.
