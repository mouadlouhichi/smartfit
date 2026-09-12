# SmartFit Design System

The reusable-component contract for the web app: what exists, how the pieces
compose, and the rules that keep screens consistent (and the E2E suite green).

> **Frozen surfaces.** The dashboard sidebar/rail (`dashboard-shell.tsx`),
> `MobileNav`, and the global log CTA are deliberate, previously signed-off
> designs. They are **out of scope** for this system — do not restyle them as
> part of component work.

---

## 1. Principles

1. **One pattern per job.** A form field is always a `Field`; a destructive
   choice always goes through `useConfirm`; a screen hero is always `card-hero`.
   No hand-stacked lookalikes.
2. **Native controls first.** `<input>`, `<select>`, `<button>` under the hood —
   mobile pickers, autofill, and keyboard behavior come free. Radix only where
   native can't reach (Dialog, Label, Switch, Tabs). **Exception: dates.** A
   native `<input type="date">` opens the browser's picker overlay on some
   devices as soon as the dialog mounts, so log modals use the `DatePicker`
   primitive (a closed-by-default trigger) instead.
3. **Tokens over one-offs.** Colors/radii/ink come from the CSS custom
   properties in `globals.css` (AA-contrast in light *and* dark). Components
   never hardcode hex values.
4. **Accessibility by construction.** Every control has a visible label; hints
   and errors are announced (`aria-describedby`); invalid state is exposed to AT
   (`aria-invalid`) *and* visible (destructive border).
5. **Stability contracts are API.** E2E locates fields by **label text** and
   **stable ids** (`p-weight`, `log-filter`, …). Renaming either is a breaking
   change — update `e2e/smoke.spec.ts` in the same PR.

## 2. Layers

```
tokens        globals.css  — CSS custom properties, keyframes, .card-hero/.hero-tile
primitives    components/ui/*  — Button, Input, Select, Field, Label, Card, Badge,
                                 Switch, Dialog, Tabs, Progress, Skeleton
patterns      Field (label+control+hint+error), MetaChip, StatTile, EmptyState,
              confirm dialog (useConfirm), modal shells (modal-context)
screens       components/dashboard/screens/*, auth, onboarding, landing
```

## 3. Component catalog

| Component | File | When to use | Notes |
| --- | --- | --- | --- |
| `Button` | `ui/button.tsx` | any action | variants: default / outline / ghost / destructive; `asChild` for links; `zap-glow` class adds the volt pulse; mobile-first sizes — default h-11, sm h-9, icon 44px, compacted on sm+ |
| `Input` | `ui/input.tsx` | free text, numbers | h-11 + 16px type on mobile (no iOS focus zoom), h-10 + text-sm on sm+, rounded-xl; `aria-invalid=true` → destructive border |
| `Select` | `ui/select.tsx` | closed choice sets | styled native `<select>` + chevron; same invalid styling; keep native picker on mobile |
| `DatePicker` | `ui/date-picker.tsx` | **every** date field | trigger styled like `Select`; the calendar popover is closed until pressed (native date inputs auto-open theirs on some devices). Month paging, Today/Yesterday quick picks, arrow/Home/End keyboard grid, `max` (default today) and `min` bounds, `weekStartsOn` follows the profile |
| `Field` | `ui/field.tsx` | **every** labelled control | label + control + hint + error with a11y wiring; see §4 |
| `Label` | `ui/label.tsx` | standalone labels (rare — prefer `Field`) | Radix label; clicking focuses the control |
| `Card` / `CardHeader` / `CardTitle` / `CardContent` | `ui/card.tsx` | grouped content | screen sections; `card-hero` class for heroes |
| `Badge` | `ui/badge.tsx` | small status/meta | `variant="accent"` for highlights |
| `Switch` | `ui/switch.tsx` | boolean toggles | Radix; needs its own visible label |
| `Dialog` | `ui/dialog.tsx` | modals | mobile bottom sheet (grabber + swipe-to-dismiss + sticky `DialogFooter` action bar), centered dialog on sm+; via `modal-context` / `confirm-context` only; bespoke dark sheets (Pro) use `hideHandle`/`hideClose` + `SheetHandle` + a pinned `DialogFooter` |
| `Tabs` | `ui/tabs.tsx` | in-page views | body screen measurement families |
| `Progress` | `ui/progress.tsx` | goal/completion bars | pair with a numeric label |
| `Skeleton` | `ui/skeleton.tsx` | loading placeholders | hydration shells |
| `Toast` (`ToastProvider` / `useToast`) | `ui/toast.tsx` | transient action feedback | floating charcoal pill, bottom-center (above mobile nav, left of the desktop CTA); ≤3 stacked, auto-dismiss 3.6 s, `role="status"` + `aria-live="polite"` |

## 4. `Field` — the form-field system

### Anatomy

```
┌ Field ─────────────────────────────────┐
│ Label (htmlFor → control id)           │
│ ┌ Control (Input / Select / …) ──────┐ │   ← aria-describedby="hint error"
│ └────────────────────────────────────┘ │   ← aria-invalid when error
│ hint  (muted xs, optional)             │
│ error (destructive xs, role="alert")   │
└────────────────────────────────────────┘
```

### Props

