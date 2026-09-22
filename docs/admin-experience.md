# Admin experience upgrade

## Benchmark and scope — 21 September 2026

The benchmark is operational depth, not a copy of another product's visual design:

- Glofox describes unified reporting, multi-location oversight, memberships, scheduling, billing and CRM in its operator offering. [4](https://www.glofox.com/blog/best-gym-management-software/)
- Wodify describes member segmentation, reporting, attendance, billing, communication and workflow automation. [5](https://www.wodify.com/blog/best-fitness-studio-software)
- Gymdesk describes dashboard/template customization alongside member administration, billing, scheduling and reporting. [2](https://gymdesk.com/blog/management-software-definition)

These are vendor descriptions, not independent product testing. They informed the priorities below; they are not claims of feature parity.

## Shipped in this pass

| Surface | Improvement |
| --- | --- |
| Platform shell | Persistent desktop sidebar, accessible mobile navigation dialog, theme switch, refresh and explicit demo/cloud indicators. Loading and diagnostics remain visible instead of rendering empty metrics after an error. |
| Overview | KPI band, six-month collection chart, lifecycle donut, MRR-by-plan bars, prioritized follow-ups and recent activity. Operators can hide/show widgets and reset their layout. |
| Gym registry | Search by gym/city/owner, status and plan filters, sort by membership/name/date, table and card views, 12-row pagination, CSV of all matching loaded rows. |
| Gym detail | Public-profile snapshot, payment recording at the current plan price, gym-specific audit history, confirmation before suspend/close. Existing owner/plan management and read-only view-as remain intact. |
| Applications | Pending/approved/rejected/all views with counts and search; existing provisioning and review actions retained. |
| Revenue | Collection explorer with period, currency, method and text filters; monthly chart, method breakdown, payment table and CSV export. |
| Audit | Search by action/target/operator, action and time-window filters, expandable metadata, CSV export. |
| Gym members | Search, status/at-risk/renewing-soon segments, member profile dialog, internal notes editing, check-in/freeze/reactivate, owner-visible recent invoices and CSV export. |
| Storefront studio | Name, tagline, description, brand palettes/custom color, HTTPS logo/cover URLs, public contacts, location and seven-day opening hours. Copy Monday to weekdays, responsive preview, validation, discard and explicit publish. |
| Public storefront | Uses the same hero as the editor, contrast-aware text, logo/cover rendering with safe URL filtering, all seven opening days, WhatsApp text, and an operator-only console link. |

## Persistence and authorization

- Dashboard widget preferences are **browser-local only** (`smartfit:admin:widgets:v1`). They do not alter platform configuration or another operator's view.
- Cloud profile edits use the existing `gyms/{slug}` profile write, through `TenantProvider.updateGym`. The editor's patch contains only name, branding, contact, location and hours. No second gym registry, personal custom-gym model or new data service was introduced.
- Member notes use the existing gym membership document and `saveMembership`; Firestore operator rules remain authoritative. Notes are not rendered in the member UI (this is not a new per-field privacy boundary).
- Platform mutations still use the existing authenticated admin endpoints. Every API continues verifying the platform claim. CSV exports only contain records already available to the authorized operator.
- View-as remains read-only. Demo mutations remain session-only and are explicitly labeled. Client navigation between storefront and console retains that session; a hard reload does not.
- CSV values are quoted/escaped, UTF-8 encoded and formula-like strings prefixed with an apostrophe. Quoting alone would not prevent spreadsheet formula injection.

## Reporting boundaries

The upgrade does **not** silently turn bounded snapshot queries into a historical warehouse:

- Registry: up to 200 gyms. Pagination, filters and exports apply to the loaded registry.
- Platform payments: latest 100 records. Charts and exports explicitly describe their loaded-record scope.
- Audit: latest 50 events. Gym-specific timelines filter that same window.
- Applications: latest 100 requests.
- Monthly collection charts are derived from payment timestamps, not invented growth percentages or historical MRR snapshots.
- The collection explorer separates currencies. Recording a payment records money received; it does not charge a card or initiate a transfer.

## Asset/editor boundaries

Image uploads are not implemented: owners supply public HTTPS URLs for assets they have permission to use. Assets load in the browser, not through an unrestricted server image-fetch proxy. Invalid protocols/embedded credentials are rejected, failed images fall back to the color hero, and logo/cover fields can be cleared. Opening hours currently represent a single same-day interval; overnight and split shifts are not supported.

## Deliberately left for a subsequent phase

- CRM lead pipelines, consent-aware email/SMS campaigns and delivery providers.
- Automated renewal reminders, background jobs and delivery history.
- Refunds, recurring payment collection, financial reconciliation and full historical reports.
- Bulk lifecycle changes, bulk member import with validation/rollback, and server-side cursor pagination.
- Large asset uploads with storage rules and quotas; custom-domain provisioning; native white-label applications. Small logo imports are now supported directly in the gym profile (see `gym-branding.md`).

These need backend workflows, provider configuration, or billing/privacy decisions. No placeholder controls pretend to perform them.

## Verification

- Root tests: 166 passed, including CSV injection defenses, analytics bucketing/triage, image URL validation, public-profile boundaries and opening-hour validation.
- Core tests: 239 passed.
- TypeScript check and production build passed.
- ESLint: no errors; one existing image warning in the unrelated dashboard profile screen.
- Chromium: all 28 B2B browser tests passed against the production build in demo mode (20 existing journeys plus 8 new console tests). Existing tests were corrected for the design-system listbox, exact labels, lifecycle confirmation and session-preserving demo navigation.
- Desktop admin/studio screenshots inspected; mobile overview and studio checked at 390px without page-level horizontal overflow.
- The normal Playwright CDN was unavailable in this sandbox. Browser checks used an ephemeral Chromium binary and supporting libraries outside the repository; no browser runtime dependency or sandbox-specific test configuration was added to the product.

Live Firestore writes and the Vercel deployment still require verification with the configured project; demo browser tests do not establish production credential validity.
