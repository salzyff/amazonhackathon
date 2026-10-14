# Plan B

Plan B keeps your household’s plans in one place. If you’re running late, tell it when you’ll be free again. It checks the calendar, suggests who could help, and lets you review the requests before anyone is asked.

When someone says yes, their name goes on the calendar. If they can’t make it, Plan B looks for another option. You can check the replies whenever you need an update.

## What you need to get started

- **Node.js 22.13 or later and pnpm** to run the app on your computer.
- **A Supabase project** for accounts and saved household data.
- **The Supabase URL, publishable key, and server secret key** from that project.
- **A Gemini API key and model name** if you want the assistant to understand more natural ways of asking for help. A free Google AI Studio key is enough for testing.
- **A Vercel project** if you want to put the app online.

You can use the calendar planner without an AI key. It understands return times, checks replies, and saves notes. Accounts and shared data still need Supabase.

## Run it on your computer

Install the packages:

```sh
pnpm install --frozen-lockfile
```

Copy `.env.example` to `.env.local`. On Windows, you can use:

```powershell
Copy-Item .env.example .env.local
```

Fill in these values in `.env.local`:

| Variable                               | What to put there                                   |
| -------------------------------------- | --------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`             | Your Supabase project URL                           |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | The project’s publishable key                       |
| `SUPABASE_SECRET_KEY`                  | Its server secret key, or legacy `service_role` key |
| `GEMINI_API_KEY`                       | Your Google AI Studio key                           |
| `GEMINI_MODEL`                         | A Gemini model, such as `gemini-2.5-flash`          |
| `AI_GATEWAY_API_KEY`                   | Optional Vercel AI Gateway key                      |
| `AI_GATEWAY_MODEL`                     | Optional Gateway model                              |

Keep the secret keys in environment settings. Don’t commit `.env.local` or put those keys in browser code. The two `NEXT_PUBLIC_` values are the only ones meant for the browser.

Use a separate Supabase project for Plan B. Run [supabase/schema.sql](supabase/schema.sql) once in its SQL editor to create the tables and invitation functions.

In **Supabase → Authentication → URL Configuration**:

1. Set the Site URL to `http://localhost:3000`.
2. Add `http://localhost:3000/auth/callback**` to the allowed redirect URLs. The ending allows the app to bring someone back to their invitation after confirming their email.
3. Keep email confirmation enabled.

Then start the app:

```sh
pnpm dev
```

Open `http://localhost:3000`, create an account, and confirm your email.

## Set up your household

Start with your name, your household’s name, and the hours you’re usually free. The calendar and notes start empty.

Add your people and tasks. For each person, enter the email address they’ll use to sign in. Make an invitation link and send it to them. The link lasts seven days, and making a new one replaces the old one.

Each person needs to accept their invitation before Plan B can suggest them for a task. They can then set their own free hours and reply to requests sent to them. The household owner manages plans, notes, and permissions. Everyone can belong to one household.

School pickups need permission and 15 minutes on either side for travel. Deliveries need someone who’s marked as home. Anything already on the calendar counts as busy time.

Try a message such as **“I’m stuck at work until 6 pm.”** Plan B will check the tasks you’ll miss and suggest a new plan. Review it, choose who to ask, and check their replies in **Requests**. Only the person receiving a request can answer it.

## Connect Gemini

Create a key in [Google AI Studio](https://aistudio.google.com/apikey), then add `GEMINI_API_KEY` and `GEMINI_MODEL` to your local `.env.local` or Vercel environment. `gemini-2.5-flash` is a good starting model. Keep the key on the server; never add it to a `NEXT_PUBLIC_` variable.

Gemini helps understand the message. Plan B still checks free hours, permissions, and calendar conflicts, and you review every request before it is sent. If Gemini is unavailable or you leave these values empty, the basic planner still works.

## Put it online

Import this repository into Vercel and add the same environment values. Update the Supabase Site URL and allowed callback URL to match your live app’s address. Use `/auth/callback**` at the end of the callback pattern, as above.

The GitHub push doesn’t deploy the app by itself. Supabase and AI also need their own setup; the repository doesn’t contain working keys.

## What’s connected so far

The app has account setup, invitations, a shared calendar, household notes, approvals, and replies. Changes refresh automatically. Voice input and read-aloud use your browser, where supported.

Tasks are entered in Plan B and use Lagos time, WAT. Google and Outlook calendars, email notifications, and an actual Alexa device connection still need separate integrations. For the Alexa+ hackathon, this is the simulated web experience route. A submission also needs a working AI connection, a short demo video, and product feedback.

## For anyone working on the code

The app uses React 19, Next.js 16, TypeScript, and Supabase. AI calls use AI SDK 7 with Gemini or an optional Vercel AI Gateway connection.

The server verifies the signed-in account before reading or changing household data. Browser accounts have no direct access to the database tables or invitation functions. Invitation codes are stored as hashes, and joining a household happens in a transaction. Version checks prevent one person’s update from quietly overwriting someone else’s.

Run the checks with:

```sh
pnpm test
pnpm typecheck
pnpm build
```

The tests cover planning, approvals, replies, permissions, and invitations. Database tests use an embedded PostgreSQL engine. Live sign-in and model calls need connected services to test them end to end. Sample names and plans appear only in test fixtures.
