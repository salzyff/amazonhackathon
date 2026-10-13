# Plan B

A React household assistant that helps people coordinate when plans change. This version uses actual account identities and information entered by the household. There is no seeded calendar, sample family, or simulated reply switch.

## What works

- Email/password accounts and confirmation, using Supabase Auth.
- Empty household setup with your own name, household name, and availability.
- Members and invitations bound to the intended email address, expiring after seven days.
- A shared calendar, household notes, approvals, and a request inbox.
- Each signed-in member can respond only to their own requests. The owner cannot impersonate them.
- Permission and availability checks, including travel buffers for school pickups and prevention of double booking.
- Declines create a new suggestion that requires owner approval. Acceptance updates the shared calendar.
- Saved conversations and household data. Other members’ changes refresh automatically.
- Browser dictation and read-aloud on supported browsers.

The frontend is React 19 with Next.js 16 and TypeScript. The backend uses Supabase Postgres and Auth. Optional AI interpretation uses AI SDK 7 and Vercel AI Gateway. The standard Next.js project can run locally or be connected to Vercel.

## Run locally

Requires Node 22.13+ and pnpm.

```sh
pnpm install --frozen-lockfile
```

Copy `.env.example` to `.env.local`, then configure the Supabase URL, publishable key, and **server-only** secret key. Use a dedicated Plan B Supabase project and run [supabase/schema.sql](supabase/schema.sql) in its SQL editor once. This schema is not applied to any existing account automatically.

In Supabase Auth URL settings, set the Site URL to your app origin, and add the app’s `/auth/callback**` pattern to allowed redirects so invitation return paths work. Locally this is `http://localhost:3000/auth/callback**`. Keep email confirmation enabled.

```sh
pnpm dev
```

Create an account, confirm your email, and sign in. Start a household, enter your tasks and members, and give each member their invitation link. They must create/confirm an account using the exact invited email address and explicitly join. Unjoined people are not eligible for coverage.

For a hosted deployment, set the same variables in Vercel, connect this repository, and configure the production auth callback URL. No new public deployment is created by this repository push.

## AI connection

Set `AI_GATEWAY_API_KEY` and `AI_GATEWAY_MODEL` as server environment variables to enable model interpretation. Use a current structured-output text model from `https://ai-gateway.vercel.sh/v1/models`.

Without a model connection, the calendar planner supports explicit return times, status questions, and household notes. It identifies itself as a calendar planner. It asks for a return time rather than guessing one. If a connected model fails, the UI identifies a fallback to calendar rules.

The model returns a validated intent. The backend applies availability and permission checks independently. It cannot grant pickup permissions, approve plans, impersonate recipients, or claim a task was accepted without the actual reply.

## Data and access

The verified Supabase account determines household membership. Each user can belong to one household. The owner manages the calendar, notes, plans, and permissions; members can update their own availability and reply to their own requests.

Data tables and invitation RPCs have RLS enabled and no browser-role grants. Only authenticated Next.js routes use the server credential after verifying identity and membership. Invitation codes are stored as SHA-256 hashes. Creation and acceptance are database transactions. Household updates use version checks to detect concurrent writes. Public-facing responses containing account data are not cached.

Calendar tasks are entered in the app, using Lagos time (WAT). An external Google/Outlook calendar, email notification service, and actual Alexa device integration are not connected. Voice input uses the browser’s speech service. The Alexa+ hackathon’s simulated web-experience route can use this app, but live model credentials and the usual submission materials must be supplied before presenting it as an AI-connected entry.

## Checks

```sh
pnpm test
pnpm typecheck
pnpm build
```

Tests cover planning, approvals, replacement suggestions, actual-account reply authorization, and the schema’s invitation and permission behavior in an embedded PostgreSQL engine. Test fixtures are used only by tests. Live Supabase authentication and a live model call require configured services and are separate from these local checks.
