"use server";

import { revalidatePath } from "next/cache";
import { isAccountType, isCurrency } from "@/lib/accounts";
import { createClient } from "@/lib/supabase/server";

export type AccountFormState = { error?: string; ok?: boolean };

const text = (formData: FormData, key: string) =>
  String(formData.get(key) ?? "").trim();

// Renaming or closing an account changes its name/visibility everywhere it's
// shown, not just on the Accounts page.
function refresh() {
  revalidatePath("/accounts");
  revalidatePath("/transactions");
  revalidatePath("/transactions/import");
  revalidatePath("/investments");
  revalidatePath("/year");
  revalidatePath("/", "layout");
}

export async function createAccount(
  _prev: AccountFormState,
  formData: FormData,
): Promise<AccountFormState> {
  const name = text(formData, "name");
  const institution = text(formData, "institution");
  const type = text(formData, "type");
  const currency = text(formData, "currency");

  if (!name) return { error: "Give the account a name." };
  if (name.length > 80) return { error: "That name is too long." };
  if (institution.length > 80) return { error: "That institution is too long." };
  if (!isAccountType(type)) return { error: "Pick an account type." };
  if (!isCurrency(currency)) return { error: "Pick a currency." };

  // user_id defaults to the signed-in user in the database, and row-level
  // security rejects anything else.
  const supabase = await createClient();
  const { error } = await supabase
    .from("accounts")
    .insert({ name, institution: institution || null, type, currency });

  if (error) {
    return {
      error:
        error.code === "23505"
          ? "You already have an account with that name."
          : "Couldn’t save the account. Please try again.",
    };
  }

  revalidatePath("/accounts");
  return { ok: true };
}

export async function renameAccount(
  _prev: AccountFormState,
  formData: FormData,
): Promise<AccountFormState> {
  const id = text(formData, "id");
  const name = text(formData, "name");
  if (!id) return { error: "Missing account." };
  if (!name) return { error: "Give the account a name." };
  if (name.length > 80) return { error: "That name is too long." };

  const supabase = await createClient();
  const { error } = await supabase.from("accounts").update({ name }).eq("id", id);
  if (error) {
    return {
      error:
        error.code === "23505"
          ? "You already have an account with that name."
          : "Couldn’t rename the account.",
    };
  }

  refresh();
  return { ok: true };
}

export async function deleteAccount(
  _prev: AccountFormState,
  formData: FormData,
): Promise<AccountFormState> {
  const id = text(formData, "id");
  if (!id) return { error: "Missing account." };

  const supabase = await createClient();
  const { error } = await supabase.from("accounts").delete().eq("id", id);
  if (error) return { error: "Couldn’t delete the account." };

  revalidatePath("/accounts");
  return { ok: true };
}

/**
 * Closes an account -- Plaid-synced or manual -- without deleting it: for a
 * Plaid account, deleting the row outright would just have the next sync
 * recreate it, since the bank still reports it as long as the connection
 * stays open; for either kind, you likely still want the history (a closed
 * credit card's old statements still matter). Closing leaves the row and its
 * transactions in place, and touches no Plaid connection, so reopening it
 * later (see `reopenAccount`) is free either way.
 */
export async function closeAccount(
  _prev: AccountFormState,
  formData: FormData,
): Promise<AccountFormState> {
  const id = text(formData, "id");
  if (!id) return { error: "Missing account." };

  const supabase = await createClient();
  const { error } = await supabase.from("accounts").update({ closed: true }).eq("id", id);
  if (error) return { error: "Couldn’t close the account." };

  refresh();
  return { ok: true };
}

/** Brings a closed account back into view. Free: no Plaid connection is made. */
export async function reopenAccount(
  _prev: AccountFormState,
  formData: FormData,
): Promise<AccountFormState> {
  const id = text(formData, "id");
  if (!id) return { error: "Missing account." };

  const supabase = await createClient();
  const { error } = await supabase.from("accounts").update({ closed: false }).eq("id", id);
  if (error) return { error: "Couldn’t reopen the account." };

  refresh();
  return { ok: true };
}
