import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { addItemProducts, syncUserItems } from "@/lib/plaid/sync";

export const maxDuration = 60;

// Body: { itemId?: string, addProducts?: string[] }. "Sync now" for the
// signed-in user's connections; addProducts records a product Plaid just
// granted (via update mode) before syncing, so this pull actually uses it.
export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as {
    itemId?: unknown;
    addProducts?: unknown;
  };
  const itemId = typeof body.itemId === "string" ? body.itemId : undefined;
  const addProducts = Array.isArray(body.addProducts)
    ? body.addProducts.filter((p): p is string => typeof p === "string")
    : undefined;

  try {
    if (itemId && addProducts?.length) {
      await addItemProducts(user.id, itemId, addProducts);
    }
    const results = await syncUserItems(user.id, itemId);
    return NextResponse.json({ results });
  } catch {
    return NextResponse.json({ error: "Sync failed." }, { status: 500 });
  }
}
