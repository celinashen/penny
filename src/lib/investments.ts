/**
 * Whether deposits into a newly connected account should count as coming out of
 * your paycheck. Fidelity is where employer plans (401k, ESPP, HSA) live, so its
 * investment accounts default to yes; everything else defaults to no, since
 * deposits into a brokerage like Robinhood usually come from your own bank
 * account and would be double counted. It's a setting on the account.
 */
export function defaultPayrollFunded(accountType: string, institutionName: string | null): boolean {
  return accountType === "investment" && /fidelity/i.test(institutionName ?? "");
}

/**
 * Decides whether a Plaid investment transaction is money going *into* the
 * account (a contribution or deposit), and how much.
 *
 * Plaid reports `amount` positive when cash leaves the account (a purchase of
 * stock) and negative when cash arrives (a sale, a deposit). Only contributions
 * and deposits count; dividends, interest, buys, sells and fees do not.
 *
 * Returns the (positive) amount that came in, or null if this isn't a contribution.
 */
export function contributionInflow(t: {
  type: string;
  subtype: string;
  amount: number;
}): number | null {
  const type = String(t.type).toLowerCase();
  const subtype = String(t.subtype).toLowerCase();

  // Explicit contributions and deposits: institutions aren't consistent about the
  // sign, so trust the label.
  if ((type === "cash" || type === "transfer") && (subtype === "contribution" || subtype === "deposit")) {
    const amount = Math.abs(t.amount);
    return amount > 0 ? amount : null;
  }

  // A plain transfer is only a contribution when cash arrived.
  if (type === "transfer" && subtype === "transfer" && t.amount < 0) {
    return Math.abs(t.amount);
  }

  return null;
}
