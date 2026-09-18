import type { SupabaseClient } from "@supabase/supabase-js";
import type { AccountBase, Transaction } from "plaid";
import type { AccountType } from "@/lib/accounts";
import { decryptToken } from "@/lib/crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { plaid, plaidErrorCode, plaidErrorMessage } from "./client";

export type SyncResult = {
  itemId: string;
  institution: string | null;
  status: "good" | "needs_reauth" | "error";
  added: number;
  modified: number;
  removed: number;
  message?: string;
};

export type ItemRow = {
  id: string;
  user_id: string;
  institution_name: string | null;
  access_token_enc: string;
  transactions_cursor: string | null;
  status: string;
};

const ITEM_COLUMNS =
  "id, user_id, institution_name, access_token_enc, transactions_cursor, status";
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

/**
 * Makes sure every account Plaid reports for this Item exists in our accounts
 * table, and returns Plaid account id -> our account id. Existing rows are left
 * alone so a name you've changed isn't overwritten.
 */
async function ensureAccounts(
  admin: SupabaseClient,
  item: ItemRow,
  accessToken: string,
): Promise<Map<string, string>> {
  const { data: remote } = await plaid().accountsGet({
    access_token: accessToken,
  });

  const { data: existing, error } = await admin
    .from("accounts")
    .select("id, name, plaid_item_id, plaid_account_id")
    .eq("user_id", item.user_id);
  if (error) throw error;

  const ids = new Map<string, string>();
  const names = new Set<string>();
  for (const a of existing ?? []) {
    names.add(a.name);
    if (a.plaid_item_id === item.id && a.plaid_account_id) {
      ids.set(a.plaid_account_id, a.id);
    }
  }

  for (const a of remote.accounts) {
    if (ids.has(a.account_id)) continue;

    // Account names are unique per user, so disambiguate collisions.
    let name = a.name;
    if (names.has(name) && a.mask) name = `${a.name} ••${a.mask}`;
    const base = name;
    for (let n = 2; names.has(name); n++) name = `${base} (${n})`;
    names.add(name);

    const { data: created, error: insertError } = await admin
      .from("accounts")
      .insert({
        user_id: item.user_id,
        name,
        institution: item.institution_name,
        type: mapType(a),
        currency: a.balances.iso_currency_code === "CAD" ? "CAD" : "USD",
        source: "plaid",
        plaid_item_id: item.id,
        plaid_account_id: a.account_id,
        mask: a.mask,
      })
      .select("id")
      .single();
    if (insertError) throw insertError;
    ids.set(a.account_id, created.id);
  }
  return ids;
}

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

async function pullTransactions(
  admin: SupabaseClient,
  item: ItemRow,
  accessToken: string,
  accountIds: Map<string, string>,
) {
  const totals = { added: 0, modified: 0, removed: 0 };
  // Only advanced after a page is fully applied, so a failure never skips data.
  let saved = item.transactions_cursor ?? undefined;

  for (let attempt = 0; ; attempt++) {
    try {
      let cursor = saved;
      let hasMore = true;
      while (hasMore) {
        const { data } = await plaid().transactionsSync({
          access_token: accessToken,
          cursor,
          count: CHUNK,
        });

        const changed = [...data.added, ...data.modified];
        if (changed.some((t) => !accountIds.has(t.account_id))) {
          // A new account showed up since we last looked.
          const refreshed = await ensureAccounts(admin, item, accessToken);
          refreshed.forEach((v, k) => accountIds.set(k, v));
        }

        const rows = changed.flatMap((t) => {
          const accountId = accountIds.get(t.account_id);
          return accountId ? [toRow(t, item.user_id, accountId)] : [];
        });
        // Upserting only these columns leaves your own category/notes intact.
        for (const part of chunks(rows)) {
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
    const accountIds = await ensureAccounts(admin, item, accessToken);
    const totals = await pullTransactions(admin, item, accessToken, accountIds);
    await record({
      status: "good",
      last_synced_at: new Date().toISOString(),
      last_error: null,
    });
    return { ...base, ...totals, status: "good" };
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
  for (const item of items) {
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
    results.push(await syncItem(item, admin));
  }
  return results;
}
