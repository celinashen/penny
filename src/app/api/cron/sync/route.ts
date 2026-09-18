import { NextResponse } from "next/server";
import { syncAllItems } from "@/lib/plaid/sync";

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

  try {
    const results = await syncAllItems();
    const failed = results.filter((r) => r.status === "error").length;
    return NextResponse.json({ synced: results.length, failed, results });
  } catch {
    return NextResponse.json({ error: "Sync failed." }, { status: 500 });
  }
}
