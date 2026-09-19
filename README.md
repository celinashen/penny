# penny

My personal budget app!

Tracks card transactions and spending by category (USD and CAD kept separate),
with banks connected through Plaid and a daily sync.

## Running locally

```
npm install
npm run dev
```

Then open http://localhost:3000. The app needs a `.env.local` file (never
commit it) with the variables below.

## Environment variables

| Name | What it is |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase project URL and public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Bypasses row-level security. Server-only |
| `PLAID_CLIENT_ID`, `PLAID_SECRET`, `PLAID_ENV` | Plaid keys; `PLAID_ENV` is `sandbox` or `production` |
| `PLAID_TOKEN_KEY` | Base64 32-byte key that encrypts stored bank tokens. **Back it up:** if it is lost every bank must be re-linked, which uses up Plaid Items. Generate with `openssl rand -base64 32` |
| `CRON_SECRET` | Protects the daily sync endpoint (`/api/cron/sync`) |
| `PLAID_REDIRECT_URI` | Optional. HTTPS redirect registered in Plaid, needed for OAuth banks in production |
| `PLAID_WEBHOOK_URL` | Optional. Public URL Plaid calls when new transactions are ready |
| `SUPABASE_ACCESS_TOKEN` | Optional, only for applying migrations from the command line |

## Deploying (Vercel + Supabase)

1. Import the repo into Vercel and add the environment variables above (mark the
   secrets as Sensitive). **Do not add `SUPABASE_ACCESS_TOKEN`**: it's an
   account-wide key that is only for running migrations from your own machine.
2. `PLAID_TOKEN_KEY` must be the same value everywhere the app runs, because they
   all share one database. Keep a copy in a password manager.
3. In Supabase (Authentication, URL Configuration) set the Site URL to the
   deployed address and add it to the redirect URLs.
4. Start with `PLAID_ENV=sandbox` and check the deployed site end to end before
   switching to production: each real bank uses one of a limited number of Plaid
   connections.
5. For production, register `https://<your-domain>/plaid/oauth` under Allowed
   redirect URIs in the Plaid dashboard and set `PLAID_REDIRECT_URI` to the same
   address. Banks that use OAuth (Chase, Bank of America and others) send you
   there to finish connecting.
6. The daily sync is a Vercel cron job (`vercel.json`) that calls
   `/api/cron/sync`; Vercel sends `CRON_SECRET` automatically.
7. After you and anyone else who will use the app have signed up, turn off new
   sign-ups in Supabase.

## Investments and paycheck contributions

Brokerages (Fidelity, Robinhood...) connect through Plaid's Investments product
and provide holdings, each account's total value, and deposits. Gain or loss uses
the cost basis the institution reports; positions without one are left out and
counted, never guessed.

Money deducted from a paycheck and sent straight to an investment account never
passes through the bank, so it would otherwise be missing from income. Each
investment account has a "deposits come from my paycheck" setting. When it's on,
deposits are added to **income** and to **money invested** on the Overview. It
defaults to on for Fidelity accounts and off for everything else, because
deposits into a brokerage like Robinhood usually come from your own bank account
and would be counted twice (once as a transfer out of the bank, once as a deposit).

## Database

Schema changes live in `supabase/migrations/`, applied in order.

## Performance with a large history

Opening the app never pulls your transactions. The rules that keep it fast:

- **Pages read summaries, not transactions.** The Overview and Year pages call
  database functions (`spending_by_month`, `spending_daily`, `top_merchants`,
  `largest_purchases`) that return totals and a handful of top rows. What a page
  reads stays the same size whether you have a thousand transactions or a million.
  Load 100,000 transactions and the Overview still reads ~150 summary rows.
- **The Transactions list is paginated** (50 rows a page). Filters and search use
  indexes, including trigram indexes so searching descriptions stays fast.
- **Nothing calls Plaid when a page loads.** Bank data arrives through the daily
  cron job, "Sync now", or connecting a bank, and is stored in the database first.
- **Big loads are resumable.** A sync or an auto-categorize run stops after ~45s
  and continues on the next run instead of being killed by the serverless time
  limit; a bank sync saves its place after every page, so no data is skipped or
  repeated. CSV imports take up to 10,000 rows at a time and skip duplicates, so
  importing a file again is safe.
- **Add indexes with the queries that need them.** If you add a page that filters
  or groups transactions, check it against a large data set first.
