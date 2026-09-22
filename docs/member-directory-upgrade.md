# Member directory and “View as gym” correction

## Corrected data paths

Two code paths could produce a non-zero admin count and an apparently empty gym:

1. The tenant provider committed its roster only after a shared `Promise.all` also loaded invoices, bookings, progress sharing and personal visits. Any unrelated permission/index error discarded a successful roster read. The console did not show that data-load error.
2. The admin registry counted all non-team membership documents, while the directory only showed explicit `role: 'member'` rows. Missing/legacy role fields could therefore be counted but invisible.

The provider now settles sections independently, retains the current-request guard against stale private reads, and skips personal-account queries for view-as sessions and administrators without a membership. Member loading/error/ready states are explicit: a failed read displays an error and Retry, never a confirmed zero. Other section errors are also visible in the console.

`isGymCustomer` shares the display/count classification between the registry and directory. It excludes owner/staff/trainer rows; legacy/unclassified rows remain visible with an explanation and disabled profile mutations. **This classification grants no authorization and performs no data migration.** Existing membership-based authorization and Firestore rules remain the boundary. Inspect/repair legacy role records through the reviewed team-access process.

Demo registry counts for gyms with tenant fixtures derive from those fixtures, rather than separate hard-coded numbers. View-as is read directly from the current URL in both demo and cloud mode, so read-only controls cannot be missed during hydration or client navigation.

## Interface

- Desktop workspace sidebar and responsive mobile navigation, with a clear read-only banner.
- Real member totals, active/trial, upcoming renewals and at-risk summaries. No fabricated growth numbers.
- Search, status filters, sort, table/card switch, eight-row display pagination and export of **all matching** records (not only the visible page).
- More detailed rows, member monograms, plan/status indicators, membership breakdown and contextual follow-up filter.
- Profile dialog retains working notes, check-in and status actions; mutating controls are disabled in view-as mode and for unclassified records.
- Browser-side pagination improves presentation; it does **not** replace the outstanding server-side large-roster pagination gate.

Visual reference: [Gym Management Dashboard, Izmahsa / Bolddreams on Dribbble](https://dribbble.com/shots/18018179-Gym-Management-Dashboard). Used as inspiration for navigation hierarchy, spacious cards and profile-focused layout. No Dribbble artwork, screenshots or stock identities are embedded in the app. Member avatars are initials from the actual loaded records.

## Verification

- New unit regressions cover the three-row legacy case, partial query failures, explicit roster failure, demo count parity, search/sort/status calculations and safe empty dates.
- New browser tests cover admin → View as gym → three-member directory, admin demo persona without a membership, read-only profile controls, filtering/export/card mode and a 390px mobile viewport.
- Existing console, team and branding browser tests were exercised after the layout change.
- Live Firebase data was not available in this workspace. These fixes address reproducible code paths; a deployed cloud smoke test is still required to confirm the particular reported gym and any missing Firestore indexes. No deployment or live data modification was performed.
