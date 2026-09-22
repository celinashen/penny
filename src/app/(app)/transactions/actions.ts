"use server";

import { revalidatePath } from "next/cache";
import { autoCategorize } from "@/lib/auto-categorize";
import { createCategorizer, merchantKey } from "@/lib/categorize";
import { createClient } from "@/lib/supabase/server";

export type TxFormState = { error?: string; ok?: boolean; message?: string };

const text = (formData: FormData, key: string) =>
  String(formData.get(key) ?? "").trim();

const isDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));

function refresh() {
  revalidatePath("/transactions");
  revalidatePath("/");
}

export async function createTransaction(
  _prev: TxFormState,
  formData: FormData,
): Promise<TxFormState> {
  const accountId = text(formData, "account_id");
  const date = text(formData, "date");
  const description = text(formData, "description");
  const categoryId = text(formData, "category_id");
  const notes = text(formData, "notes");
  const amount = Number(text(formData, "amount"));
  const income = text(formData, "kind") === "income";

  if (!accountId) return { error: "Pick an account." };
  if (!isDate(date)) return { error: "Enter a valid date." };
  if (!description) return { error: "Add a description." };
  if (description.length > 200) return { error: "That description is too long." };
  if (!Number.isFinite(amount) || amount <= 0 || amount > 1_000_000_000) {
    return { error: "Enter an amount greater than zero." };
  }
  if (notes.length > 500) return { error: "That note is too long." };

  const supabase = await createClient();
  const signed = income ? amount : -amount;

  let category_id: string | null = categoryId || null;
  let category_source: "user" | "auto" | "rule" = "user";
  if (!category_id) {
    // No category chosen: make a best guess, like an imported transaction.
    const [cats, rules] = await Promise.all([
      supabase.from("categories").select("id, name"),
      supabase.from("merchant_rules").select("merchant_key, category_id"),
    ]);
    const guess = createCategorizer(cats.data ?? [], rules.data ?? [])({
      description,
      amount: signed,
    });
    category_id = guess.categoryId;
    category_source = guess.source;
  }

  const { error } = await supabase.from("transactions").insert({
    account_id: accountId,
    category_id,
    category_source,
    posted_date: date,
    description,
    amount: signed,
    notes: notes || null,
    source: "manual",
  });
  if (error) return { error: "Couldn’t save the transaction. Please try again." };

  refresh();
  return { ok: true };
}

export async function updateTransaction(
  _prev: TxFormState,
  formData: FormData,
): Promise<TxFormState> {
  const id = text(formData, "id");
  const categoryId = text(formData, "category_id") || null;
  const notes = text(formData, "notes");
  const applyToSimilar = formData.get("apply") === "on";
  if (!id) return { error: "Missing transaction." };
  if (notes.length > 500) return { error: "That note is too long." };

  const supabase = await createClient();
  const { data: current, error: readError } = await supabase
    .from("transactions")
    .select("id, description, merchant, category_id")
    .eq("id", id)
    .single();
  if (readError || !current) return { error: "Couldn’t find that transaction." };

  const categoryChanged = categoryId !== current.category_id;
  const { error } = await supabase
    .from("transactions")
    .update({
      notes: notes || null,
      ...(categoryChanged ? { category_id: categoryId, category_source: "user" } : {}),
    })
    .eq("id", id);
  if (error) return { error: "Couldn’t save your changes." };

  let message = "Saved.";
  if (categoryChanged && categoryId && applyToSimilar) {
    const applied = await teachMerchant(supabase, current, categoryId);
    if (applied === null) {
      message = "Saved, but couldn’t apply it to similar transactions.";
    } else if (applied > 0) {
      message = `Saved. Also updated ${applied} similar transaction${applied === 1 ? "" : "s"}.`;
    }

  }

  refresh();
  return { ok: true, message };
}

