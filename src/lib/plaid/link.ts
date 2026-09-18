import {
  CountryCode,
  Products,
  type LinkTokenCreateRequest,
} from "plaid";
import { decryptToken, encryptToken } from "@/lib/crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { plaid } from "./client";
import { syncItem, type ItemRow, type SyncResult } from "./sync";

const COUNTRIES = [CountryCode.Us, CountryCode.Ca];

/**
 * A short-lived token that opens Plaid Link in the browser.
 *
 * Pass `itemId` to repair an existing connection (update mode). That reuses the
 * same Plaid Item, so it doesn't count against the Item limit; a fresh link does.
 */
export async function createLinkToken(
  userId: string,
  itemId?: string,
): Promise<string> {
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
): Promise<SyncResult> {
  const { data: exchange } = await plaid().itemPublicTokenExchange({
    public_token: publicToken,
  });
  const accessToken = exchange.access_token;

  let institutionId: string | null = null;
  let institutionName: string | null = null;
  try {
    const { data } = await plaid().itemGet({ access_token: accessToken });
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
      },
      { onConflict: "plaid_item_id" },
    )
    .select(
      "id, user_id, institution_name, access_token_enc, transactions_cursor, status",
    )
    .single();
  if (error || !row) throw error ?? new Error("Couldn't save the connection.");

  return syncItem(row as ItemRow, admin);
}
