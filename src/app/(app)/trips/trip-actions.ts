"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type TripFormState = { error?: string; ok?: boolean };

const text = (formData: FormData, key: string) => String(formData.get(key) ?? "").trim();

function refresh() {
  revalidatePath("/trips");
  revalidatePath("/transactions");
  revalidatePath("/", "layout");
  revalidatePath("/year");
}

export async function createTrip(
  _prev: TripFormState,
  formData: FormData,
): Promise<TripFormState> {
  const name = text(formData, "name");
  if (!name) return { error: "Give the trip a name." };
  if (name.length > 80) return { error: "That name is too long." };

  const supabase = await createClient();
  const { error } = await supabase.from("trips").insert({ name });
  if (error) {
    return {
      error:
        error.code === "23505"
          ? "You already have a trip with that name."
          : "Couldn’t create the trip.",
    };
  }

  revalidatePath("/trips");
  return { ok: true };
}

/** Your "Travel" expense category, created if you somehow don't have one. */
async function travelCategoryId(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<string | null> {
  const { data: existing } = await supabase
    .from("categories")
    .select("id")
    .eq("kind", "expense")
    .ilike("name", "Travel")
    .limit(1)
    .maybeSingle();
  if (existing) return existing.id;

  const { data: created, error } = await supabase
    .from("categories")
    .insert({ name: "Travel", kind: "expense" })
    .select("id")
    .single();
  return error ? null : created.id;
}

/**
 * Attaches the given transactions to a trip: each is recategorized as Travel
 * (so a meal in Italy counts as travel spending, not Food & Drink), and a
 * reimbursement attached alongside its expenses nets against them the same
 * way any category nets a refund -- no separate math needed. The category
 * each transaction had going in is remembered, so `detachFromTrip` can put it
 * back.
 */
export async function attachToTrip(
  _prev: TripFormState,
  formData: FormData,
): Promise<TripFormState> {
  const tripId = text(formData, "trip_id");
  const ids = formData.getAll("id").map(String).filter(Boolean);
  if (!tripId) return { error: "Choose a trip." };
  if (ids.length === 0) return { error: "Select at least one transaction." };

  const supabase = await createClient();
  const travelId = await travelCategoryId(supabase);
  if (!travelId) return { error: "Couldn’t find or create a Travel category." };

  const { data: current, error: readError } = await supabase
    .from("transactions")
    .select("id, category_id, trip_id")
    .in("id", ids);
  if (readError || !current) return { error: "Couldn’t find those transactions." };

  // Already on a (possibly different) trip: keep the category it remembers from
  // before that trip, rather than overwriting it with Travel.
  const alreadyOnATrip = current.filter((t) => t.trip_id !== null).map((t) => t.id);
  const newlyAttached = current.filter((t) => t.trip_id === null).map((t) => t.id);

  if (newlyAttached.length > 0) {
    for (const t of current) {
      if (t.trip_id !== null) continue;
      const { error } = await supabase
        .from("transactions")
        .update({
          trip_id: tripId,
          category_id: travelId,
          category_source: "user",
          pre_trip_category_id: t.category_id,
        })
        .eq("id", t.id);
      if (error) return { error: "Couldn’t attach those transactions." };
    }
  }
  if (alreadyOnATrip.length > 0) {
    const { error } = await supabase
      .from("transactions")
      .update({ trip_id: tripId, category_id: travelId, category_source: "user" })
      .in("id", alreadyOnATrip);
    if (error) return { error: "Couldn’t move those transactions." };
  }

  refresh();
  return { ok: true };
}

/** Clears trip_id on the given rows and restores each one's pre-trip category. */
async function restoreCategories(
  supabase: Awaited<ReturnType<typeof createClient>>,
  rows: { id: string; pre_trip_category_id: string | null }[],
): Promise<boolean> {
  for (const t of rows) {
    const { error } = await supabase
      .from("transactions")
      .update({
        trip_id: null,
        category_id: t.pre_trip_category_id,
        category_source: "user",
        pre_trip_category_id: null,
      })
      .eq("id", t.id);
    if (error) return false;
  }
  return true;
}

/** Takes transactions off their trip and restores the category they had before it. */
export async function detachFromTrip(
  _prev: TripFormState,
  formData: FormData,
): Promise<TripFormState> {
  const ids = formData.getAll("id").map(String).filter(Boolean);
  if (ids.length === 0) return { error: "Select at least one transaction." };

  const supabase = await createClient();
  const { data: current, error: readError } = await supabase
    .from("transactions")
    .select("id, pre_trip_category_id")
    .in("id", ids);
  if (readError || !current) return { error: "Couldn’t find those transactions." };

  if (!(await restoreCategories(supabase, current))) {
    return { error: "Couldn’t remove those transactions from the trip." };
  }

  refresh();
  return { ok: true };
}

export async function renameTrip(
  _prev: TripFormState,
  formData: FormData,
): Promise<TripFormState> {
  const id = text(formData, "id");
  const name = text(formData, "name");
  if (!id) return { error: "Missing trip." };
  if (!name) return { error: "Give the trip a name." };
  if (name.length > 80) return { error: "That name is too long." };

  const supabase = await createClient();
  const { error } = await supabase.from("trips").update({ name }).eq("id", id);
  if (error) {
    return {
      error:
        error.code === "23505"
          ? "You already have a trip with that name."
          : "Couldn’t rename the trip.",
    };
  }

  refresh();
  return { ok: true };
}

/**
 * Deletes a trip without touching its transactions: each one's category is
 * restored to what it was before the trip took it over, the same as removing
 * it from the trip by hand, and only then is the trip itself deleted.
 */
export async function deleteTrip(
  _prev: TripFormState,
  formData: FormData,
): Promise<TripFormState> {
  const id = text(formData, "id");
  if (!id) return { error: "Missing trip." };

  const supabase = await createClient();
  const { data: current, error: readError } = await supabase
    .from("transactions")
    .select("id, pre_trip_category_id")
    .eq("trip_id", id);
  if (readError) return { error: "Couldn’t find that trip’s transactions." };

  if (!(await restoreCategories(supabase, current ?? []))) {
    return { error: "Couldn’t restore those transactions’ categories." };
  }

  const { error } = await supabase.from("trips").delete().eq("id", id);
  if (error) return { error: "Couldn’t delete the trip." };

  refresh();
  return { ok: true };
}
