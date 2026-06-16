# Tandem

A two-person, real-time accountability checklist. Each person has their own list of
daily habits (and ad-hoc one-off tasks); both people see each other's progress update
live. Built as an installable, mobile-first PWA.

- **Frontend:** React + Vite + TypeScript, installable PWA, dark theme
- **Backend:** Supabase (Postgres + Realtime + magic-link Auth), protected by Row-Level Security
- **Hosting:** Vercel (frontend) + Supabase cloud — both free tier

## How it works

- A **daily habit** is "done today" only if a completion row exists for *(item, today)*.
  A new day has no row, so it shows unchecked automatically — the reset is implicit in
  the date, with no scheduled job. Old rows persist as history and power the streaks.
- A **one-off task** shows until you check it once, then it archives.
- **Row-Level Security** lets both people *read* each other's lists but *write only their
  own*, so neither can tamper with the other's checks.

## Local development

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # unit tests (dates, streak, summary logic)
npm run build      # typecheck + production build
npm run icons      # regenerate PWA icons from public/favicon.svg
```

You need a `.env` (copy `.env.example`) with your Supabase URL + publishable key for the
app to connect. Without it the login screen still renders, but sign-in won't work.

## One-time setup (the account-bound steps)

### 1. Supabase project

1. Create a project at [supabase.com](https://supabase.com) (free tier).
2. **Authentication → Sign In / Providers:** keep **Email** enabled, and **turn OFF**
   "Allow new users to sign up" (this locks the app to just the two of you).
3. **Authentication → Users → Add user:** add both email addresses.
4. **SQL Editor:** paste and run [`supabase/schema.sql`](supabase/schema.sql). It creates
   the tables, the profile-on-signup trigger, the RLS policies, and enables Realtime. It's
   safe to re-run.
5. **Project Settings → API:** copy the **Project URL** and the **publishable** key
   (`sb_publishable_…`) into a local `.env`:
   ```
   VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_your-key
   ```
   (The publishable key is a public browser key — safe to expose. Security is in RLS.)

### 2. Deploy to Vercel

1. Push this folder to a GitHub repo.
2. Import it at [vercel.com](https://vercel.com) (framework preset: **Vite**).
3. Add the two env vars (`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`) in the
   Vercel project settings.
4. Deploy. `vercel.json` already rewrites all routes to `index.html` for the SPA router.
5. In Supabase **Authentication → URL Configuration**, set the **Site URL** to your Vercel
   URL so magic links redirect back to the deployed app.

### 3. Sign in

Each person opens the app, enters their email, and clicks the magic link from their inbox
on that device. On a phone, use the browser's **Add to Home Screen** to install it.

## Not in v1 (deliberately deferred)

Notifications (a daily reminder, a manual nudge, or Discord delivery) are out of scope for
v1, but the schema is kept compatible so they can be added later without rework.
