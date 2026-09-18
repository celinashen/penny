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
