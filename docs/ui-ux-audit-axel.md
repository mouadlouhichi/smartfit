# UI/UX Audit & Redesign — "Axel" design system

Reference: [Axel — Personal Fitness App (Callour Studio, Dribbble)](https://dribbble.com/shots/27304268-Axel-Personal-Fitness-App)

**Design DNA** (extracted from the shot's published palette + screen descriptions):

| Token | Value | Role |
| --- | --- | --- |
| ink | `#050404` | near-black canvas |
| volt | `#8AD200` | electric green — primary accent, CTAs |
| volt-deep | `#699E00` | dark olive green — chips, progress |
| olive | `#575E3C` | muted olive — borders/dividers |
| sage | `#C4C1BB` | warm gray — secondary text |
| gold | `#87764D` | muted gold — tertiary highlight |

Feel: editorial, high-contrast, cinematic ("each workout is a cinematic moment,
not a checklist"). Icon-forward category tiles, full-bleed imagery, circular
timers, difficulty badges, frequency metadata, day-by-day schedules.

## Audit findings (before)

### A. User-reported bugs (reproduced & measured at 390px)

1. **Muscle modal shows "Easy Run"** — `EXERCISES.filter(e => e.muscles.includes(muscle))`
   includes popular distance-measured conditioning entries ("Easy Run", quads/calves;
   "Interval Run"/"Trail Run", quads/glutes) in a *set-based strength* routine.
   Measured routine for Quadriceps: `Barbell Squat, Easy Run(!), Full Squat, Goblet Squat`.
2. **Muscle modal has no exercise GIFs** — routine rows are text-only (`name — N sets`),
   not tappable, no demo imagery, unlike every other exercise list in the app.
3. **Runner modal exceeds mobile width** — the exercise "stepper" filmstrip pills
   render to x≈601 inside a 390px sheet (`overflow-x-auto` + `no-scrollbar`): content
   is cut with zero scroll affordance, reads as a broken/overflowing modal.
4. **Muscle modal UX** — re-renders the *entire* body map inside the sheet (heavy
   duplication), "Sim. today" debug-style control in the header row, unlabelled
   sliders icon, plain list, "Set as Today's workout" CTA crammed under 4 text rows.

### B. Consistency gaps (theme/layout not applied across all app)

- Screen headers differ per screen (plain `h1` + muted subtitle vs. editorial
  eyebrow styles); no shared screen-header component.
- Accent is inconsistent: `--primary`/volt token vs. ~47 hardcoded `#f3ff47` hexes
  (runner, run screens, share cards, pro modal, achievement modal, brand mark…).
- Plan screen category filter is a plain chip row; the reference uses icon-forward
  category tiles with counts.
- Program/session cards lack the reference's difficulty badge + frequency metadata
  pattern (intensity + duration exist but render as plain text rows).

### C. Other UX issues found

- Runner: rest timer is a separate bar disconnected from the main clock; no
  circular countdown (reference centerpiece); active exercise demo is a 64px thumb.
- Runner: "Add exercise" picker always visible at the bottom of the live screen —
  mid-workout clutter.
- Muscle modal: `Sim. today` toggle is confusing next to real data.
- Onboarding/plan cards use `border-volt` + `--primary` ring mix (subtle mismatch).

## Changes

1. **Retheme** to the Axel palette (dark + light), keep AA contrast; route all
   hardcoded accents through tokens.
2. **Muscle modal**: strength-only routine (no distance-measured cardio), GIF
   demo rows (tappable → how-to dialog), compact muscle switcher instead of the
   duplicated full map, Axel styling, 320px-safe.
3. **Runner live screen**: cinematic full-bleed exercise hero, circular ring
   timer (elapsed/rest) with Reps/Weight steppers flanking, next-up queue,
   obvious scroll affordance on the exercise strip, keep every existing feature.
4. **Shared screen header** (eyebrow + title + sub + action) applied to every
   dashboard screen; icon-forward category tiles on Plan; difficulty/intensity
   badges + frequency metadata on program cards.
5. Full pass on modals/nav for the new tokens; verify at 320/360/390px.
