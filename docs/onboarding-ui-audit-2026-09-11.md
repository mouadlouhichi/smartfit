# Onboarding UI audit — 2026-09-11

## Scope and method

Focused audit of the five-step web onboarding flow and the shared controls it uses. This is not a whole-product accessibility certification. Inspected source and Chromium screenshots; exercised light/dark themes at 320px, 390px, and 1280px viewport widths. Automated checks use axe WCAG 2 A/AA and 2.1 AA rules, plus interaction, computed-style, layout, and persistence assertions.

## Findings fixed

| Finding | Fix |
| --- | --- |
| Form boundaries nearly disappear into the canvas; unfocused controls have transparent borders. | Onboarding inputs/selects now use card surfaces and explicit contrast-safe borders. Scoped tokens preserve softer decorative borders elsewhere. |
| A global, unlayered `* { border-color: ... }` overrides Tailwind border utilities, including selected and invalid states. | Move the default border color into the base cascade layer so state utilities win. Browser regression asserts the selected border actually matches the primary color. |
| Incomplete progress segments are almost indistinguishable from the canvas. | Use the scoped contrast-safe boundary color. Hide decorative segments from assistive technology; announce the textual step counter. |
| Strategy and goal selections rely on a faint tinted surface/ring, with no accessible selection state. | Solid primary borders/rings, visible checkmarks, `aria-pressed`, and explicit keyboard focus rings. |
| Focus stays on footer navigation after moving to a new step. | Focus the new step heading; announce the step counter. Keep all form controls keyboard reachable. |
| Empty, zero, and negative goal targets can advance to a summary that promises a goal which is never created. | Inline associated error, disabled Continue, and validation at final submission. |
| Weight input uses kg min/max even when displaying pounds. | Convert HTML bounds to the selected unit; allow fractional converted values. Tested 450 lb as a valid target. |
| Back remains enabled while the final setup is saving. | Disable Back during the save to prevent changing steps mid-request. |
| Summary values compete for horizontal space with labels. | Two shrinkable columns, wrapping values, and right alignment; tested with an 80-character name. |
| Open custom select listboxes have no accessible name when labelled through a Field. | Associate each listbox with its trigger, retaining explicit aria-label support. |

## Contrast measurements

WCAG relative luminance ratios, using the CSS sRGB tokens (rounded). Non-text boundaries target at least 3:1.

| Pair | Before | After |
| --- | ---: | ---: |
| Light boundary / canvas | 1.11:1 | 3.62:1 |
| Light boundary / card | — | 4.23:1 |
| Dark boundary / canvas | 1.45:1 | 5.30:1 |
| Dark boundary / card | — | 4.88:1 |
| Light incomplete progress / canvas | 1.03:1 | 3.62:1 |
| Dark incomplete progress / canvas | 1.23:1 | 5.30:1 |

Normal text on settled onboarding screens already passed axe contrast checks before these changes. The principal contrast defects were control identification and selection indicators, which axe text scans alone do not catch. Disabled controls retain standard disabled styling and are exempt from the contrast requirement.

## Verification

- **6 onboarding browser scenarios pass**: all five steps, both themes, three widths.
- **Zero axe violations** in each scanned step and the open weight-unit dropdown after animations settle.
- Browser assertions cover actual input/selection border colors, selected-state uniqueness, Space-key selection, step focus, invalid goal feedback, converted weight bounds, viewport overflow, completion, and dashboard persistence after reload.
- **102 unit tests pass**.
- TypeScript and ESLint for changed TS/TSX files pass.
- Broader existing smoke suite: three scenarios passed; the full dashboard journey timed out at New goal after onboarding and earlier workout/schedule actions. That run was against the development server, not the normal production-build test setup. It is not reported as a passing full-product regression run.

## Limits / follow-up

- Test execution used a locally supplied headless Chromium because the standard Playwright browser download endpoint was unavailable. Repository tests still use the standard Playwright configuration in CI.
- Cloud save failures and in-flight saving interactions were reviewed in source, not verified against a live Firebase account.
- Manual VoiceOver/TalkBack, Safari/iOS keyboard and zoom, and full dashboard visual regression remain follow-up work. Automated axe results are not a substitute for those checks.
