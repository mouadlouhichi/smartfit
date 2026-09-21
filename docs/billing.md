# SmartFit billing — providers, setup, and the CMI plan

The repository contains a billing **preview contract**, not a live paid
service. The app takes money through one interface (`BillingProvider` in
`src/lib/billing/`) when the launch work below is complete: checkout opens a
URL, and a receipt is provisioned **server-side** before the `profile.pro`
stamp is written. The client must never write its own paid receipt. Until that
backend exists, do not configure payment links or charge users; the visible
sandbox is local product testing only.

```
src/lib/billing/
  types.ts         the BillingProvider interface (checkoutUrl, manageUrl)
  stripe-links.ts  live: Stripe Payment Links (monthly / yearly / lifetime)
  sandbox.ts       default: clearly-labelled local simulation, no charges
  cmi.ts           dormant: the CMI integration contract (this doc §3)
  index.ts         registry: first available provider wins
```

## 1. Current state

| Provider | Status | Checkout | Provisioning |
|---|---|---|---|
| Sandbox | **preview default** | Simulated locally, labelled in the UI | Local stamp (testing only; never a charge) |
| Stripe Links | **not launch-ready** | Payment Link contract only | Webhook → stamp (to build, §2) |
| CMI | **dormant** — contract only | Server route (to build, §3) | Callback → stamp (to build, §3) |

## 2. Stripe setup (international cards)

1. In the Stripe dashboard create three Payment Links (monthly $6.99,
   yearly $49.99, lifetime $99) and a Customer Portal configuration.
2. Set the build env:
   ```bash
   NEXT_PUBLIC_STRIPE_PAYMENT_LINK_MONTHLY=https://buy.stripe.com/…
   NEXT_PUBLIC_STRIPE_PAYMENT_LINK_YEARLY=https://buy.stripe.com/…
   NEXT_PUBLIC_STRIPE_PAYMENT_LINK_LIFETIME=https://buy.stripe.com/…
   NEXT_PUBLIC_STRIPE_PORTAL_URL=https://billing.stripe.com/…   # optional
   ```
3. Provisioning (required before charging for real): add a small webhook
   route (`POST /api/billing/stripe/webhook`, raw-body signature check with
   the **server-side** `STRIPE_WEBHOOK_SECRET`) that maps
   `checkout.session.completed` → `{ uid, plan }` and stamps
   `profile.pro = { plan, since }` via the Firebase Admin SDK.
4. Lock the client out: tighten `firestore.rules` `validPro` so only the
   Admin SDK (or a reviewed claim flow) can write `profile.pro`.

Until step 3–4 land, do **not** configure these links in a user-facing
deployment. A link can open a real payment page before the app can verify,
activate, restore or cancel the entitlement — that is not an acceptable MVP
billing flow.

## 3. CMI setup (Morocco — when finance is ready)

CMI is **not integrated yet, by decision**. Everything it needs is
specified so the finance work can land without touching product code:

**Contract (pinned by `tests/billing.test.ts` + `CMI_SETUP`):**

- Server-only env (never `NEXT_PUBLIC_` — the store key must not ship to
  the browser): `CMI_STORE_ID`, `CMI_STORE_KEY`, `CMI_GATEWAY_URL`,
  `CMI_OK_URL`, `CMI_FAIL_URL`.
- `POST /api/billing/cmi/checkout` — accepts `{ plan, uid, email }`,
  builds the CMI signed payment request server-side, returns the redirect.
- `POST /api/billing/cmi/callback` — validates CMI's response hash
  (`Response-Hash` per CMI docs), stamps `profile.pro` via Admin SDK,
  idempotent on CMI's transaction id.
- Plans sold: `monthly`, `yearly`, `lifetime` (MAD amounts are configured
  in the CMI merchant backoffice, not in code).

**Go-live checklist:**

1. Finance delivers store id + keys + gateway URLs (test, then production).
2. Implement the two routes above (Next.js route handlers + `firebase-admin`,
   already a devDependency).
3. Point `cmiProvider.checkoutUrl` at `/api/billing/cmi/checkout` and set
   `NEXT_PUBLIC_CMI_ENABLED=1` — the paywall, gates, trial and plan cards
   need no changes.
4. End-to-end on CMI test cards: checkout → callback → stamp → gates open
   → cancel/refund path documented.
5. Decide provider precedence if both Stripe and CMI are live (today:
   Stripe first; likely: geo-based — CMI for MAD, Stripe otherwise).

## 4. B2B — gym contracts & membership sales

The `BillingProvider` above sells SmartFit **Pro to one person**. B2B adds two
money flows it deliberately does not model, both built **offline-first**
because that is how this market pays (bank transfer and cash; CMI at the
terminal). The shared arithmetic lives in `src/lib/billing/gym-contract.ts`
(pure, tested in `tests/gym-contract.test.ts`).

**Platform → gym (the contract).** A gym pays a monthly platform fee. The
path is *recorded* payments, not checkout links:

- `/api/admin/payment` records a payment into `platform/invoices/entries`
  (audited) and auto-converts a `trial` gym to `active` / clears `past_due`
  (`gymStatusAfterPayment`) — money arriving must never un-suspend a gym.
- Dunning-lite state is **derived, never stored**: `contractState()` maps the
  last payment to `current → due (28d) → overdue (35d)`, shown as a badge in
  the admin registry and on the gym page. Suspending an overdue gym stays a
  human click.

**Member → gym (a membership).** Two halves, one invariant — *the browser can
never mint a paid invoice* (rules: `invoices` writes are operator-only; the
online half is a server route):

1. *Online:* a member picks a published plan on `/g/{slug}` →
   `POST /api/billing/gym/purchase` (bearer, verifies membership, copies the
   amount **server-side** from the published plan, idempotent per open
   request) → a **draft** invoice appears in the console's "To collect" queue.
2. *Desk:* staff collect it — `settlePlanPurchase()` writes the paid invoice
   **and** applies the plan to the membership (status `active`, planId, expiry
   extended by `extendedExpiry()`, which runs from the later of now and the
   current expiry so renewing early never steals paid days) in one batch. A
   walk-in sale uses the same write without a prior draft.

Online CMI checkout for memberships is the same dormant contract as Pro's
(§3): when finance delivers merchant keys, collecting a draft gains a
`method: 'cmi'` server path and the purchase route is unchanged.

## 5. Rules that never change

- Trials are local and cardless; only `monthly`/`yearly`/`lifetime`
  stamps come from receipts and never expire client-side.
- Trials and sandbox paid activations are local-only previews and must not
  cross into a cloud profile. The client strips local Pro previews during
  migration/import; `firestore.rules` rejects all client-created Pro stamps and
  only preserves an exact paid stamp already provisioned by a trusted server.
  A real Admin SDK webhook is still required before charging.
- Every `PRO_GATES` row must map to an enforced gate (`packages/core/src/pro.ts`).
- Sandbox must always be visually distinct from real checkout.
