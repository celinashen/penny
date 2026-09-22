import type { SupabaseClient } from "@supabase/supabase-js";
import type { AccountBase, Transaction } from "plaid";
import type { AccountType } from "@/lib/accounts";
import { createCategorizer } from "@/lib/categorize";
import { decryptToken } from "@/lib/crypto";
import { defaultPayrollFunded } from "@/lib/investments";
import { createAdminClient } from "@/lib/supabase/admin";
import { plaid, plaidErrorCode, plaidErrorMessage } from "./client";
import { syncInvestments } from "./investments";

export type SyncResult = {
  itemId: string;
  institution: string | null;
  status: "good" | "needs_reauth" | "error";
  added: number;
  modified: number;
  removed: number;
  message?: string;
  /** True when time ran out with history still to load; the next sync continues. */
  more?: boolean;
  /** For investment connections: positions found, and contributions recorded. */
  holdings?: number;
  contributions?: number;
};

/**
 * How long one request may spend syncing before it stops and lets the next sync
 * continue. Serverless requests are killed at a hard limit (60 seconds here), and
 * a first sync of two years of history can be big; the cursor is saved after every
 * page, so stopping early loses nothing.
 */
export const SYNC_BUDGET_MS = 45_000;

export type ItemRow = {
  id: string;
  user_id: string;
  institution_name: string | null;
  access_token_enc: string;
  transactions_cursor: string | null;
  status: string;
  /** What this connection provides: "transactions", "investments", or both. */
  products: string[];
  investments_backfilled: boolean;
};

export const ITEM_COLUMNS =
  "id, user_id, institution_name, access_token_enc, transactions_cursor, status, products, investments_backfilled";
const CHUNK = 500;

function chunks<T>(list: T[], size = CHUNK): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

function mapType(a: AccountBase): AccountType {
  switch (String(a.type)) {
    case "credit":
      return "credit";
    case "investment":
      return "investment";
    case "depository":
      return String(a.subtype) === "savings" ? "savings" : "checking";
    default:
      return "other";
  }
}

export type AccountLinks = {
  /** Plaid account id -> our account id, for every account under this Item. */
  ids: Map<string, string>;
  /**
   * Our account ids that you've closed. Kept out of Plaid so a closed
   * account doesn't come back on its own, but still reported here so new
   * activity for it can be skipped rather than reappearing silently.
   */
  closedIds: Set<string>;
};

/**
 * Makes sure every account Plaid reports for this Item exists in our accounts
 * table, and returns Plaid account id -> our account id. Existing rows are left
 * alone so a name you've changed isn't overwritten, and a closed one is never
 * recreated -- its row (and history) just stays put, marked closed.
 */
