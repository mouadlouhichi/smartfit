# SmartFit billing — providers, setup, and the CMI plan

The app takes money through **one interface** (`BillingProvider` in
`src/lib/billing/`): checkout opens a URL, and a receipt is provisioned
**server-side** before the `profile.pro` stamp is written. The client never
writes its own receipt outside the sandbox.

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
| Sandbox | **default** | Simulated locally, labelled in the UI | Local stamp (testing only) |
| Stripe Links | live when configured | Payment Link per plan (new tab) | Webhook → stamp (to build, §2) |
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

Until step 3–4 land, Stripe checkout opens correctly but activation stays
manual — do not advertise paid plans as self-serve.

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

## 4. Rules that never change

- Trials are local and cardless; only `monthly`/`yearly`/`lifetime`
  stamps come from receipts and never expire client-side.
- `firestore.rules` `validPro` must accept exactly the plans the providers
  can sell (currently `monthly`, `yearly`, `lifetime`, `trial`).
- Every `PRO_GATES` row must map to an enforced gate (`packages/core/src/pro.ts`).
- Sandbox must always be visually distinct from real checkout.
