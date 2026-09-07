# Scripts

## `seed-firestore.mjs` — populate demo data into Cloud Firestore

The production app never ships demo data; this script is the supported way to
fill a demo/staging account with a realistic ~6-week training history (matching
`seed.sql`).

### Credentials
Create a service-account key: **Firebase console → Project settings → Service
accounts → Generate new private key**. Provide it via env (never commit real
keys, never prefix with `NEXT_PUBLIC_`):

```bash
export FIREBASE_PROJECT_ID="your-project-id"
export FIREBASE_CLIENT_EMAIL="firebase-adminsdk-...@your-project-id.iam.gserviceaccount.com"
export FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

Alternatively, with `gcloud` / Application Default Credentials configured, just
set `FIREBASE_PROJECT_ID` and the script uses `applicationDefault()`.

### Run
```bash
# writes to users/demo-user
pnpm seed

# or a specific account / email
SEED_UID=some-firebase-auth-uid SEED_EMAIL=demo@example.com pnpm seed
```

Set `SEED_UID` to an existing signed-in user's UID to make the data appear in
that account; otherwise create a Firebase Auth user with the matching uid/email.

`seed.sql` at the repo root contains the same demo data as a relational schema
for SQL/analytics use.
