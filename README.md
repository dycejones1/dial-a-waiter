# Dial A Waiter

Paid hospitality shifts for people who need work, and reliable staff for venues.

This is the first working version of the app for **staff and employers**, built as a mobile web app (PWA). People open it from a link, can add it to their home screen, and it's light on data. It follows the designs in the staging prototype.

**What works now**

- Staff sign-up in 8 steps: details → photo → choose SMS or email → 6-digit code → address and travel distance → jobs I can do → CV → ID and work permit
- Log in with a code by SMS or email. There are no passwords to forget.
- Home screen with a "finish your profile" checklist, and the nearest open shifts
- Find jobs by distance and role, see a shift's details with the pay first, and apply in one tap
- Applications list with each one's status
- Account page, dark mode, and installing to the home screen
- **Employers ("I need staff"):** business or private-event sign-up with the same SMS/email codes, venue name and suburb, a "waiting for approval" welcome, a dashboard of upcoming shifts with applicant counts, a post-a-shift form (handles shifts past midnight and shows the hourly rate), and an applicants screen to shortlist, book or decline people, see whether their ID is checked, mark a shift filled or cancel it
- **Your team (admin):** venues waiting for approval with the owner's name and number to call, approve or remove approval, ID checks with the ID number (flagged if it fails the SA ID check digit), the document and CV, and verify or "not accepted" with a note the person sees in the app. Every decision is saved in a log: who, what, when and why.
- A database with security rules: staff only see their own data, employers never see ID numbers, only employer accounts can create venues, and venues must be approved by your team before staff can see their shifts

**Not built yet:** availability calendar, earnings and payouts, ratings, notifications (SMS/WhatsApp when someone is booked), finding staff directly, and the iPhone/Android store apps. See "What's next" below.

---

## 1. Try it in demo mode (5 minutes, no accounts needed)

You need [Node.js](https://nodejs.org) 20 or newer.

```bash
npm install
npm run dev
```

Open the link it prints (usually http://localhost:5173). With no Supabase keys the app runs in **demo mode** with sample shifts, and the login code is always `123456`. Nothing is saved online. Tap **I need work** to try the staff side, or **I need staff** to try the employer side (in demo mode, three example people apply to every shift you post). The small **Dial A Waiter team login (demo)** link opens the team page with sample venues and IDs.

## 2. Connect Supabase (the real database and logins)

1. Create a free project at [supabase.com](https://supabase.com). Pick a region close to South Africa.
2. **Create the database.** In the Supabase dashboard open **SQL Editor**, run each file in `supabase/migrations/` **in name order**, one at a time (each must finish before the next).
   *(With the Supabase CLI: `supabase link` then `supabase db push`.)*
3. **Optional sample shifts** for testing: run `supabase/seed.sql` the same way. Only do this on a test project, never production.
4. **Turn on SMS codes:** Authentication → Sign In / Providers → **Phone**. Enable it and connect an SMS provider. Supabase has built-in options (such as Twilio, Vonage and MessageBird); check the dashboard for the current list. To use a South African provider such as Clickatell or BulkSMS, use Supabase's **Send SMS hook** with a small function that calls their API.
5. **Turn on email codes:** Authentication → Emails → "Magic Link" template. Make sure the email shows the code by including `{{ .Token }}`, for example "Your Dial A Waiter code is {{ .Token }}". For real volumes, add your own SMTP sender (Authentication → Emails → SMTP).
6. **Add your keys.** Copy `.env.example` to `.env.local` and fill in `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from Project Settings → API. The anon key is safe to ship in the app; the security rules protect the data. **Never** put the `service_role` key in the app.
7. Run `npm run dev` again. The demo banner disappears and sign-ups now create real accounts.

### Giving your team admin access

Account managers sign up and log in like anyone else. Then the project owner makes them an admin in the SQL editor:

```sql
update profiles set role = 'admin' where phone = '+27833028969';
```

Next time they open the app they land on the team page: **Venues to approve**, **ID checks** and **Approved**. Nobody can make themselves an admin from the app. To remove access, set their role back to `staff`.

Every approval and ID decision is recorded in the `admin_actions` table (Table Editor → admin_actions).

ID numbers and documents are in the `staff_private` table and the private `documents` storage bucket. Only your team (via the dashboard) and the person themselves can see them.

## 3. Launch it on the web

The app is a static site, so any static host works. Two easy options:

**Vercel:** import the repo, framework "Vite", add the two `VITE_SUPABASE_…` environment variables, and deploy. `vercel.json` already sends every page to the app.
**Netlify:** build command `npm run build`, publish directory `dist`, add the same environment variables. `public/_redirects` handles routing.

Then point a domain at it (for example `app.dialawaiter.co.za`), and in Supabase add that address under Authentication → URL Configuration.

A live build with no keys shows a setup message instead of quietly running the demo. To deploy a public demo on purpose, set `VITE_DEMO_MODE=true`.

## 4. Tests

```bash
npm test          # phone numbers, SA ID numbers, money and distance helpers
npm run test:db   # runs the migration on a throwaway local Postgres and checks 47 security rules
npm run typecheck
```

`test:db` needs PostgreSQL installed locally (`initdb`, `pg_ctl` and `psql` on your PATH). It doesn't touch your Supabase project.

## Project layout

```
src/
  App.tsx              routes
  screens/join.tsx     sign-up and log-in screens
  screens/staff.tsx    home, jobs, shift detail, applications, account
  screens/employer.tsx employer sign-up, venue setup, dashboard, post a shift, applicants
  screens/admin.tsx    team page: approve venues, check IDs
  components/ui.tsx    icons, logo, headers, tab bar, venue illustrations
  lib/supabaseApi.ts   talks to Supabase
  lib/demoApi.ts       the same functions with sample data (demo mode)
  lib/format.ts        phone, ID number, money, date and distance helpers
  styles.css           design tokens and styles (light and dark)
supabase/
  migrations/          database tables, security rules, storage buckets
  seed.sql             sample venue and shifts for testing
  tests/               database security tests
```

## Before real users sign up

- [ ] **POPIA.** Replace the placeholder Terms & privacy page with a real privacy notice and terms, reviewed by a lawyer. Register an Information Officer.
- [ ] **How staff are engaged.** Decide with a lawyer whether staff work as independent contractors or employees, and what that means for pay, UIF and contracts.
- [ ] **Security review.** Have an experienced developer review the database rules and the code, especially anything touching ID documents and, later, payments.
- [ ] **SMS costs and abuse.** Set Supabase's rate limits for codes (Authentication → Rate Limits) so nobody can run up your SMS bill.
- [ ] **Backups.** Turn on database backups in Supabase (paid plans).
- [ ] Swap in the master logo, real contact details, and an `app.` domain.

## What's next

1. **Booking notifications:** SMS or WhatsApp when someone is booked, and to the venue when someone applies.
2. **Find staff:** approved venues browse available people and invite them to a shift.
3. **Availability calendar and positions matching** (the `availability` table is ready).
4. **Ratings and earnings,** then **payouts** through a payments provider.
5. **App store versions** for iPhone and Android, wrapping this app or rebuilding the screens with React Native and Expo.
