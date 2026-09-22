import {
  CountryCode,
  Products,
  type LinkTokenCreateRequest,
} from "plaid";
import { decryptToken, encryptToken } from "@/lib/crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { plaid } from "./client";
import { ITEM_COLUMNS, syncItem, type ItemRow, type SyncResult } from "./sync";

const COUNTRIES = [CountryCode.Us, CountryCode.Ca];

/** What a new connection is for. Brokerages like Fidelity and Robinhood are "investment". */
export type LinkKind = "bank" | "investment";

/**
 * A short-lived token that opens Plaid Link in the browser.
 *
 * Pass `itemId` to reopen an existing connection -- to repair it, to add an
 * account, or (with `addInvestments`) to grant the Investments product to a
 * connection that was linked without it -- in Plaid "update mode" (setting
 * `access_token` below instead of `products`). Update mode reuses the same
 * Item and never calls `item/public_token/exchange` (see `completeLink`),
 * which is the only call that creates a new Item, so it never counts against
 * the Item limit. Only a link token created *without* `itemId` spends one.
 */
export async function createLinkToken(
  userId: string,
  itemId?: string,
  kind: LinkKind = "bank",
  addInvestments = false,
): Promise<string> {
  const plaidEnv = process.env.PLAID_ENV;
  if (plaidEnv === "production") {
    const redirectUri = process.env.PLAID_REDIRECT_URI;
    if (!redirectUri || !redirectUri.startsWith("https://")) {
      throw new Error(
        "PLAID_REDIRECT_URI must be an HTTPS URL when Plaid production is enabled.",
      );
    }
  }

  const request: LinkTokenCreateRequest = {
    user: { client_user_id: userId },
    client_name: "Penny",
    language: "en",
    country_codes: COUNTRIES,
    // Required for OAuth banks (Chase, BofA...) in production; must be https.
    ...(process.env.PLAID_REDIRECT_URI
      ? { redirect_uri: process.env.PLAID_REDIRECT_URI }
      : {}),
    // Lets Plaid tell us when new transactions are ready.
    ...(process.env.PLAID_WEBHOOK_URL
      ? { webhook: process.env.PLAID_WEBHOOK_URL }
      : {}),
  };

  if (itemId) {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("plaid_items")
      .select("access_token_enc")
      .eq("id", itemId)
      .eq("user_id", userId)
      .single();
    if (error || !data) throw new Error("Connection not found.");
    request.access_token = decryptToken(data.access_token_enc);
    // Requests Plaid's "add product" update-mode flow instead of a plain repair.
    if (addInvestments) request.products = [Products.Investments];
  } else if (kind === "investment") {
    // Holdings and contributions. Plaid provides up to two years of history.
    request.products = [Products.Investments];
  } else {
    request.products = [Products.Transactions];
    // Ask for as much history as Plaid allows; this can't be changed later.
    request.transactions = { days_requested: 730 };
  }

  const { data } = await plaid().linkTokenCreate(request);
  return data.link_token;
}

/**
 * Turns the public token from a successful Link into a stored connection, then
 * runs the first sync. The access token is saved before anything else happens,
 * because losing it would mean re-linking and spending another Plaid Item.
 */
export async function linkItem(
  userId: string,
  publicToken: string,
  kind: LinkKind = "bank",
): Promise<SyncResult> {
  const { data: exchange } = await plaid().itemPublicTokenExchange({
    public_token: publicToken,
  });
  const accessToken = exchange.access_token;

  // What we asked this connection for, plus anything Plaid reports it provides.
  const products = new Set<string>([kind === "investment" ? "investments" : "transactions"]);
  let institutionId: string | null = null;
  let institutionName: string | null = null;
  try {
    const { data } = await plaid().itemGet({ access_token: accessToken });
    for (const p of data.item.billed_products ?? []) {
      if (p === Products.Transactions || p === Products.Investments) products.add(String(p));
    }
    institutionId = data.item.institution_id ?? null;
    if (institutionId) {
      const { data: inst } = await plaid().institutionsGetById({
        institution_id: institutionId,
        country_codes: COUNTRIES,
      });
      institutionName = inst.institution.name;
    }
  } catch {
    // The name is cosmetic; never let it block saving the connection.
  }

  const admin = createAdminClient();
  const { data: row, error } = await admin
    .from("plaid_items")
    .upsert(
      {
        user_id: userId,
        plaid_item_id: exchange.item_id,
        institution_id: institutionId,
        institution_name: institutionName,
        access_token_enc: encryptToken(accessToken),
        products: [...products],
      },
      { onConflict: "plaid_item_id" },
    )
    .select(ITEM_COLUMNS)
    .single();
  if (error || !row) throw error ?? new Error("Couldn't save the connection.");

  return syncItem(row as ItemRow, admin);
}
