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
   native can't reach (Dialog, Label, Switch, Tabs).
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
| `Button` | `ui/button.tsx` | any action | variants: default / outline / ghost / destructive; `asChild` for links; `zap-glow` class adds the ember pulse |
| `Input` | `ui/input.tsx` | free text, numbers, dates | h-10, rounded-xl; `aria-invalid=true` → destructive border |
| `Select` | `ui/select.tsx` | closed choice sets | styled native `<select>` + chevron; same invalid styling; keep native picker on mobile |
| `Field` | `ui/field.tsx` | **every** labelled control | label + control + hint + error with a11y wiring; see §4 |
| `Label` | `ui/label.tsx` | standalone labels (rare — prefer `Field`) | Radix label; clicking focuses the control |
| `Card` / `CardHeader` / `CardTitle` / `CardContent` | `ui/card.tsx` | grouped content | screen sections; `card-hero` class for heroes |
| `Badge` | `ui/badge.tsx` | small status/meta | `variant="accent"` for highlights |
| `Switch` | `ui/switch.tsx` | boolean toggles | Radix; needs its own visible label |
| `Dialog` | `ui/dialog.tsx` | modals | via `modal-context` / `confirm-context` only |
| `Tabs` | `ui/tabs.tsx` | in-page views | body screen measurement families |
| `Progress` | `ui/progress.tsx` | goal/completion bars | pair with a numeric label |
| `Skeleton` | `ui/skeleton.tsx` | loading placeholders | hydration shells |

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

| State | Treatment |
| --- | --- |
| default | `h-10 rounded-xl border-input bg-background shadow-sm text-sm` |
| focus-visible | `border-ring` + 2px ring (`focus-visible:ring-ring`) |
| invalid | `aria-[invalid=true]:border-destructive` |
| disabled | `opacity-50 cursor-not-allowed` |
| size overrides | via `className` (twMerge wins, e.g. `h-9 w-40` on the body chart select) |

## 6. Accessibility contract

- Visible label for **every** control (`Field` guarantees it); `aria-label` only
  where a visible label is genuinely impossible (e.g. the chart unit `Select`).
- Hints/errors are associated, not adjacent decoration (`aria-describedby`).
- Errors: `role="alert"` so screen readers announce on commit.
- Contrast: all token inks are AA in light and dark themes (`--primary #bd4220`,
  `--muted-foreground #65635d` light; `--accent-foreground #f2c4ae` dark).
- Motion: `ember-glow`/`dot-typing` keyframes honor `prefers-reduced-motion`.

## 7. Stability contracts (E2E)

| Kind | Values |
| --- | --- |
| Profile field ids | `p-name`, `p-plan`, `p-gym`, `p-weight`, `p-target-weight`, `p-distance`, `p-weekstart`, `p-rest` |
| Other ids | `plan-strategy`, `log-filter`, `body-measurement` |
| Test ids | `import-suggested-week` |
| Label-copy locators | `Title`, `Minutes`, `Notes`, `What should we call you?` (modals/onboarding — treat as frozen strings) |
| Frozen strings | `New goal`, `Log measurement`, `Schedule session`, `Export JSON`, `Erase everything`, `Send`, `Train this week`, `Body weight trend`, `Message your coach`, `Load earlier workouts`, `Load earlier measurements` |

## 8. Adoption status

- **Migrated to `Field`:** Profile screen (all 8 settings incl. target-weight
  validation), Plan screen strategy picker.
- **Conforming, migration pending (mechanical, zero visual change):** the six
  dashboard modals (`WorkoutModal` ×9 fields, `ScheduleModal` ×6, `GoalModal` ×4,
  `BodyModal` ×4, `CategoryModal` ×3, `SessionDetailModal` ×1), onboarding,
  auth screens. They already use `Label htmlFor` + stable ids, so they satisfy
  the a11y contract; adopting `Field` adds `aria-describedby`/error slots.

## 9. Adding a new component — checklist

1. Does a primitive already cover it? Extend via `className`/props first.
2. Tokens only — no hex, no raw px beyond the spacing scale.
3. `forwardRef` + spread native props + `cn()` (twMerge) last-wins overrides.
4. All five states: default / hover / focus-visible / disabled / invalid (if a
   form control).
5. A11y: label strategy, `aria-describedby`, keyboard path, reduced-motion.
6. Add a row to §3 (and §7 if it carries ids/copy E2E touches).
7. Verify: `pnpm typecheck && pnpm lint && pnpm exec prettier --check . && pnpm build`,
   then CI (E2E smoke runs the real flows).
