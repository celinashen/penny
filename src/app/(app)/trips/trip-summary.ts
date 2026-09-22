import type { SupabaseClient } from "@supabase/supabase-js";
import type { Currency } from "@/lib/accounts";
import type { TripSummary } from "./trip-list";

/**
 * Each trip's net cost per currency: what you paid out, minus any
 * reimbursement (a Zelle settle-up, say) attached alongside it -- the same
 * netting a category gets a refund, just scoped to one trip instead of one
 * month. Trips with nothing attached yet still appear, with an empty list.
 */
export async function fetchTripSummaries(
  supabase: SupabaseClient,
  trips: { id: string; name: string }[],
): Promise<TripSummary[]> {
  if (trips.length === 0) return [];

  const { data: tripTx } = await supabase
    .from("transactions")
    .select("trip_id, amount, posted_date, account:accounts(currency)")
    .not("trip_id", "is", null);

  const tripByKey = new Map<
    string,
    { id: string; currency: Currency; spent: number; reimbursed: number; count: number; from: string; to: string }
  >();
  for (const t of (tripTx ?? []) as unknown as {
    trip_id: string;
    amount: number;
    posted_date: string;
    account: { currency: Currency };
  }[]) {
    const key = `${t.trip_id}:${t.account.currency}`;
    const entry = tripByKey.get(key) ?? {
      id: t.trip_id,
      currency: t.account.currency,
      spent: 0,
      reimbursed: 0,
      count: 0,
      from: t.posted_date,
      to: t.posted_date,
    };
    if (t.amount < 0) entry.spent += -t.amount;
    else entry.reimbursed += t.amount;
    entry.count += 1;
    if (t.posted_date < entry.from) entry.from = t.posted_date;
    if (t.posted_date > entry.to) entry.to = t.posted_date;
    tripByKey.set(key, entry);
  }

  return trips.map((trip) => ({
    id: trip.id,
    name: trip.name,
    currencies: [...tripByKey.values()]
      .filter((e) => e.id === trip.id)
      .map((e) => ({
        currency: e.currency,
        spent: Math.round(e.spent * 100) / 100,
        reimbursed: Math.round(e.reimbursed * 100) / 100,
        net: Math.round((e.spent - e.reimbursed) * 100) / 100,
        count: e.count,
        from: e.from,
        to: e.to,
      })),
  }));
}

export type TripTransaction = {
  id: string;
  posted_date: string;
  description: string;
  merchant: string | null;
  amount: number;
  account: { name: string; currency: Currency };
};

/** Every transaction on one trip, newest first -- for the trip's detail view. */
export async function fetchTripTransactions(
  supabase: SupabaseClient,
  tripId: string,
): Promise<TripTransaction[]> {
  const { data } = await supabase
    .from("transactions")
    .select("id, posted_date, description, merchant, amount, account:accounts(name, currency)")
    .eq("trip_id", tripId)
    .order("posted_date", { ascending: false });
  return (data ?? []) as unknown as TripTransaction[];
}
