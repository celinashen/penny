import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { plaidErrorMessage } from "@/lib/plaid/client";
import { createLinkToken } from "@/lib/plaid/link";

// Body: { itemId?: string, kind?: "bank" | "investment" }. With itemId, reopens
// that connection (update mode) to repair it or add an account; otherwise kind
// says what a new one is for.
export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as { itemId?: unknown; kind?: unknown };
  const itemId = typeof body.itemId === "string" ? body.itemId : undefined;
  const kind = body.kind === "investment" ? "investment" : "bank";

  try {
    const link_token = await createLinkToken(user.id, itemId, kind);
    return NextResponse.json({ link_token });
  } catch (err) {
    return NextResponse.json({ error: plaidErrorMessage(err) }, { status: 502 });
  }
}
