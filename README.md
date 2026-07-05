# Genesis — AI-Powered HighLevel App Builder

Vue 3 + TypeScript frontend, Firebase backend (Auth, Firestore, Cloud Functions), and Anthropic-powered code generation with real HighLevel API integration.

## Live URLs

| Service | URL |
|---------|-----|
| **Frontend (Firebase Hosting)** | https://hl-genesis.web.app |
| **API (Cloud Functions)** | https://asia-south1-hl-genesis.cloudfunctions.net/api |
| **AI generation (SSE)** | https://asia-south1-hl-genesis.cloudfunctions.net/generate |
| **HL OAuth callback** | https://asia-south1-hl-genesis.cloudfunctions.net/hlOAuthCallback |
| **HL webhooks** | https://asia-south1-hl-genesis.cloudfunctions.net/api/webhooks/hl |

Health check: `GET https://asia-south1-hl-genesis.cloudfunctions.net/api/health` → `{"status":"ok"}`

---

## HighLevel setup

### 1. Marketplace app

Create (or use) a **HighLevel Marketplace** app and note the **Client ID** and **Client Secret**.

### 2. OAuth redirect URI

Add this **exact** redirect URL in the HL app settings:

```
https://asia-south1-hl-genesis.cloudfunctions.net/hlOAuthCallback
```

For local development, also add:

```
http://127.0.0.1:5001/hl-genesis/asia-south1/hlOAuthCallback
```

### 3. Webhook URL

```
https://asia-south1-hl-genesis.cloudfunctions.net/api/webhooks/hl
```

