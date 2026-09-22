import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { createClient } from "@/lib/supabase/server";
import { AddTrip } from "./add-trip";
import { TripList } from "./trip-list";
import { fetchTripSummaries } from "./trip-summary";

export default async function Trips() {
  const supabase = await createClient();
  const { data, error } = await supabase.from("trips").select("id, name").order("created_at");
  const trips = (data ?? []) as { id: string; name: string }[];
  const tripSummaries = error ? [] : await fetchTripSummaries(supabase, trips);

  return (
    <>
      <PageHeader
        title="Trips"
        description="Group travel spending together, and net out what other people paid you back. Attach transactions to a trip from the Transactions page."
      />

      <div className="mb-6">
        <AddTrip />
      </div>

      {error ? (
        <p role="alert" className="text-negative">
          Couldn&rsquo;t load your trips. Refresh to try again.
        </p>
      ) : trips.length === 0 ? (
        <EmptyState
          title="No trips yet"
          description="Create one above, then head to Transactions to select purchases and attach them to it."
        />
      ) : (
        <TripList trips={tripSummaries} />
      )}
    </>
  );
}
