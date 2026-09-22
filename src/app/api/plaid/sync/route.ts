import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { syncUserItems } from "@/lib/plaid/sync";

export const maxDuration = 60;

// Body: { itemId?: string }. "Sync now" for the signed-in user's connections.
export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as { itemId?: unknown };
  const itemId = typeof body.itemId === "string" ? body.itemId : undefined;

  try {
    const results = await syncUserItems(user.id, itemId);
    return NextResponse.json({ results });
  } catch {
    return NextResponse.json({ error: "Sync failed." }, { status: 500 });
  }
}