Set `HL_WEBHOOK_PUBLIC_KEY` in `functions/.env.hl-genesis` to the Ed25519 public key from the [HL Webhook Integration Guide](https://marketplace.gohighlevel.com/docs/webhook/WebhookIntegrationGuide/). Keep `HL_WEBHOOK_SKIP_VERIFY=false` in production.

### 4. OAuth scopes

Configure these scopes on the HL app (must match `HL_OAUTH_SCOPES` in env):

```
contacts.readonly contacts.write
conversations.readonly conversations.write
conversations/message.readonly conversations/message.write
calendars.readonly calendars.write
calendars/events.readonly calendars/events.write
```

### 5. Sandbox / test account

1. Install the marketplace app on a **sandbox sub-account** (or dev location) in HighLevel.
2. In Genesis, sign in → **Connect HighLevel** → complete OAuth.
3. Confirm the banner shows your connected location name.
4. Create a project and generate an app; preview should load real contacts/conversations/calendar data for that location.
5. Trigger a webhook (e.g. create a contact in HL) to verify live preview updates.

---

## Local setup

### Prerequisites

- Node.js 20+
- Firebase CLI (`npm install -g firebase-tools`)
- Firebase project `hl-genesis` (or update `.firebaserc`)
- Anthropic API key and HL marketplace credentials

### 1. Install dependencies

```bash
cd functions && npm install
cd ../frontend && npm install
```

### 2. Backend environment

Copy and fill in `functions/.env` (see keys in `functions/src/config/env.ts`):

```env
HL_CLIENT_ID=...
HL_CLIENT_SECRET=...
HL_OAUTH_REDIRECT_URI=
HL_OAUTH_SCOPES=contacts.readonly contacts.write ...
ANTHROPIC_API_KEY=...
FRONTEND_URL=
HL_WEBHOOK_SKIP_VERIFY=true   # optional for local curl tests
```

### 3. Frontend environment

`frontend/.env.development` is preconfigured for emulators:

```env
VITE_API_BASE=
VITE_GENERATE_URL=
VITE_FIREBASE_PROJECT_ID=hl-genesis
VITE_FIREBASE_API_KEY=demo-api-key
VITE_USE_EMULATORS=true
```

### 4. Start emulators

```bash
cd functions
npm run serve
# → Auth :9099, Functions :5001, Firestore :8080, Emulator UI :4000
```

In a second terminal:

```bash
cd frontend
npm run dev
# → http://localhost:5173
```

Open the Emulator UI at http://localhost:4000 to inspect Auth/Firestore.

---

## Architecture decisions (tradeoffs)

- **Firestore snapshot listener (`onSnapshot`) instead of SSE from Cloud Functions** — For live webhook updates I went with Firestore because it was much simpler to implement: HL hits our webhook, we save the event, and the preview page is already listening on that collection. SSE would have meant building a streaming endpoint, keeping connections open per user, and routing each webhook to the right socket — doable, but a lot of extra work for a take-home. SSE is probably the better choice at high volume or if you care about shaving milliseconds off delivery. Tradeoff: each event is a Firestore write + read, and you may need a composite index for ordered queries.

- **Firestore instead of Postgres** — The assignment stack was Firebase, so I kept everything in Firestore (projects, files, messages, tokens, webhook events). No separate DB to run, and security rules line up with Auth. Tradeoff: no joins and shema could be hard if we scale it

- **Server-side HighLevel proxy instead of calling HighLevel from the browser** — Generated apps never call the HighLevel API directly. They send requests to our `/hl/*` backend routes using a short-lived Firebase ID token, while HighLevel access and refresh tokens remain securely stored on the server. **Tradeoff:** Every HighLevel request passes through Cloud Functions, adding a small amount of latency.

- **`preview.html` instead of running generated `.vue` files in preview** — The iframe can't import SFCs without a build step, so the LLM emits a standalone `preview.html` with CDN Vue. Quick to get working. Tradeoff: two copies of the UI to keep in sync (`preview.html` + `.vue` files).

- **`getApiDocs` tool instead of pasting all API docs into the prompt** — The model pulls only the HL endpoints it needs before writing code. Keeps prompts smaller and cuts down on made-up APIs. Tradeoff: one extra round-trip before files start streaming.

- **One `api` Cloud Function instead of a function per route** — REST, HL proxy, and webhooks all live in one Express app. Easier to develop and deploy. Tradeoff: can't scale routes independently (`generate` is still its own function because of the 300s timeout and SSE).

- **`.env.hl-genesis` instead of Secret Manager** — I used Firebase's project env file for deploy because it was the fastest way to get secrets into production. Tradeoff: not ideal for secret rotation; fine for a demo, wouldn't ship a real product this way.

- **Public Cloud Run invoker instead of locking functions behind IAM** — The browser, HL OAuth, and HL webhooks all need to hit our URLs without GCP signed requests. Tradeoff: endpoints are public; we rely on Firebase auth and webhook signature checks in code.

- **Full snapshot per generation instead of Git-style history** — After each generation I save all files so restore is one click. Tradeoff: storage adds up; no proper diff/merge if two people edited the same project.

---

## What you would improve

- **One preview source of truth** — Right now the LLM has to keep `preview.html` and `.vue` files in sync, and editing `.vue` in Monaco doesn't update the live preview. I'd add a small build step (or in-iframe bundler) so preview runs the same code the editor shows.

- **Rate limits on `/generate`** — Any logged-in user can hit the Anthropic endpoint with no cap. I'd add per-user quotas, max prompt size enforcement, and basic abuse protection before this went to real users.

- **Webhook event cleanup** — Every HL webhook is stored forever under `users/{uid}/webhookEvents`. I'd add TTL/expiry or a rolling window so Firestore storage and listener costs don't grow unbounded.

- **Secrets + environments** — Move `ANTHROPIC_API_KEY` and `HL_CLIENT_SECRET` to Secret Manager, and split dev/staging/prod Firebase projects instead of juggling `.env` vs `.env.hl-genesis` on one machine.

- **Pre-attach API docs from prompt intent** — Today the model must call `getApiDocs` in a separate tool round before it starts writing files, which adds latency. The docs already live in `apiDocs.ts`, so we could classify the user's prompt first (e.g. keywords or a tiny classifier: "contact dashboard" → contacts endpoints, "appointments" → calendars + appointments) and inject only the relevant docs into the system prompt up front. Tradeoff: bigger prompts when you guess wrong or over-include endpoints; the tool approach is slower but lets the model pick exactly what it needs.

- **Automated tests** — The fragile parts are the FILE block parser, HL proxy routes, and OAuth callback. I'd add integration tests for those plus a GitHub Action that runs `tsc`, `vue-tsc`, and deploys on merge.

---

## Deployment notes

### Firebase project setup

1. Create/select project **`hl-genesis`** and enable **Blaze** billing.
2. Enable **Authentication → Email/Password** and create a **Firestore** database.
3. Register a **Web app** and copy the `apiKey` into `frontend/.env.production`.
4. `firebase login` and confirm `.firebaserc` points at `hl-genesis`.

### Environment files

| File | Purpose |
|------|---------|
| `functions/.env` | Local emulators |
| `functions/.env.hl-genesis` | Production function env (loaded on deploy) |
| `frontend/.env.development` | Local Vite dev |
| `frontend/.env.production` | Production build (`vite build`) |

Production `functions/.env.hl-genesis` must set `FRONTEND_URL=https://hl-genesis.web.app` and production OAuth/webhook URLs.

### Deploy commands

```bash
# Backend + Firestore rules/indexes
cd functions && npm run deploy

# Frontend (builds via firebase.json predeploy hook)
firebase deploy --only hosting

# Everything
firebase deploy
```

### Manual steps (no CI/CD yet)

1. Ensure `functions/package-lock.json` is in sync (`cd functions && npm install`) before deploy — Cloud Build runs `npm ci`.
2. After first Functions deploy, verify public access (403 → add `invoker: "public"` and redeploy).
3. Update HL marketplace app with production OAuth redirect and webhook URLs.
4. Redeploy functions after changing `functions/.env.hl-genesis`.
5. Redeploy hosting after frontend changes: `firebase deploy --only hosting`.

### Project layout

```
HighLevel/
├── frontend/          # Vue 3 SPA (Vite)
├── functions/         # Cloud Functions (TypeScript)
├── firebase.json      # Functions, Firestore, Hosting, emulators
├── firestore.rules
└── firestore.indexes.json
```