export async function linkReimbursement(
  _prev: TxFormState,
  formData: FormData,
): Promise<TxFormState> {
  const reimbursementId = text(formData, "reimbursement_id");
  const expenseId = text(formData, "expense_id");
  if (!reimbursementId || !expenseId) return { error: "Choose a meal to reimburse." };

  const supabase = await createClient();
  const [{ data: reimbursement }, { data: expense }] = await Promise.all([
    supabase
      .from("transactions")
      .select("id, amount")
      .eq("id", reimbursementId)
      .single(),
    supabase
      .from("transactions")
      .select("id, amount, category:categories(kind)")
      .eq("id", expenseId)
      .single(),
  ]);
  if (!reimbursement || !expense || Number(reimbursement.amount) <= 0) {
    return { error: "That reimbursement could not be found." };
  }
  const category = expense.category as unknown as { kind: string } | null;
  if (Number(expense.amount) >= 0 || category?.kind !== "expense") {
    return { error: "Choose an expense transaction." };
  }

  const { data: existing } = await supabase
    .from("transaction_reimbursements")
    .select("id")
    .eq("reimbursement_transaction_id", reimbursementId)
    .maybeSingle();
  if (existing) return { error: "This payment is already attached to an expense." };

  const { data: linked } = await supabase
    .from("transaction_reimbursements")
    .select("amount")
    .eq("expense_transaction_id", expenseId);
  const alreadyApplied = (linked ?? []).reduce((sum, row) => sum + Number(row.amount), 0);
  if (alreadyApplied + Number(reimbursement.amount) > Math.abs(Number(expense.amount)) + 0.005) {
    return { error: "That would reimburse more than the meal cost." };
  }

  const { error } = await supabase.from("transaction_reimbursements").insert({
    reimbursement_transaction_id: reimbursementId,
    expense_transaction_id: expenseId,
    amount: Number(reimbursement.amount),
  });
  if (error) return { error: "Couldn’t attach that payment." };

  refresh();
  return { ok: true };
}

export async function unlinkReimbursement(
  _prev: TxFormState,
  formData: FormData,
): Promise<TxFormState> {
  const id = text(formData, "id");
  if (!id) return { error: "Missing reimbursement." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("transaction_reimbursements")
    .delete()
    .eq("id", id);
  if (error) return { error: "Couldn’t remove that attachment." };
  refresh();
  return { ok: true };
}

/**
 * Remembers "this merchant -> that category" and applies it to matching
 * transactions that you haven't categorized by hand. Returns how many were
 * updated, or null if something failed.
 */
async function teachMerchant(
  supabase: Awaited<ReturnType<typeof createClient>>,
  tx: { id: string; description: string; merchant: string | null },
  categoryId: string,
): Promise<number | null> {
  const key = merchantKey(tx.description, tx.merchant);

  const { error: ruleError } = await supabase
    .from("merchant_rules")
    .upsert({ merchant_key: key, category_id: categoryId }, { onConflict: "user_id,merchant_key" });
  if (ruleError) return null;

  // Purchases made abroad stay under Travel, and anything you set by hand stays put.
  const { data: candidates, error } = await supabase
    .from("transactions")
    .select("id, description, merchant")
    .in("category_source", ["auto", "rule"])
    .is("country", null)
    .neq("id", tx.id)
    .limit(5000);
  if (error) return null;

  const ids = (candidates ?? [])
    .filter((c) => merchantKey(c.description, c.merchant) === key)
    .map((c) => c.id);

  for (let i = 0; i < ids.length; i += 100) {
    const { error: updateError } = await supabase
      .from("transactions")
      .update({ category_id: categoryId, category_source: "rule" })
      .in("id", ids.slice(i, i + 100));
    if (updateError) return null;
  }
  return ids.length;
}

/** Best-guess categories for anything still uncategorized. */
export async function categorizeUncategorized(): Promise<TxFormState> {
  try {
    const supabase = await createClient();
    const { categorized, unresolved, more } = await autoCategorize(supabase);
    refresh();
    if (more) {
      return {
        ok: true,
        message: `Categorized ${categorized.toLocaleString("en-US")} so far. There are more, so press the button again to continue.`,
      };
    }
    const left = unresolved
      ? ` ${unresolved} couldn’t be guessed and are still uncategorized.`
      : "";
    return { ok: true, message: `Categorized ${categorized.toLocaleString("en-US")}.${left}` };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Something went wrong." };
  }
}

export async function deleteTransaction(
  _prev: TxFormState,
  formData: FormData,
): Promise<TxFormState> {
  const id = text(formData, "id");
  if (!id) return { error: "Missing transaction." };

  // Synced transactions are managed by the bank, so only your own can be deleted.
  const supabase = await createClient();
  const { error } = await supabase
    .from("transactions")
    .delete()
    .eq("id", id)
    .neq("source", "plaid");
  if (error) return { error: "Couldn’t delete the transaction." };

  refresh();
  return { ok: true };
}
