import type { SupabaseClient } from "@supabase/supabase-js";
import { contributionInflow } from "@/lib/investments";
import { plaid } from "./client";

const PAGE = 500;
/** First sync reaches back as far as Plaid allows; later ones just overlap recent days. */
const BACKFILL_DAYS = 730;
const REFRESH_DAYS = 45;

const isoDay = (d: Date) => d.toISOString().slice(0, 10);
const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000);

export type InvestmentSyncResult = {
  holdings: number;
  contributions: number;
  /** True when time ran out with history still to load. */
  more: boolean;
};

/**
 * Pulls what's in an investment account today (holdings, and the account's
 * total value) and the money that has gone into it (contributions and deposits).
 *
 * Holdings are a snapshot, so each sync replaces them; anything you've sold
 * disappears. Contributions are added as they're found and can safely be pulled
 * again: they're matched on Plaid's own transaction id.
 */
export async function syncInvestments(
  admin: SupabaseClient,
  item: { id: string; user_id: string; investments_backfilled: boolean },
  accessToken: string,
  accountIds: Map<string, string>,
  deadline: number,
): Promise<InvestmentSyncResult> {
  // ---------------------------------------------------------------- holdings
  const { data } = await plaid().investmentsHoldingsGet({ access_token: accessToken });
  const securities = new Map(data.securities.map((s) => [s.security_id, s]));
  const now = new Date().toISOString();

  const rows = data.holdings.flatMap((h) => {
    const accountId = accountIds.get(h.account_id);
    if (!accountId) return [];
    const s = securities.get(h.security_id);
    return [
      {
        user_id: item.user_id,
        account_id: accountId,
        plaid_security_id: h.security_id,
        ticker: s?.ticker_symbol ?? null,
        name: s?.name ?? null,
        security_type: s?.type ?? null,
        quantity: h.quantity,
        // The total paid for the position. Some institutions don't report it.
        cost_basis: h.cost_basis ?? null,
        price: h.institution_price,
        market_value: h.institution_value,
        price_as_of: h.institution_price_as_of ?? null,
        updated_at: now,
      },
    ];
  });

  for (let i = 0; i < rows.length; i += PAGE) {
    const { error } = await admin
      .from("holdings")
      .upsert(rows.slice(i, i + PAGE), { onConflict: "account_id,plaid_security_id" });
    if (error) throw error;
  }

  // Positions that are no longer held. Done per account so an empty response
  // for one account can't wipe another's.
  for (const a of data.accounts) {
    const accountId = accountIds.get(a.account_id);
    if (!accountId) continue;
    const keep = rows.filter((r) => r.account_id === accountId).map((r) => r.plaid_security_id);
    let del = admin.from("holdings").delete().eq("account_id", accountId).not("plaid_security_id", "is", null);
    if (keep.length > 0) del = del.not("plaid_security_id", "in", `(${keep.join(",")})`);
    const { error } = await del;
    if (error) throw error;

    // The institution's own total for the account (securities plus cash).
    const { error: balanceError } = await admin
      .from("accounts")
      .update({ balance_current: a.balances.current ?? null, balance_as_of: now })
      .eq("id", accountId);
    if (balanceError) throw balanceError;
  }

  // ----------------------------------------------------------- contributions
  const start = isoDay(daysAgo(item.investments_backfilled ? REFRESH_DAYS : BACKFILL_DAYS));
  const end = isoDay(new Date());
  let offset = 0;
  let total = Infinity;
  let contributions = 0;

  while (offset < total) {
    if (Date.now() >= deadline) return { holdings: rows.length, contributions, more: true };

    const { data: page } = await plaid().investmentsTransactionsGet({
      access_token: accessToken,
      start_date: start,
      end_date: end,
      options: { count: PAGE, offset },
    });
    total = page.total_investment_transactions;

    const flows = page.investment_transactions.flatMap((t) => {
      const accountId = accountIds.get(t.account_id);
      const amount = contributionInflow({ type: String(t.type), subtype: String(t.subtype), amount: t.amount });
      if (!accountId || amount === null) return [];
      return [
        {
          user_id: item.user_id,
          account_id: accountId,
          posted_date: t.date,
          amount,
          description: t.name,
          kind: `${t.type} / ${t.subtype}`,
          external_id: t.investment_transaction_id,
        },
      ];
    });
    for (let i = 0; i < flows.length; i += PAGE) {
      const { error } = await admin
        .from("investment_flows")
        .upsert(flows.slice(i, i + PAGE), { onConflict: "account_id,external_id" });
      if (error) throw error;
    }
    contributions += flows.length;

    if (page.investment_transactions.length === 0) break;
    offset += page.investment_transactions.length;
  }

  const { error } = await admin
    .from("plaid_items")
    .update({ investments_backfilled: true, investments_synced_at: now })
    .eq("id", item.id);
  if (error) throw error;

  return { holdings: rows.length, contributions, more: false };
}
