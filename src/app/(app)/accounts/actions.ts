"use server";

import { revalidatePath } from "next/cache";
import { isAccountType, isCurrency } from "@/lib/accounts";
import { createClient } from "@/lib/supabase/server";

export type AccountFormState = { error?: string; ok?: boolean };

const text = (formData: FormData, key: string) =>
  String(formData.get(key) ?? "").trim();

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
