# Storefront UI refresh

The public `/g/[slug]` page now has a sticky gym navigation, shared branded hero,
image-led class discovery, class-type/date timetable filters, membership pricing
cards, member space, published gallery, location/contact details and weekly hours.
Mobile includes a collapsible keyboard-accessible menu and fixed class/membership
shortcuts. Light and dark themes remain available.

## Preserved behavior

- Owner draft preview and published hero share `StorefrontHero`: logo shape, accent,
  uploaded/preset cover, crop position, split/banner/minimal layout, amenities and CTA.
- Classes, plans, counts and hours come from the current tenant. Bundled class/cover
  images are explicitly illustrative; no invented reviews or activity metrics.
- Existing join, booking, waitlist, cancellation and aggregate-sharing flows remain.
- Online plan requests create draft invoices for desk collection, not paid memberships.
  View-as remains read-only.
- Signed-out cloud visitors receive an explicit sign-in action in the member section.
  Partial live-data errors remain visible with retry, rather than hiding available data.
- Browser-local schedule dates and member data render after hydration to prevent
  independently timed demo fixtures or server/browser timezone differences from
  causing a hydration mismatch. Public identity, class discovery and pricing remain
  server rendered.
- Contact links use fixed, validated schemes; map search encodes the gym address.

## Verification (2026-09-22)

- 25 Playwright checks passed: tenant journeys (20), branding (3), new storefront (2).
- 488 unit/server tests passed: web (209), core (265), server (14).
- Web typecheck passed. Lint passed with one pre-existing profile-screen image warning.
- Explicit `SMARTFIT_DEPLOYMENT=demo` production build passed.
- Desktop light/dark and mobile captures inspected; mobile overflow and menu keyboard
  focus/shortcuts tested. Branding image-load/publish regression passed.

Tenant tests now target the storefront h1 instead of every gym-name heading. The
attendance test targets `slot-live-hiit` explicitly rather than assuming the first
class of the current weekday is the fixture intended by the test.

These checks use demo fixtures. No deployment, live Firebase verification, payment
provider verification or production certification was performed.

## Landing-style motion follow-up

- Tenant-accent ambient gradients and a blueprint grid behind the page and hero.
- Lightweight rotating SVG wireframe artwork inspired by the landing page sphere.
- Bounded scroll/fine-pointer parallax on cover imagery only; text and booking controls
  remain stationary. Touch devices do not receive pointer tilt.
- An editorial “Make room for more” section with a looping ribbon using the current
  gym's class disciplines, plus one-shot section entrances and class-card hover depth.
- Navigation includes a pause/resume button. System reduced-motion preferences take
  precedence, including changes made while the page is open. Hidden tabs stop motion;
  hero/statement loops pause outside the viewport. The owner draft preview is static.
- Decorative layers ignore pointer events and are hidden from assistive technology.
  Content is never initially hidden by reveal CSS, including with JavaScript disabled.
- No animation dependencies, video assets or continuously running JavaScript render
  loop were added. Parallax batches scroll/pointer work into requestAnimationFrame.

Follow-up verification: 14 browser checks passed (4 new motion checks, 2 storefront,
3 branding, 5 tenant/member journey regressions), 209 web unit tests, web typecheck,
lint (the existing profile-screen image warning only), and explicit demo production
build. Desktop dark and mobile light visuals inspected. Not deployed or live-Firebase
verified.
