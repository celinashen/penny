import { NextResponse } from "next/server";
import { topUpDemoAccount } from "@/lib/demo-data";
import { syncAllItems } from "@/lib/plaid/sync";
import { createAdminClient } from "@/lib/supabase/admin";

// Plaid syncs can take a while for many connections.
export const maxDuration = 60;

// The daily job. Vercel Cron calls this with "Authorization: Bearer <CRON_SECRET>".
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET is not set." }, { status: 500 });
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  // Keep the public demo account stocked with this month's transactions. A
  // failure here shouldn't stop real accounts from syncing.
  let demoAdded: number | null = null;
  try {
    demoAdded = await topUpDemoAccount(createAdminClient());
  } catch {}

  try {
    const results = await syncAllItems();
    const failed = results.filter((r) => r.status === "error").length;
    return NextResponse.json({ synced: results.length, failed, results, demoAdded });
  } catch {
    return NextResponse.json({ error: "Sync failed." }, { status: 500 });
  }
}
