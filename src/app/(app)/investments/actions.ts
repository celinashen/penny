"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type PayrollState = { error?: string; ok?: boolean };

/**
 * Marks whether deposits into an investment account came out of your paycheck.
 * When on, they're added to income and to your contributions on the Overview.
 */
export async function setPayrollFunded(
  _prev: PayrollState,
  formData: FormData,
): Promise<PayrollState> {
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Missing account." };
  const value = formData.get("payroll") === "on";

  // Row-level security means this only touches your own accounts.
  const supabase = await createClient();
  const { error } = await supabase
    .from("accounts")
    .update({ payroll_funded: value })
    .eq("id", id)
    .eq("type", "investment");
  if (error) return { error: "Couldn’t save that." };

  revalidatePath("/investments");
  revalidatePath("/");
  revalidatePath("/year");
  return { ok: true };
}