async function ensureAccounts(
  admin: SupabaseClient,
  item: ItemRow,
  accessToken: string,
): Promise<AccountLinks> {
  const { data: remote } = await plaid().accountsGet({
    access_token: accessToken,
  });

  const { data: existing, error } = await admin
    .from("accounts")
    .select("id, name, plaid_item_id, plaid_account_id, closed")
    .eq("user_id", item.user_id);
  if (error) throw error;

  const ids = new Map<string, string>();
  const closedIds = new Set<string>();
  const names = new Set<string>();
  for (const a of existing ?? []) {
    names.add(a.name);
    if (a.plaid_item_id === item.id && a.plaid_account_id) {
      ids.set(a.plaid_account_id, a.id);
      if (a.closed) closedIds.add(a.id);
    }
  }

  // A connection made only for investments has no transactions for the
  // institution's other accounts (checking, loans...), so don't create empty ones.
  const investmentsOnly = !(item.products?.length ? item.products : ["transactions"]).includes("transactions");

  for (const a of remote.accounts) {
    if (ids.has(a.account_id)) continue;
    if (investmentsOnly && mapType(a) !== "investment") continue;

    // Account names are unique per user, so disambiguate collisions.
    let name = a.name;
    if (names.has(name) && a.mask) name = `${a.name} ••${a.mask}`;
    const base = name;
    for (let n = 2; names.has(name); n++) name = `${base} (${n})`;
    names.add(name);

    const type = mapType(a);
    const { data: created, error: insertError } = await admin
      .from("accounts")
      .insert({
        user_id: item.user_id,
        name,
        institution: item.institution_name,
        type,
        subtype: a.subtype ? String(a.subtype) : null,
        currency: a.balances.iso_currency_code === "CAD" ? "CAD" : "USD",
        source: "plaid",
        plaid_item_id: item.id,
        plaid_account_id: a.account_id,
        mask: a.mask,
        // Deposits into a Fidelity account are treated as coming out of your
        // paycheck. It's a setting on the account, so it can be turned off.
        payroll_funded: defaultPayrollFunded(type, item.institution_name),
        balance_current: a.balances.current ?? null,
        balance_as_of: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (insertError) throw insertError;
    ids.set(a.account_id, created.id);
  }
  return { ids, closedIds };
}

/** The user's categories and merchant rules, loaded once per sync. */
async function loadCategorizer(admin: SupabaseClient, userId: string) {
  const [cats, rules] = await Promise.all([
    admin.from("categories").select("id, name").eq("user_id", userId),
    admin.from("merchant_rules").select("merchant_key, category_id").eq("user_id", userId),
  ]);
  if (cats.error) throw cats.error;
  if (rules.error) throw rules.error;
  return createCategorizer(cats.data ?? [], rules.data ?? []);
}

type Categorizer = Awaited<ReturnType<typeof loadCategorizer>>;

// Fields Plaid owns. Safe to rewrite whenever Plaid reports a change.
function toRow(t: Transaction, userId: string, accountId: string) {
  return {
    user_id: userId,
    account_id: accountId,
    posted_date: t.date,
    description: t.name,
    merchant: t.merchant_name ?? null,
    // Plaid reports money out as positive; we store money out as negative.
    amount: -t.amount,
    pending: t.pending,
    external_id: t.transaction_id,
    source: "plaid",
    plaid_category: t.personal_finance_category?.detailed ?? null,
  };
}

// Fields we decide, applied only when a transaction is first seen so a later
// Plaid update never overwrites a category or note you've set yourself.
function toNewRow(
  t: Transaction,
  userId: string,
  accountId: string,
  categorize: Categorizer,
) {
  const c = categorize({
    description: t.name,
    merchant: t.merchant_name,
    amount: -t.amount,
    plaidCategory: t.personal_finance_category?.detailed,
    country: t.location?.country,
  });
  return {
    ...toRow(t, userId, accountId),
    category_id: c.categoryId,
    category_source: c.source,
    notes: c.note,
    country: c.country,
  };
}

async function pullTransactions(
  admin: SupabaseClient,
  item: ItemRow,
  accessToken: string,
  accountIds: Map<string, string>,
  closedIds: Set<string>,
  deadline: number,
) {
  const categorize = await loadCategorizer(admin, item.user_id);
  const totals = { added: 0, modified: 0, removed: 0, more: false };
  // Only advanced after a page is fully applied, so a failure never skips data.
  let saved = item.transactions_cursor ?? undefined;

  for (let attempt = 0; ; attempt++) {
    try {
      let cursor = saved;
      let hasMore = true;
      while (hasMore) {
        // Out of time: stop cleanly. Everything up to the saved cursor is stored,
        // and the next sync carries on from there.
        if (Date.now() >= deadline) {
          totals.more = true;
          return totals;
        }

        const { data } = await plaid().transactionsSync({
          access_token: accessToken,
          cursor,
          count: CHUNK,
        });

        const changed = [...data.added, ...data.modified];
        if (changed.some((t) => !accountIds.has(t.account_id))) {
          // A new account showed up since we last looked.
          const refreshed = await ensureAccounts(admin, item, accessToken);
          refreshed.ids.forEach((v, k) => accountIds.set(k, v));
          refreshed.closedIds.forEach((id) => closedIds.add(id));
        }

        // New transactions: categorized on the way in. If one is somehow
        // delivered twice, "ignore duplicates" keeps the first copy untouched.
        // A closed account's history stays put, but nothing new is added to it.
        const fresh = data.added.flatMap((t) => {
          const accountId = accountIds.get(t.account_id);
          return accountId && !closedIds.has(accountId)
            ? [toNewRow(t, item.user_id, accountId, categorize)]
            : [];
        });
        for (const part of chunks(fresh)) {
          const { error } = await admin
            .from("transactions")
            .upsert(part, {
              onConflict: "account_id,external_id",
              ignoreDuplicates: true,
            });
          if (error) throw error;
        }

        // Changed transactions (e.g. pending -> posted): only Plaid's own
        // fields are written, so your category and notes are left alone.
        const updated = data.modified.flatMap((t) => {
          const accountId = accountIds.get(t.account_id);
          return accountId && !closedIds.has(accountId)
            ? [toRow(t, item.user_id, accountId)]
            : [];
        });
        for (const part of chunks(updated)) {
          const { error } = await admin
            .from("transactions")
            .upsert(part, { onConflict: "account_id,external_id" });
          if (error) throw error;
        }

        const removed = data.removed.flatMap((r) =>
          r.transaction_id ? [r.transaction_id] : [],
        );
        for (const part of chunks(removed)) {
          const { error } = await admin
            .from("transactions")
            .delete()
            .eq("user_id", item.user_id)
            .in("external_id", part);
          if (error) throw error;
        }

        cursor = data.next_cursor;
        saved = cursor;
        const { error } = await admin
          .from("plaid_items")
          .update({ transactions_cursor: cursor })
          .eq("id", item.id);
        if (error) throw error;

        totals.added += data.added.length;
        totals.modified += data.modified.length;
        totals.removed += removed.length;
        hasMore = data.has_more;
      }
      return totals;
    } catch (err) {
      // Plaid asks us to restart the pagination if data changed underneath us.
      if (
        plaidErrorCode(err) === "TRANSACTIONS_SYNC_MUTATION_DURING_PAGINATION" &&
        attempt < 3
      ) {
        continue;
      }
      throw err;
    }
  }
}

export async function syncItem(
  item: ItemRow,
  admin: SupabaseClient = createAdminClient(),
  deadline: number = Date.now() + SYNC_BUDGET_MS,
): Promise<SyncResult> {
  const base = {
    itemId: item.id,
    institution: item.institution_name,
    added: 0,
    modified: 0,
    removed: 0,
  };

  const record = (patch: Record<string, unknown>) =>
    admin.from("plaid_items").update(patch).eq("id", item.id);

  try {
    const accessToken = decryptToken(item.access_token_enc);
    const { ids: accountIds, closedIds } = await ensureAccounts(admin, item, accessToken);
    const products = item.products?.length ? item.products : ["transactions"];

    // A connection can provide bank transactions, investments, or both.
    const totals = products.includes("transactions")
      ? await pullTransactions(admin, item, accessToken, accountIds, closedIds, deadline)
      : { added: 0, modified: 0, removed: 0, more: false };
    const investments = products.includes("investments")
      ? await syncInvestments(admin, item, accessToken, accountIds, deadline)
      : null;

    const result = {
      ...base,
      ...totals,
      status: "good" as const,
      ...(investments ? { holdings: investments.holdings, contributions: investments.contributions } : {}),
    };

    if (totals.more || investments?.more) {
      const message = "Still loading older history. It’ll finish on the next sync.";
      await record({ status: "good", last_synced_at: new Date().toISOString(), last_error: message });
      return { ...result, more: true, message };
    }
    await record({
      status: "good",
      last_synced_at: new Date().toISOString(),
      last_error: null,
    });
    return result;
  } catch (err) {
    const code = plaidErrorCode(err);

    if (code === "ITEM_LOGIN_REQUIRED") {
      await record({
        status: "needs_reauth",
        last_error: "The bank needs you to sign in again.",
      });
      return {
        ...base,
        status: "needs_reauth",
        message: "The bank needs you to sign in again.",
      };
    }

    if (code === "PRODUCT_NOT_READY") {
      // First pull of history can take a while; the next run will get it.
      return {
        ...base,
        status: "good",
        message: "Plaid is still preparing your transactions.",
      };
    }

    const message =
      err instanceof Error && !plaidErrorCode(err)
        ? "Sync failed."
        : plaidErrorMessage(err);
    await record({ status: "error", last_error: message });
    return { ...base, status: "error", message };
  }
}

export async function syncUserItems(
  userId: string,
  itemId?: string,
): Promise<SyncResult[]> {
  const admin = createAdminClient();
  let query = admin.from("plaid_items").select(ITEM_COLUMNS).eq("user_id", userId);
  if (itemId) query = query.eq("id", itemId);
  const { data, error } = await query;
  if (error) throw error;
  return runAll((data ?? []) as ItemRow[], admin);
}

/** Every user's Items. Used by the daily cron job. */
export async function syncAllItems(): Promise<SyncResult[]> {
  const admin = createAdminClient();
  const { data, error } = await admin.from("plaid_items").select(ITEM_COLUMNS);
  if (error) throw error;
  return runAll((data ?? []) as ItemRow[], admin);
}

async function runAll(items: ItemRow[], admin: SupabaseClient) {
  const results: SyncResult[] = [];
  // One budget shared by every connection in this request.
  const deadline = Date.now() + SYNC_BUDGET_MS;
  for (const item of items) {
    if (Date.now() >= deadline) {
      results.push({
        itemId: item.id,
        institution: item.institution_name,
        status: "good",
        added: 0,
        modified: 0,
        removed: 0,
        more: true,
        message: "Out of time; this one will sync on the next run.",
      });
      continue;
    }
    // Nothing to do until the user signs in to the bank again.
    if (item.status === "needs_reauth") {
      results.push({
        itemId: item.id,
        institution: item.institution_name,
        status: "needs_reauth",
        added: 0,
        modified: 0,
        removed: 0,
        message: "Waiting for you to reconnect.",
      });
      continue;
    }
    results.push(await syncItem(item, admin, deadline));
  }
  return results;
}
