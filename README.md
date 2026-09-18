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
