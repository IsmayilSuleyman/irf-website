# İsmayıl Rifah Fondu — İnvestor Portalı

A private, glass-style web app where holders of the **İsmayıl Rifah Fondu (İRF)** log in and see how much of the fund they own. Portfolio data lives in a Google Sheet that the app reads live every minute.

- **Stack:** Next.js 15 (App Router) + TypeScript + Tailwind + Supabase Auth + Google Sheets API + Recharts
- **Hosting:** Vercel
- **Currency:** AZN (₼)
- **Language:** Azerbaijani UI

---

## ⚠️ Privacy first

The whole point of this portal is that **only the people you give accounts to** can see who owns what. For that to actually be true, the Google Sheet itself must NOT be publicly viewable. Before going live:

1. Open the sheet → **Share** → set general access to **Restricted**.
2. Share it only with the **Google service account email** (created below) as **Viewer**.

If you leave the sheet on "Anyone with link can view", anyone with the URL bypasses the login completely.

---

## 1. Sheet structure (already matches your existing sheet)

The app reads ONE tab (the one whose `gid` you put in `SHEET_GID`). It expects the same labeled-report layout you already have:

- A row labeled **Ümumi Kapital** with the value in column B
- A row labeled **Borclu Kapital** with the value in column B
- A row labeled **Xalis Kapital** with the value in column B
- A row labeled **Pay sayı** with the count in column B
- A row labeled **1 payın qiyməti** with the price in column B
- A header row that **starts with** `İRF-in 1 pay` followed by N rows of `label, price`
- A header row `Paylar üzrə sahiblik:` followed by a `Faiz | Say | Sahib | Məbləğ` table
- A header row `Fondun investisiya allokasiyası:` followed by `name | value | percent` rows

The parser keys off those exact label prefixes — you can move sections around in the sheet, but don't rename the labels.

---

## 2. Google service account

1. <https://console.cloud.google.com/> → create a project (e.g. `irf-portal`).
2. Enable the **Google Sheets API**.
3. **IAM & Admin → Service Accounts → Create service account.**
4. Create a JSON key for it and download.
5. Copy the service account email (looks like `irf-reader@irf-portal.iam.gserviceaccount.com`).
6. Open your spreadsheet → **Share** → paste that email as **Viewer**.

Paste the entire JSON key as a single-line value in `GOOGLE_SERVICE_ACCOUNT_JSON` (escape newlines in `private_key` with `\n`).

---

## 3. Supabase setup

1. <https://supabase.com/> → create a project.
2. **Authentication → Providers → Email**: enable. **Disable "Allow new users to sign up"** so only you can create accounts.
3. **Authentication → Users → Add user** for each holder. For each user:
   - Set the email and a password.
   - In **User Metadata**, add a key `full_name` whose value **exactly matches** the `Sahib` field in the sheet (e.g. `İSMAYIL SÜLEYMAN`).
4. Copy `Project URL` and `anon public key` from **Project Settings → API**.

> The app links Supabase users to sheet rows by `user_metadata.full_name === Sahib`. Names are matched case-insensitively, but spelling and special characters must match.

---

## 4. İsmayılBank sheet setup

The private bank dashboard reads a separate tab from the same Google Sheet. By default it looks for:

- `BANK_SHEET_TAB=BankAccounts`
- `BANK_SHEET_RANGE=A1:D1000`

Recommended column headers:

- `full_name`
- `deposited_azn`
- `outstanding_loan_azn`
- `updated_at` optional
- `annual_rate_pct` optional
- `term_months` optional
- `maturity_bonus_azn` optional
- `maturity_date` optional
- `monthly_payment_azn` optional
- `next_payment_date` optional
- `payment_schedule` optional (`2026-05-20|145|Növbədə|May ödənişi;2026-06-20|145|Planlaşdırılır|İyun ödənişi` or JSON array)

Aliases are supported too, so you can also use labels like `Sahib`, `Depozit`, and `Kredit`.

The logged-in user's `user_metadata.full_name` must match the bank sheet name, just like the IRF sheet linkage.

---

## 5. Local development

```bash
npm install
cp .env.local.example .env.local
# fill in NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
# GOOGLE_SERVICE_ACCOUNT_JSON, SHEET_ID, SHEET_GID
npm run dev
```

Open <http://localhost:3000>. You'll be redirected to `/login`. Sign in with a Supabase user whose `full_name` metadata matches a row in the `Paylar üzrə sahiblik` table.

After login, the shared portal lands on `/portal`, where the user can open either the IRF dashboard or the İsmayılBank account page.

---

## 6. Deploy to Vercel

1. Push this repo to GitHub.
2. Import it on <https://vercel.com/new>.
3. Add the same environment variables in **Project → Settings → Environment Variables**.
4. Deploy. Add your custom domain in **Project → Settings → Domains** if you have one.

> Sheet reads are cached for 60 seconds via `unstable_cache`. After editing the sheet, the dashboard reflects changes within ~1 minute.

---

## 7. How to add a new investor

1. Add their row to the `Paylar üzrə sahiblik` table in the sheet.
2. In Supabase **Authentication → Users → Add user**, create them with an email + password and set `user_metadata.full_name` to exactly the `Sahib` value you used in step 1.
3. Share the credentials with them privately. Done.

---

## What the dashboard shows

- **Sizin sahiblik** (Your stake): units owned, ownership %, current value
- **Fond haqqında** (About the fund): net capital, unit price, debt capital
- **1 payın qiymət dinamikası** (Unit price dynamics): area chart of historical price points
- **Fondun investisiya allokasiyası** (Allocation): bar list of fund holdings
- **Portal**: shared post-login landing page with links to both IRF and İsmayılBank

---

## File map

```
app/
  layout.tsx              Root layout, fonts, glass background
  page.tsx                Redirects to /login or /dashboard
  login/page.tsx          Glass login card (Azerbaijani)
  dashboard/page.tsx      Main dashboard (server component)
  api/portfolio/route.ts  JSON API for the logged-in user's data
lib/
  supabase/server.ts      Server Supabase client
  supabase/client.ts      Browser Supabase client
  sheets.ts               Google Sheets read + parser + 60s cache
  portfolio.ts            AZN / unit / percent formatters
components/
  Header.tsx              "İsmayıl Rifah Fondu" + Çıxış
  GlassCard.tsx           Frosted card primitive
  StatTile.tsx            Big number tile
  PerformanceChart.tsx    Recharts area chart for unit price history
  AllocationList.tsx     Bar list of fund holdings
  LoginForm.tsx           Email/password client form
middleware.ts             Auth gate for /dashboard
```
"# irf-website" 