| Prop | Type | Behavior |
| --- | --- | --- |
| `label` | `ReactNode` | rendered in the shared `Label` (text-sm font-medium) |
| `id` | `string?` | control id. Resolution: **child's own `id` → `Field.id` → `useId()`** — explicit ids (the E2E contract) always win |
| `hint` | `ReactNode?` | persistent help text; associated via `aria-describedby` |
| `error` | `string?` | validation message; `role="alert"`, flips control to invalid styling; hint and error may coexist |
| `className` | `string?` | wrapper overrides (e.g. `sm:col-span-2`) |
| `children` | single control element | cloned with `id`, `aria-describedby`, `aria-invalid` injected |

### Rules

- Always pass the stable id on `Field` (`<Field id="p-weight" …>`), never on the
  child, so the id lives next to the label copy it belongs to.
- `error` beats silent clamping: if a value is out of range, say so — don't
  quietly rewrite what the user typed (see Profile → target weight).
- Grid pages keep the field grid (`sm:grid-cols-2`); `Field` is one cell.

## 5. Control visual contract

Shared by `Input` and `Select` (kept byte-identical in their class strings):

Soft-fill pills — controls sit *on* cards as tinted chips (the same visual
family as `MetaChip`/segmented controls), never as bordered browser defaults:

| State | Treatment |
| --- | --- |
| default | `h-11 rounded-xl border-transparent bg-secondary text-base font-medium sm:h-10 sm:text-sm` (no shadow) |
| hover | `bg-secondary/70` |
| focus-visible | surface lifts to `bg-background` + `border-ring` + 2px ring |
| invalid | `aria-[invalid=true]:border-destructive bg-destructive/5` |
| disabled | `opacity-50 cursor-not-allowed` |
| size overrides | via `className` (twMerge wins — the base now carries `sm:` resets, so pin both variants, e.g. `h-12 sm:h-12`) |

Freeform multi-line entry (coach composer) mirrors the same fill:
`bg-secondary rounded-2xl` textarea with the identical focus ring.

## 6. Accessibility contract

- Visible label for **every** control (`Field` guarantees it); `aria-label` only
  where a visible label is genuinely impossible (e.g. the chart unit `Select`).
- Hints/errors are associated, not adjacent decoration (`aria-describedby`).
- Errors: `role="alert"` so screen readers announce on commit.
- Contrast: all token inks are AA in light and dark themes (dark `--primary #f3ff47`
  always carries `--primary-foreground #101010`; light `--primary` is ink `#161616`).
- Motion: `volt-glow`/`dot-typing` keyframes honor `prefers-reduced-motion`.

## 7. Stability contracts (E2E)

| Kind | Values |
| --- | --- |
| Profile field ids | `p-name`, `p-plan`, `p-gym`, `p-weight`, `p-target-weight`, `p-distance`, `p-weekstart`, `p-rest` |
| Other ids | `plan-strategy`, `log-filter`, `body-measurement` |
| Test ids | `import-suggested-week` |
| Label-copy locators | `Title`, `Minutes`, `Notes`, `What should we call you?` (modals/onboarding — treat as frozen strings) |
| Frozen strings | `New goal`, `Log measurement`, `Schedule session`, `Export JSON`, `Erase everything`, `Send`, `Train this week`, `Body weight trend`, `Message your coach`, `Load earlier workouts`, `Load earlier measurements` |

## 8. Adoption status

- **Migrated to `Field`:** Profile (8 settings + target-weight range error),
  Plan (strategy picker), all dashboard modals — `WorkoutModal` (date/type/
  title/minutes/intensity/distance/notes + minutes range error, date via
  `DatePicker`),
  `ScheduleModal` (title/type/day/time/minutes/intensity + minutes error),
  `GoalModal` (name/track/reset/target + target error), `BodyModal` (date/
  measurement/name/value + value error), `CategoryModal` (name + name error),
  onboarding (about-you incl. optional target weight, strategy incl. optional
  gym, goal target), login (Name).
- **Deliberate exceptions (bespoke rows, still a11y-conformant via `Label htmlFor`):**
  login email/password (leading icon, "Forgot password?" inline action),
  profile password-confirm (label carries helper copy, input sits in a button
  row), `CategoryModal` icon/color pickers and `SessionDetailModal` notes
  (group labels / read-only, not single controls), the read-only "est. burn"
  tile/strip in `WorkoutModal` (a live estimate, not an input).
- **Error-state rule now enforced everywhere:** forms never silently coerce
  (`|| 1`, quiet `return`) — invalid input sets the `Field` error and stays put.

## 9. Adding a new component — checklist

1. Does a primitive already cover it? Extend via `className`/props first.
2. Tokens only — no hex, no raw px beyond the spacing scale.
3. `forwardRef` + spread native props + `cn()` (twMerge) last-wins overrides.
4. All five states: default / hover / focus-visible / disabled / invalid (if a
   form control).
5. A11y: label strategy, `aria-describedby`, keyboard path, reduced-motion.
6. Add a row to §3 (and §7 if it carries ids/copy E2E touches).
7. Custom classes in `globals.css` are unlayered and beat Tailwind utilities —
   never set `position`/`display` there; call sites add their own utilities.
8. Verify: `pnpm typecheck && pnpm lint && pnpm exec prettier --check . && pnpm build`,
   then CI (E2E smoke runs the real flows).
